import express from 'express';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  getNextCommercialInvoiceNumber,
  calculateCommercialTotals,
  calculateAdvanceAmount,
} from '../utils/commercialInvoiceUtils.js';
import { getFiscalYear } from '../utils/sharedFinancialUtils.js';
import { generateInvoicePdf } from '../utils/pdfRenderer.js';
import { uploadToNextcloud } from '../utils/nextcloudClient.js';

const router = express.Router();
const prisma = new PrismaClient();
const GMP_CODE = 'GMP';

const DEFAULT_DECLARATION = `I hereby declare that the above-mentioned goods are exported as per applicable Indian export regulations, and the details given are true and correct to the best of my knowledge.`;

// ── Preview next Commercial/Proforma Invoice number ───────────
router.get('/preview-next', async (req, res) => {
  const { invoiceKind, date } = req.query;
  if (!invoiceKind || !date) return res.status(400).json({ error: 'invoiceKind and date are required' });

  try {
    const fy     = getFiscalYear(date);
    const kind   = invoiceKind.toUpperCase();
    const prefix = kind === 'PROFORMA' ? 'PI' : 'CI';
    const seq    = await prisma.commercialInvoiceSequence.findUnique({
      where: { invoiceKind_fiscalYear: { invoiceKind: kind, fiscalYear: fy } },
    });
    const nextVal = (seq?.currentVal ?? 0) + 1;
    res.json({ nextInvoiceNumber: `GMP/${prefix}/${fy}/${String(nextVal).padStart(4, '0')}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── List Commercial/Proforma Invoices ─────────────────────────
router.get('/', async (req, res) => {
  const { search, invoiceKind, status } = req.query;
  try {
    const where = { company: { code: GMP_CODE } };
    if (status)      where.status      = status.toUpperCase();
    if (invoiceKind) where.invoiceKind = invoiceKind.toUpperCase();
    if (search)      where.OR = [
      { invoiceNumber: { contains: search } },
      { clientName:    { contains: search } },
    ];

    const invoices = await prisma.commercialInvoice.findMany({
      where,
      include: { company: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single Commercial Invoice ────────────────────────────
router.get('/:invoiceId', async (req, res) => {
  try {
    const inv = await prisma.commercialInvoice.findUnique({
      where: { invoiceNumber: req.params.invoiceId },
      include: { company: true, items: true, auditLogs: true },
    });
    if (!inv) return res.status(404).json({ error: 'Commercial invoice not found' });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve PDF ─────────────────────────────────────────────────
router.get('/:invoiceId/pdf', async (req, res) => {
  try {
    const inv = await prisma.commercialInvoice.findUnique({
      where: { invoiceNumber: req.params.invoiceId },
      include: { company: true, items: true },
    });
    if (!inv) return res.status(404).json({ error: 'Commercial invoice not found' });

    const pdfBuffer = await _renderPdf(inv, inv.company);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${inv.invoiceNumber.replace(/\//g, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create Commercial/Proforma Invoice ───────────────────────
router.post('/', async (req, res) => {
  const {
    invoiceKind, invoiceDate, dueDate,
    exporterName, exporterAddress, exporterContact,
    clientName, clientAddress,
    outputCurrency, fxRate, fxRateDate,
    incoterms, paymentAdvancePct, paymentBalanceMode, paymentNetDays,
    bankAccountNumber, bankName, bankBranchAddress, swiftBicCode,
    purposeCode, declaration,
    // optional customs
    challanNumber, challanDate, lrNumber, transporterName, transportId, vehicleNumber,
    shippingBillNumber, shippingBillDate, placeOfPreCarriage, preCarriageBy,
    portOfLoading, countryOfOrigin, countryOfFinalDestination, shippingPortCode,
    vesselOrFlightNo, finalDestination,
    discount, roundOverride,
    items,
  } = req.body;

  if (!invoiceKind || !invoiceDate || !clientName || !clientAddress || !outputCurrency || !fxRate || !items?.length)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    const company = await prisma.company.findUnique({ where: { code: GMP_CODE } });
    if (!company) return res.status(404).json({ error: 'GMP company not found' });

    const calc           = calculateCommercialTotals(items, discount, roundOverride ?? null);
    const fxRateNum      = parseFloat(fxRate);
    const grandConverted = parseFloat((calc.grandTotal / fxRateNum).toFixed(2));
    const invoiceNumber  = await getNextCommercialInvoiceNumber(invoiceKind, invoiceDate, prisma);
    const advanceAmount  = calculateAdvanceAmount(calc.grandTotal, parseFloat(paymentAdvancePct) || 0);

    const sanitized = invoiceNumber.replace(/\//g, '_');
    const subDir    = invoiceKind.toUpperCase() === 'PROFORMA' ? 'Proforma' : 'Commercial';
    const localDir  = path.join(process.cwd(), `public/commercial-invoices/${subDir}`);
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

    const pdfData = {
      invoiceNumber, invoiceKind: invoiceKind.toUpperCase(), invoiceDate, dueDate,
      exporterName: exporterName || company.displayName,
      exporterAddress: exporterAddress || company.billingAddress,
      exporterContact: exporterContact || '',
      clientName, clientAddress,
      outputCurrency, fxRate: fxRateNum, fxRateDate,
      grandTotalConverted: grandConverted,
      incoterms, paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
      paymentAdvanceAmount: advanceAmount,
      paymentBalanceMode: paymentBalanceMode || 'ON_DELIVERY',
      paymentNetDays: paymentNetDays || null,
      bankAccountNumber: bankAccountNumber || company.accountNo,
      bankName: bankName || company.bankName,
      bankBranchAddress: bankBranchAddress || null,
      swiftBicCode: swiftBicCode || company.swiftBicCode || '',
      purposeCode: purposeCode || null,
      declaration: declaration || DEFAULT_DECLARATION,
      // customs (all optional)
      challanNumber, challanDate, lrNumber, transporterName, transportId, vehicleNumber,
      shippingBillNumber, shippingBillDate, placeOfPreCarriage, preCarriageBy,
      portOfLoading, countryOfOrigin, countryOfFinalDestination, shippingPortCode,
      vesselOrFlightNo, finalDestination,
      items: calc.processedItems,
      ...calc,
    };

    const pdfBuffer = await _renderPdf(pdfData, company);
    fs.writeFileSync(path.join(localDir, `${sanitized}.pdf`), pdfBuffer);
    const nc = await uploadToNextcloud(pdfBuffer, GMP_CODE, invoiceNumber, `CommercialInvoices/${subDir}`);

    const saved = await prisma.commercialInvoice.create({
      data: {
        companyId: company.id,
        invoiceNumber, invoiceKind: invoiceKind.toUpperCase(),
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        exporterName: pdfData.exporterName, exporterAddress: pdfData.exporterAddress, exporterContact: pdfData.exporterContact,
        clientName, clientAddress,
        outputCurrency, fxRate: fxRateNum, fxRateDate,
        subtotal: calc.subtotal, discountTotal: calc.discountTotal,
        roundAdjustment: calc.roundAdjustment, grandTotal: calc.grandTotal,
        grandTotalConverted: grandConverted, amountInWords: calc.amountInWords,
        incoterms: incoterms || null,
        paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
        paymentAdvanceAmount: advanceAmount,
        paymentBalanceMode: paymentBalanceMode || 'ON_DELIVERY',
        paymentNetDays: paymentNetDays || null,
        bankAccountNumber: pdfData.bankAccountNumber, bankName: pdfData.bankName,
        bankBranchAddress: pdfData.bankBranchAddress, swiftBicCode: pdfData.swiftBicCode,
        purposeCode: purposeCode || null,
        declaration: pdfData.declaration,
        challanNumber: challanNumber || null, challanDate: challanDate ? new Date(challanDate) : null,
        lrNumber: lrNumber || null, transporterName: transporterName || null,
        transportId: transportId || null, vehicleNumber: vehicleNumber || null,
        shippingBillNumber: shippingBillNumber || null, shippingBillDate: shippingBillDate ? new Date(shippingBillDate) : null,
        placeOfPreCarriage: placeOfPreCarriage || null, preCarriageBy: preCarriageBy || null,
        portOfLoading: portOfLoading || null,
        countryOfOrigin: countryOfOrigin || null, countryOfFinalDestination: countryOfFinalDestination || null,
        shippingPortCode: shippingPortCode || null, vesselOrFlightNo: vesselOrFlightNo || null,
        finalDestination: finalDestination || null,
        pdfPath: `/public/commercial-invoices/${subDir}/${sanitized}.pdf`,
        nextcloudPath: nc.nextcloudPath,
        status: 'ACTIVE',
        items: { create: calc.processedItems.map(it => ({
          lineNo: it.lineNo, description: it.description, uom: it.uom,
          qty: it.qty, rate: it.rate, amount: it.amount,
        })) },
      },
      include: { items: true },
    });

    await prisma.commercialInvoiceAuditLog.create({
      data: { invoiceNumber, invoiceId: saved.id, action: 'CREATE', details: JSON.stringify({ timestamp: new Date().toISOString() }) },
    });

    res.status(201).json(saved);
  } catch (err) {
    console.error('POST /api/commercial-invoices error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Update / Regenerate Commercial Invoice ───────────────────
router.put('/:invoiceId', async (req, res) => {
  const invoiceNumber = decodeURIComponent(req.params.invoiceId);
  const {
    invoiceKind, invoiceDate, dueDate,
    exporterName, exporterAddress, exporterContact,
    clientName, clientAddress,
    outputCurrency, fxRate, fxRateDate,
    incoterms, paymentAdvancePct, paymentBalanceMode, paymentNetDays,
    bankAccountNumber, bankName, bankBranchAddress, swiftBicCode,
    purposeCode, declaration,
    challanNumber, challanDate, lrNumber, transporterName, transportId, vehicleNumber,
    shippingBillNumber, shippingBillDate, placeOfPreCarriage, preCarriageBy,
    portOfLoading, countryOfOrigin, countryOfFinalDestination, shippingPortCode,
    vesselOrFlightNo, finalDestination,
    discount, roundOverride,
    items,
  } = req.body;

  if (!invoiceDate || !clientName || !clientAddress || !outputCurrency || !fxRate || !items?.length)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    const existing = await prisma.commercialInvoice.findUnique({
      where: { invoiceNumber },
      include: { company: true, items: true },
    });
    if (!existing) return res.status(404).json({ error: 'Commercial invoice not found' });

    const company        = existing.company;
    const calc           = calculateCommercialTotals(items, discount, roundOverride ?? null);
    const fxRateNum      = parseFloat(fxRate);
    const grandConverted = parseFloat((calc.grandTotal / fxRateNum).toFixed(2));
    const advanceAmount  = calculateAdvanceAmount(calc.grandTotal, parseFloat(paymentAdvancePct) || 0);

    const sanitized = invoiceNumber.replace(/\//g, '_');
    const subDir    = (existing.invoiceKind ?? invoiceKind ?? '').toUpperCase() === 'PROFORMA' ? 'Proforma' : 'Commercial';
    const localDir  = path.join(process.cwd(), `public/commercial-invoices/${subDir}`);
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

    // Delete old local PDF
    const oldPdfPath = path.join(localDir, `${sanitized}.pdf`);
    if (fs.existsSync(oldPdfPath)) fs.unlinkSync(oldPdfPath);

    const pdfData = {
      invoiceNumber, invoiceKind: existing.invoiceKind, invoiceDate, dueDate,
      exporterName: exporterName || company.displayName,
      exporterAddress: exporterAddress || company.billingAddress,
      exporterContact: exporterContact || '',
      clientName, clientAddress,
      outputCurrency, fxRate: fxRateNum, fxRateDate,
      grandTotalConverted: grandConverted,
      incoterms, paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
      paymentAdvanceAmount: advanceAmount,
      paymentBalanceMode: paymentBalanceMode || 'ON_DELIVERY',
      paymentNetDays: paymentNetDays || null,
      bankAccountNumber: bankAccountNumber || company.accountNo,
      bankName: bankName || company.bankName,
      bankBranchAddress: bankBranchAddress || null,
      swiftBicCode: swiftBicCode || company.swiftBicCode || '',
      purposeCode: purposeCode || null,
      declaration: declaration || DEFAULT_DECLARATION,
      challanNumber, challanDate, lrNumber, transporterName, transportId, vehicleNumber,
      shippingBillNumber, shippingBillDate, placeOfPreCarriage, preCarriageBy,
      portOfLoading, countryOfOrigin, countryOfFinalDestination, shippingPortCode,
      vesselOrFlightNo, finalDestination,
      items: calc.processedItems,
      ...calc,
    };

    const pdfBuffer = await _renderPdf(pdfData, company);
    fs.writeFileSync(path.join(localDir, `${sanitized}.pdf`), pdfBuffer);
    const nc = await uploadToNextcloud(pdfBuffer, GMP_CODE, invoiceNumber, `CommercialInvoices/${subDir}`);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.commercialInvoiceItem.deleteMany({ where: { invoiceId: existing.id } });
      return tx.commercialInvoice.update({
        where: { id: existing.id },
        data: {
          invoiceDate: new Date(invoiceDate),
          dueDate: dueDate ? new Date(dueDate) : null,
          exporterName: pdfData.exporterName, exporterAddress: pdfData.exporterAddress, exporterContact: pdfData.exporterContact,
          clientName, clientAddress,
          outputCurrency, fxRate: fxRateNum, fxRateDate,
          subtotal: calc.subtotal, discountTotal: calc.discountTotal,
          roundAdjustment: calc.roundAdjustment, grandTotal: calc.grandTotal,
          grandTotalConverted: grandConverted, amountInWords: calc.amountInWords,
          incoterms: incoterms || null,
          paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
          paymentAdvanceAmount: advanceAmount,
          paymentBalanceMode: paymentBalanceMode || 'ON_DELIVERY',
          paymentNetDays: paymentNetDays || null,
          bankAccountNumber: pdfData.bankAccountNumber, bankName: pdfData.bankName,
          bankBranchAddress: pdfData.bankBranchAddress, swiftBicCode: pdfData.swiftBicCode,
          purposeCode: purposeCode || null,
          declaration: pdfData.declaration,
          challanNumber: challanNumber || null, challanDate: challanDate ? new Date(challanDate) : null,
          lrNumber: lrNumber || null, transporterName: transporterName || null,
          transportId: transportId || null, vehicleNumber: vehicleNumber || null,
          shippingBillNumber: shippingBillNumber || null, shippingBillDate: shippingBillDate ? new Date(shippingBillDate) : null,
          placeOfPreCarriage: placeOfPreCarriage || null, preCarriageBy: preCarriageBy || null,
          portOfLoading: portOfLoading || null,
          countryOfOrigin: countryOfOrigin || null, countryOfFinalDestination: countryOfFinalDestination || null,
          shippingPortCode: shippingPortCode || null, vesselOrFlightNo: vesselOrFlightNo || null,
          finalDestination: finalDestination || null,
          pdfPath: `/public/commercial-invoices/${subDir}/${sanitized}.pdf`,
          nextcloudPath: nc.nextcloudPath,
          items: { create: calc.processedItems.map(it => ({
            lineNo: it.lineNo, description: it.description, uom: it.uom,
            qty: it.qty, rate: it.rate, amount: it.amount,
          })) },
        },
        include: { items: true },
      });
    });

    await prisma.commercialInvoiceAuditLog.create({
      data: { invoiceNumber, invoiceId: existing.id, action: 'UPDATE', details: JSON.stringify({ timestamp: new Date().toISOString() }) },
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /api/commercial-invoices error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Cancel Commercial Invoice ─────────────────────────────────

router.post('/:invoiceId/cancel', async (req, res) => {
  try {
    const existing = await prisma.commercialInvoice.findUnique({ where: { invoiceNumber: req.params.invoiceId } });
    if (!existing) return res.status(404).json({ error: 'Commercial invoice not found' });

    const cancelled = await prisma.commercialInvoice.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
    await prisma.commercialInvoiceAuditLog.create({
      data: { invoiceNumber: existing.invoiceNumber, invoiceId: existing.id, action: 'CANCEL', details: JSON.stringify({ timestamp: new Date().toISOString() }) },
    });
    res.json(cancelled);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function _renderPdf(data, company) {
  const templatePath = path.join(process.cwd(), 'templates/CommercialInvoice_template.html');
  return generateInvoicePdf({ ...data, company, _templatePath: templatePath });
}

export default router;
