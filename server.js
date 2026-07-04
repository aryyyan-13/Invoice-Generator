import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { 
  validateGSTIN, 
  convertNumberToWords, 
  getFiscalYear, 
  getNextInvoiceNumber 
} from './utils/invoiceUtils.js';
import { generateInvoicePdf } from './utils/pdfRenderer.js';
import { uploadToNextcloud } from './utils/nextcloudClient.js';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static assets (logos and local PDF copies)
app.use('/logos', express.static(path.join(process.cwd(), 'public/logos')));
app.use('/public/invoices', express.static(path.join(process.cwd(), 'public/invoices')));

// Ensure local invoices directory exists
const localInvoicesDir = path.join(process.cwd(), 'public/invoices');
if (!fs.existsSync(localInvoicesDir)) {
  fs.mkdirSync(localInvoicesDir, { recursive: true });
}

// ----------------------------------------------------
// COMPANIES API
// ----------------------------------------------------

// Get all companies
app.get('/api/companies', async (req, res) => {
  try {
    const companies = await prisma.company.findMany();
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch companies: " + error.message });
  }
});

// Get company by code
app.get('/api/companies/:code', async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { code: req.params.code.toUpperCase() }
    });
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch company: " + error.message });
  }
});

// ----------------------------------------------------
// UTILITY / VALIDATION API
// ----------------------------------------------------

// Local GSTIN validator endpoint
app.post('/api/gst/validate', async (req, res) => {
  const { gstin } = req.body;
  if (!gstin) {
    return res.status(400).json({ error: "GSTIN is required" });
  }
  
  const validationResult = validateGSTIN(gstin);
  
  try {
    await prisma.gstValidationLog.create({
      data: {
        gstin,
        isValid: validationResult.isValid,
        errorMessage: validationResult.error || null
      }
    });
  } catch (dbError) {
    console.error("Failed to write GSTIN validation log:", dbError.message);
  }

  res.json(validationResult);
});

// Suggest HSN codes
app.get('/api/hsn/suggest/:query', async (req, res) => {
  const query = req.params.query;
  try {
    const suggestions = await prisma.hsnDirectory.findMany({
      where: {
        hsnCode: {
          contains: query
        }
      },
      take: 10
    });
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch HSN suggestions: " + error.message });
  }
});

// ----------------------------------------------------
// INVOICES SEQUENCE PREVIEW
// ----------------------------------------------------

// Preview the next invoice number
app.get('/api/invoices/preview-next', async (req, res) => {
  const { companyCode, date } = req.query;
  if (!companyCode || !date) {
    return res.status(400).json({ error: "companyCode and date are required" });
  }

  try {
    const company = await prisma.company.findUnique({
      where: { code: companyCode.toUpperCase() }
    });
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const fy = getFiscalYear(date);
    const sequence = await prisma.invoiceSequence.findUnique({
      where: {
        companyCode_fiscalYear: {
          companyCode: company.code,
          fiscalYear: fy
        }
      }
    });

    const nextVal = (sequence ? sequence.currentVal : 0) + 1;
    const paddedNum = String(nextVal).padStart(4, '0');
    const nextInvoiceNumber = `${company.invoicePrefix}/${fy}/${paddedNum}`;

    res.json({ nextInvoiceNumber, currentVal: nextVal - 1, nextVal });
  } catch (error) {
    res.status(500).json({ error: "Failed to preview invoice number: " + error.message });
  }
});

// ----------------------------------------------------
// CORE INVOICE CALCULATION HELPER
// ----------------------------------------------------

function calculateInvoiceTotals(companyGstin, buyerGstin, items, discountInput = 0) {
  // 1. Determine GST split
  // Check state code (first 2 digits of GSTIN)
  const companyState = companyGstin ? companyGstin.substring(0, 2) : "";
  const buyerState = (buyerGstin && buyerGstin.length >= 2) ? buyerGstin.substring(0, 2) : companyState; // default to intrastate if empty/unregistered
  
  const isIntrastate = (companyState === buyerState) || !buyerGstin || buyerGstin.trim().toUpperCase() === 'URD';

  const processedItems = items.map((item, index) => {
    const qty = parseFloat(item.qty) || 0;
    const rate = parseFloat(item.rate) || 0;
    const taxRate = parseFloat(item.taxRate) || 0;
    const amount = qty * rate;

    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;

    if (isIntrastate) {
      cgstRate = taxRate / 2;
      sgstRate = taxRate / 2;
    } else {
      igstRate = taxRate;
    }

    const cgstAmount = amount * (cgstRate / 100);
    const sgstAmount = amount * (sgstRate / 100);
    const igstAmount = amount * (igstRate / 100);

    return {
      lineNo: index + 1,
      description: item.description,
      hsnCode: item.hsnCode,
      uom: item.uom,
      qty,
      rate,
      amount,
      taxRate,
      cgstRate,
      sgstRate,
      igstRate,
      cgstAmount,
      sgstAmount,
      igstAmount
    };
  });

  const subtotal = processedItems.reduce((sum, item) => sum + item.amount, 0);
  const discountTotal = parseFloat(discountInput) || 0;
  
  // Tax totals are based on subtotal minus discount proportionally or directly.
  // Standard India rule: Apply taxes on the taxable value (amount - discount).
  // If discount is global, we apply it proportionally or directly to the total basic.
  const taxableValue = subtotal - discountTotal;
  
  // To avoid complex row allocation, we can apply CGST, SGST, and IGST totals
  // by summing up the item-level tax amounts, adjusted for the global discount factor if any.
  // Factor = taxableValue / subtotal
  const discountFactor = subtotal > 0 ? (taxableValue / subtotal) : 1;

  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  processedItems.forEach(item => {
    // Re-adjust item tax amounts based on discount factor
    item.cgstAmount = item.cgstAmount * discountFactor;
    item.sgstAmount = item.sgstAmount * discountFactor;
    item.igstAmount = item.igstAmount * discountFactor;

    cgstTotal += item.cgstAmount;
    sgstTotal += item.sgstAmount;
    igstTotal += item.igstAmount;
  });

  const rawGrandTotal = taxableValue + cgstTotal + sgstTotal + igstTotal;
  const grandTotal = Math.round(rawGrandTotal);
  const roundAdjustment = grandTotal - rawGrandTotal;

  // Format currency fields for view templating
  const formatCur = (num) => Number(num).toFixed(2);

  return {
    processedItems,
    totals: {
      subtotal,
      discountTotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      roundAdjustment,
      grandTotal,
      amountInWords: convertNumberToWords(grandTotal)
    }
  };
}

// ----------------------------------------------------
// CREATE INVOICE
// ----------------------------------------------------
app.post('/api/invoices', async (req, res) => {
  const {
    companyCode,
    invoiceType,
    invoiceDate,
    poNumber,
    buyerGstin,
    buyerName,
    buyerAddress,
    shipToName,
    shipToAddress,
    shipToGstin,
    transportMode,
    lrNumber,
    discount,
    items
  } = req.body;

  if (!companyCode || !invoiceType || !invoiceDate || !buyerName || !buyerAddress || !items || items.length === 0) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // 1. Fetch company configuration
    const company = await prisma.company.findUnique({
      where: { code: companyCode.toUpperCase() }
    });
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // 2. Perform math calculations
    const calculations = calculateInvoiceTotals(company.gstin, buyerGstin, items, discount);

    // 3. Atomically consume the invoice sequence number
    const invoiceNumber = await getNextInvoiceNumber(company.code, invoiceDate, company.invoicePrefix, prisma);

    // 4. Set local paths
    const sanitizedInvoiceNum = invoiceNumber.replace(/\//g, '_');
    const localPdfPath = `/public/invoices/${company.code}/${sanitizedInvoiceNum}.pdf`;
    const absoluteLocalDir = path.join(process.cwd(), `public/invoices/${company.code}`);
    if (!fs.existsSync(absoluteLocalDir)) {
      fs.mkdirSync(absoluteLocalDir, { recursive: true });
    }
    const absoluteLocalPdfPath = path.join(absoluteLocalDir, `${sanitizedInvoiceNum}.pdf`);

    // 5. Render PDF Buffer using Puppeteer
    const allLinesPost = company.billingAddress ? company.billingAddress.split('\n') : [];
    const addressLinesOnlyPost = allLinesPost.filter(line => !line.includes('M. No') && !line.includes('Email ID'));
    const contactLinesOnlyPost = allLinesPost.filter(line => line.includes('M. No') || line.includes('Email ID'));

    const templateData = {
      company: {
        display_name: company.displayName,
        billing_address: company.billingAddress,
        billing_address_lines: addressLinesOnlyPost,
        contact_lines: contactLinesOnlyPost,
        gstin: company.gstin,
        logoPath: company.logoPath,
        themePrimary: company.themePrimary,
        themeAccent: company.themeAccent,
        account_name: company.accountName,
        account_no: company.accountNo,
        ifsc: company.ifsc,
        bank_name: company.bankName,
        upi_id: company.upiId
      },
      invoice: {
        invoice_type_display: invoiceType === "TAX" ? "TAX INVOICE" : "PROFORMA INVOICE",
        invoice_number: invoiceNumber,
        invoice_date: new Date(invoiceDate).toLocaleDateString('en-IN'),
        po_number: poNumber || 'N/A',
        transport_mode: transportMode || 'Manual',
        lr_number: lrNumber || 'N/A',
        terms: company.terms
      },
      buyer: {
        name: buyerName,
        address: buyerAddress,
        gstin: buyerGstin || 'URD'
      },
      ship_to: {
        name: shipToName || buyerName,
        address: shipToAddress || buyerAddress,
        gstin: shipToGstin || buyerGstin || 'URD'
      },
      items: calculations.processedItems.map(item => ({
        line_no: item.lineNo,
        description: item.description,
        hsn_code: item.hsnCode,
        uom: item.uom,
        qty: item.qty.toString(),
        rate: item.rate.toFixed(2),
        amount: item.amount.toFixed(2),
        tax_rate: item.taxRate.toString()
      })),
      totals: {
        subtotal: calculations.totals.subtotal.toFixed(2),
        discount_total: calculations.totals.discountTotal.toFixed(2),
        cgst_total: calculations.totals.cgstTotal.toFixed(2),
        sgst_total: calculations.totals.sgstTotal.toFixed(2),
        igst_total: calculations.totals.igstTotal.toFixed(2),
        round_adjustment: calculations.totals.roundAdjustment.toFixed(2),
        grand_total: calculations.totals.grandTotal.toFixed(2),
        amount_in_words: calculations.totals.amountInWords,
        cgst_in_words: convertNumberToWords(calculations.totals.cgstTotal),
        sgst_in_words: convertNumberToWords(calculations.totals.sgstTotal),
        igst_in_words: convertNumberToWords(calculations.totals.igstTotal)
      }
    };

    console.log(`Generating PDF locally for invoice ${invoiceNumber}...`);
    const pdfBuffer = await generateInvoicePdf(templateData);
    fs.writeFileSync(absoluteLocalPdfPath, pdfBuffer);

    // 6. Upload PDF to Nextcloud WebDAV
    console.log(`Uploading invoice ${invoiceNumber} to Nextcloud WebDAV...`);
    const nextcloudResult = await uploadToNextcloud(pdfBuffer, company.code, invoiceNumber);

    // 7. Save to Database
    const savedInvoice = await prisma.invoice.create({
      data: {
        companyId: company.id,
        invoiceNumber: invoiceNumber,
        invoiceType: invoiceType,
        invoiceDate: new Date(invoiceDate),
        poNumber: poNumber,
        buyerGstin: buyerGstin || 'URD',
        buyerName: buyerName,
        buyerAddress: buyerAddress,
        shipToName: shipToName,
        shipToAddress: shipToAddress,
        shipToGstin: shipToGstin,
        transportMode: transportMode || 'MANUAL',
        lrNumber: lrNumber,
        subtotal: calculations.totals.subtotal,
        discountTotal: calculations.totals.discountTotal,
        cgstTotal: calculations.totals.cgstTotal,
        sgstTotal: calculations.totals.sgstTotal,
        igstTotal: calculations.totals.igstTotal,
        roundAdjustment: calculations.totals.roundAdjustment,
        grandTotal: calculations.totals.grandTotal,
        amountInWords: calculations.totals.amountInWords,
        pdfPath: localPdfPath,
        nextcloudPath: nextcloudResult.nextcloudPath,
        status: "ACTIVE",
        items: {
          create: calculations.processedItems.map(item => ({
            lineNo: item.lineNo,
            description: item.description,
            hsnCode: item.hsnCode,
            uom: item.uom,
            qty: item.qty,
            rate: item.rate,
            amount: item.amount,
            taxRate: item.taxRate,
            cgstRate: item.cgstRate,
            sgstRate: item.sgstRate,
            igstRate: item.igstRate,
            cgstAmount: item.cgstAmount,
            sgstAmount: item.sgstAmount,
            igstAmount: item.igstAmount
          }))
        }
      },
      include: {
        items: true
      }
    });

    // 8. Log Audit History
    await prisma.auditLog.create({
      data: {
        invoiceNumber: invoiceNumber,
        invoiceId: savedInvoice.id,
        action: "CREATE",
        details: JSON.stringify({
          message: "Invoice created successfully.",
          timestamp: new Date().toISOString()
        })
      }
    });

    // 9. Check and auto-learn new HSN codes
    for (const item of items) {
      if (item.hsnCode) {
        try {
          await prisma.hsnDirectory.upsert({
            where: { hsnCode: item.hsnCode },
            update: { taxRate: parseFloat(item.taxRate) },
            create: { hsnCode: item.hsnCode, taxRate: parseFloat(item.taxRate) }
          });
        } catch (hsnError) {
          // ignore unique constraint errors in concurrent uploads
        }
      }
    }

    res.status(201).json(savedInvoice);

  } catch (error) {
    console.error(`POST Invoice Error: ${error.message}`);
    res.status(500).json({ error: "Failed to create invoice: " + error.message });
  }
});

// ----------------------------------------------------
// UPDATE / REGENERATE INVOICE
// ----------------------------------------------------
// Route handles: PUT /api/invoices/:prefix/:fy/:seq
app.put('/api/invoices/:prefix/:fy/:seq', async (req, res) => {
  const invoiceNumber = `${req.params.prefix}/${req.params.fy}/${req.params.seq}`;
  const {
    invoiceDate,
    poNumber,
    buyerGstin,
    buyerName,
    buyerAddress,
    shipToName,
    shipToAddress,
    shipToGstin,
    transportMode,
    lrNumber,
    discount,
    items
  } = req.body;

  if (!invoiceDate || !buyerName || !buyerAddress || !items || items.length === 0) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // 1. Fetch existing invoice
    const existingInvoice = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: { items: true, company: true }
    });

    if (!existingInvoice) {
      return res.status(404).json({ error: `Invoice ${invoiceNumber} not found.` });
    }

    const company = existingInvoice.company;

    // 2. Perform math calculations on updated content
    const calculations = calculateInvoiceTotals(company.gstin, buyerGstin, items, discount);

    // 3. Keep local paths
    const sanitizedInvoiceNum = invoiceNumber.replace(/\//g, '_');
    const localPdfPath = `/public/invoices/${company.code}/${sanitizedInvoiceNum}.pdf`;
    const absoluteLocalDir = path.join(process.cwd(), `public/invoices/${company.code}`);
    const absoluteLocalPdfPath = path.join(absoluteLocalDir, `${sanitizedInvoiceNum}.pdf`);

    // 4. Generate the diff for audit logging
    const changesDiff = {
      before: {
        invoiceDate: existingInvoice.invoiceDate,
        buyerName: existingInvoice.buyerName,
        buyerGstin: existingInvoice.buyerGstin,
        grandTotal: existingInvoice.grandTotal,
        itemsCount: existingInvoice.items.length
      },
      after: {
        invoiceDate: new Date(invoiceDate),
        buyerName,
        buyerGstin: buyerGstin || 'URD',
        grandTotal: calculations.totals.grandTotal,
        itemsCount: items.length
      }
    };

    // 5. Render PDF Buffer using Puppeteer
    const allLinesPut = company.billingAddress ? company.billingAddress.split('\n') : [];
    const addressLinesOnlyPut = allLinesPut.filter(line => !line.includes('M. No') && !line.includes('Email ID'));
    const contactLinesOnlyPut = allLinesPut.filter(line => line.includes('M. No') || line.includes('Email ID'));

    const templateData = {
      company: {
        display_name: company.displayName,
        billing_address: company.billingAddress,
        billing_address_lines: addressLinesOnlyPut,
        contact_lines: contactLinesOnlyPut,
        gstin: company.gstin,
        logoPath: company.logoPath,
        themePrimary: company.themePrimary,
        themeAccent: company.themeAccent,
        account_name: company.accountName,
        account_no: company.accountNo,
        ifsc: company.ifsc,
        bank_name: company.bankName,
        upi_id: company.upiId
      },
      invoice: {
        invoice_type_display: existingInvoice.invoiceType === "TAX" ? "TAX INVOICE" : "PROFORMA INVOICE",
        invoice_number: invoiceNumber,
        invoice_date: new Date(invoiceDate).toLocaleDateString('en-IN'),
        po_number: poNumber || 'N/A',
        transport_mode: transportMode || 'Manual',
        lr_number: lrNumber || 'N/A',
        terms: company.terms
      },
      buyer: {
        name: buyerName,
        address: buyerAddress,
        gstin: buyerGstin || 'URD'
      },
      ship_to: {
        name: shipToName || buyerName,
        address: shipToAddress || buyerAddress,
        gstin: shipToGstin || buyerGstin || 'URD'
      },
      items: calculations.processedItems.map(item => ({
        line_no: item.lineNo,
        description: item.description,
        hsn_code: item.hsnCode,
        uom: item.uom,
        qty: item.qty.toString(),
        rate: item.rate.toFixed(2),
        amount: item.amount.toFixed(2),
        tax_rate: item.taxRate.toString()
      })),
      totals: {
        subtotal: calculations.totals.subtotal.toFixed(2),
        discount_total: calculations.totals.discountTotal.toFixed(2),
        cgst_total: calculations.totals.cgstTotal.toFixed(2),
        sgst_total: calculations.totals.sgstTotal.toFixed(2),
        igst_total: calculations.totals.igstTotal.toFixed(2),
        round_adjustment: calculations.totals.roundAdjustment.toFixed(2),
        grand_total: calculations.totals.grandTotal.toFixed(2),
        amount_in_words: calculations.totals.amountInWords,
        cgst_in_words: convertNumberToWords(calculations.totals.cgstTotal),
        sgst_in_words: convertNumberToWords(calculations.totals.sgstTotal),
        igst_in_words: convertNumberToWords(calculations.totals.igstTotal)
      }
    };

    console.log(`Regenerating PDF locally for invoice ${invoiceNumber}...`);
    const pdfBuffer = await generateInvoicePdf(templateData);
    fs.writeFileSync(absoluteLocalPdfPath, pdfBuffer);

    // 6. Overwrite Nextcloud in-place using PUT WebDAV
    console.log(`Overwriting PDF in Nextcloud WebDAV for ${invoiceNumber}...`);
    const nextcloudResult = await uploadToNextcloud(pdfBuffer, company.code, invoiceNumber);

    // 7. Update Database (delete old items and create new ones in a transaction)
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // Delete existing items
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: existingInvoice.id }
      });

      // Update Invoice headers and save new items
      return await tx.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          invoiceDate: new Date(invoiceDate),
          poNumber: poNumber,
          buyerGstin: buyerGstin || 'URD',
          buyerName: buyerName,
          buyerAddress: buyerAddress,
          shipToName: shipToName,
          shipToAddress: shipToAddress,
          shipToGstin: shipToGstin,
          transportMode: transportMode || 'MANUAL',
          lrNumber: lrNumber,
          subtotal: calculations.totals.subtotal,
          discountTotal: calculations.totals.discountTotal,
          cgstTotal: calculations.totals.cgstTotal,
          sgstTotal: calculations.totals.sgstTotal,
          igstTotal: calculations.totals.igstTotal,
          roundAdjustment: calculations.totals.roundAdjustment,
          grandTotal: calculations.totals.grandTotal,
          amountInWords: calculations.totals.amountInWords,
          pdfPath: localPdfPath,
          nextcloudPath: nextcloudResult.nextcloudPath,
          items: {
            create: calculations.processedItems.map(item => ({
              lineNo: item.lineNo,
              description: item.description,
              hsnCode: item.hsnCode,
              uom: item.uom,
              qty: item.qty,
              rate: item.rate,
              amount: item.amount,
              taxRate: item.taxRate,
              cgstRate: item.cgstRate,
              sgstRate: item.sgstRate,
              igstRate: item.igstRate,
              cgstAmount: item.cgstAmount,
              sgstAmount: item.sgstAmount,
              igstAmount: item.igstAmount
            }))
          }
        },
        include: {
          items: true
        }
      });
    });

    // 8. Log Audit History for Regenerate Action
    await prisma.auditLog.create({
      data: {
        invoiceNumber: invoiceNumber,
        invoiceId: existingInvoice.id,
        action: "REGENERATE",
        details: JSON.stringify(changesDiff)
      }
    });

    // 9. Auto-learn newly inputted HSN rates
    for (const item of items) {
      if (item.hsnCode) {
        try {
          await prisma.hsnDirectory.upsert({
            where: { hsnCode: item.hsnCode },
            update: { taxRate: parseFloat(item.taxRate) },
            create: { hsnCode: item.hsnCode, taxRate: parseFloat(item.taxRate) }
          });
        } catch (hsnError) {
          // ignore
        }
      }
    }

    res.json(updatedInvoice);

  } catch (error) {
    console.error(`PUT Invoice Error: ${error.message}`);
    res.status(500).json({ error: "Failed to update invoice: " + error.message });
  }
});

// ----------------------------------------------------
// LIST / GET INVOICES
// ----------------------------------------------------

// List invoices with filters
app.get('/api/invoices', async (req, res) => {
  const { companyCode, invoiceType, status, search } = req.query;
  
  const whereClause = {};
  
  if (companyCode) {
    whereClause.company = { code: companyCode.toUpperCase() };
  }
  if (invoiceType) {
    whereClause.invoiceType = invoiceType.toUpperCase();
  }
  if (status) {
    whereClause.status = status.toUpperCase();
  }
  if (search) {
    whereClause.OR = [
      { invoiceNumber: { contains: search } },
      { buyerName: { contains: search } },
      { buyerGstin: { contains: search } }
    ];
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        company: true
      },
      orderBy: {
        invoiceDate: 'desc'
      }
    });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: "Failed to list invoices: " + error.message });
  }
});

// Get invoice by number
app.get('/api/invoices/:prefix/:fy/:seq', async (req, res) => {
  const invoiceNumber = `${req.params.prefix}/${req.params.fy}/${req.params.seq}`;
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: {
        items: true,
        company: true,
        auditLogs: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });
    
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: "Failed to get invoice: " + error.message });
  }
});

// Serve local PDF copy or regenerate on-the-fly if missing
app.get('/api/invoices/:prefix/:fy/:seq/pdf', async (req, res) => {
  const invoiceNumber = `${req.params.prefix}/${req.params.fy}/${req.params.seq}`;
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: { items: true, company: true }
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const sanitizedInvoiceNum = invoiceNumber.replace(/\//g, '_');
    const absolutePdfPath = path.join(process.cwd(), 'public/invoices', invoice.company.code, `${sanitizedInvoiceNum}.pdf`);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (fs.existsSync(absolutePdfPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${sanitizedInvoiceNum}.pdf"`);
      return fs.createReadStream(absolutePdfPath).pipe(res);
    }

    // Regene rate fallback if file doesn't exist locally
    console.log(`Local file not found for ${invoiceNumber}. Regenerating PDF copy...`);
    const allLinesGet = invoice.company.billingAddress ? invoice.company.billingAddress.split('\n') : [];
    const addressLinesOnlyGet = allLinesGet.filter(line => !line.includes('M. No') && !line.includes('Email ID'));
    const contactLinesOnlyGet = allLinesGet.filter(line => line.includes('M. No') || line.includes('Email ID'));

    const templateData = {
      company: {
        display_name: invoice.company.displayName,
        billing_address: invoice.company.billingAddress,
        billing_address_lines: addressLinesOnlyGet,
        contact_lines: contactLinesOnlyGet,
        gstin: invoice.company.gstin,
        logoPath: invoice.company.logoPath,
        themePrimary: invoice.company.themePrimary,
        themeAccent: invoice.company.themeAccent,
        account_name: invoice.company.accountName,
        account_no: invoice.company.accountNo,
        ifsc: invoice.company.ifsc,
        bank_name: invoice.company.bankName,
        upi_id: invoice.company.upiId
      },
      invoice: {
        invoice_type_display: invoice.invoiceType === "TAX" ? "TAX INVOICE" : "PROFORMA INVOICE",
        invoice_number: invoice.invoiceNumber,
        invoice_date: new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
        po_number: invoice.poNumber || 'N/A',
        transport_mode: invoice.transportMode || 'Manual',
        lr_number: invoice.lrNumber || 'N/A',
        terms: invoice.company.terms
      },
      buyer: {
        name: invoice.buyerName,
        address: invoice.buyerAddress,
        gstin: invoice.buyerGstin
      },
      ship_to: {
        name: invoice.shipToName || invoice.buyerName,
        address: invoice.shipToAddress || invoice.buyerAddress,
        gstin: invoice.shipToGstin || invoice.buyerGstin
      },
      items: invoice.items.map(item => ({
        line_no: item.lineNo,
        description: item.description,
        hsn_code: item.hsnCode,
        uom: item.uom,
        qty: item.qty.toString(),
        rate: item.rate.toFixed(2),
        amount: item.amount.toFixed(2),
        tax_rate: item.taxRate.toString()
      })),
      totals: {
        subtotal: invoice.subtotal.toFixed(2),
        discount_total: invoice.discountTotal.toFixed(2),
        cgst_total: invoice.cgstTotal.toFixed(2),
        sgst_total: invoice.sgstTotal.toFixed(2),
        igst_total: invoice.igstTotal.toFixed(2),
        round_adjustment: invoice.roundAdjustment.toFixed(2),
        grand_total: invoice.grandTotal.toFixed(2),
        amount_in_words: invoice.amountInWords,
        cgst_in_words: convertNumberToWords(invoice.cgstTotal),
        sgst_in_words: convertNumberToWords(invoice.sgstTotal),
        igst_in_words: convertNumberToWords(invoice.igstTotal)
      }
    };

    const pdfBuffer = await generateInvoicePdf(templateData);
    
    // Ensure dir exists
    const dir = path.dirname(absolutePdfPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(absolutePdfPath, pdfBuffer);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${sanitizedInvoiceNum}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    res.status(500).json({ error: "Failed to generate or fetch PDF: " + error.message });
  }
});

// Cancel an invoice
app.post('/api/invoices/:prefix/:fy/:seq/cancel', async (req, res) => {
  const invoiceNumber = `${req.params.prefix}/${req.params.fy}/${req.params.seq}`;
  try {
    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber }
    });

    if (!existing) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const cancelled = await prisma.invoice.update({
      where: { id: existing.id },
      data: { status: "CANCELLED" }
    });

    await prisma.auditLog.create({
      data: {
        invoiceNumber,
        invoiceId: existing.id,
        action: "CANCEL",
        details: JSON.stringify({ message: "Invoice cancelled.", timestamp: new Date().toISOString() })
      }
    });

    res.json(cancelled);
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel invoice: " + error.message });
  }
});


// Serve React built frontend static files in production
const frontendDistPath = path.join(process.cwd(), 'frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  console.log(`Serving production frontend from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));
  // Catch-all middleware to serve React Router SPA index for non-API client requests
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      return res.sendFile(path.join(frontendDistPath, 'index.html'));
    }
    next();
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Invoice generator backend running on port ${PORT}`);
});
