import express from 'express';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  getNextExportQuoteNumber,
  calculateExportTotals,
  calculateAdvanceAmount,
  FORCE_MAJEURE_BOILERPLATE,
} from '../utils/exportQuotationUtils.js';
import { getFiscalYear } from '../utils/sharedFinancialUtils.js';
import { generateInvoicePdf } from '../utils/pdfRenderer.js';
import { uploadToNextcloud } from '../utils/nextcloudClient.js';

const router = express.Router();
const prisma = new PrismaClient();
const GMP_CODE = 'GMP';

// ── Preview next Export Quote number ─────────────────────────
router.get('/preview-next', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date is required' });

  try {
    const fy = getFiscalYear(date);
    const seq = await prisma.exportQuotationSequence.findUnique({ where: { fiscalYear: fy } });
    const nextVal = (seq?.currentVal ?? 0) + 1;
    res.json({ nextQuoteNumber: `GMP/EXQ/${fy}/${String(nextVal).padStart(4, '0')}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── List Export Quotations ────────────────────────────────────
router.get('/', async (req, res) => {
  const { search, status } = req.query;
  try {
    const where = { company: { code: GMP_CODE } };
    if (status) where.status = status.toUpperCase();
    if (search) where.OR = [
      { quoteNumber:  { contains: search } },
      { clientName:   { contains: search } },
      { clientCountry:{ contains: search } },
    ];

    const quotes = await prisma.exportQuotation.findMany({
      where,
      include: { company: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single Export Quotation ───────────────────────────────
router.get('/:quoteId', async (req, res) => {
  try {
    const q = await prisma.exportQuotation.findUnique({
      where: { quoteNumber: req.params.quoteId },
      include: { company: true, items: true, auditLogs: true },
    });
    if (!q) return res.status(404).json({ error: 'Export quotation not found' });
    res.json(q);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve PDF ─────────────────────────────────────────────────
router.get('/:quoteId/pdf', async (req, res) => {
  try {
    const q = await prisma.exportQuotation.findUnique({
      where: { quoteNumber: req.params.quoteId },
      include: { company: true, items: true },
    });
    if (!q) return res.status(404).json({ error: 'Export quotation not found' });

    const pdfBuffer = await _renderPdf(q, q.company);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${q.quoteNumber.replace(/\//g, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create Export Quotation ───────────────────────────────────
router.post('/', async (req, res) => {
  const {
    quoteDate, clientName, clientAddress, clientCountry,
    dispatchMethod, shipmentType, portOfLoading, portOfDischarge, incoterms,
    paymentAdvancePct, paymentBalanceMode, paymentNetDays,
    outputCurrency, fxRate, fxRateDate,
    discount, roundOverride,
    additionalInfo, forceMajeureClause, includeForceMajeure,
    items,
  } = req.body;

  if (!quoteDate || !clientName || !clientAddress || !clientCountry || !dispatchMethod || !outputCurrency || !fxRate || !items?.length)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    const company = await prisma.company.findUnique({ where: { code: GMP_CODE } });
    if (!company) return res.status(404).json({ error: 'GMP company not found' });

    const calc           = calculateExportTotals(items, discount, roundOverride ?? null);
    const fxRateNum      = parseFloat(fxRate);
    const grandConverted = parseFloat((calc.grandTotal / fxRateNum).toFixed(2));
    const quoteNumber    = await getNextExportQuoteNumber(quoteDate, prisma);
    const advanceAmount  = calculateAdvanceAmount(calc.grandTotal, parseFloat(paymentAdvancePct) || 0);
    const majeureText    = forceMajeureClause ?? FORCE_MAJEURE_BOILERPLATE;

    const sanitized = quoteNumber.replace(/\//g, '_');
    const localDir  = path.join(process.cwd(), `public/export-quotations`);
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

    const pdfData = {
      quoteNumber, quoteDate, clientName, clientAddress, clientCountry,
      dispatchMethod, shipmentType, portOfLoading, portOfDischarge, incoterms,
      paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
      paymentAdvanceAmount: advanceAmount,
      paymentBalanceMode: paymentBalanceMode || 'ON_DELIVERY',
      paymentNetDays: paymentNetDays || null,
      outputCurrency, fxRate: fxRateNum, fxRateDate,
      grandTotalConverted: grandConverted,
      additionalInfo, forceMajeureClause: majeureText,
      includeForceMajeure: includeForceMajeure !== false,
      items: calc.processedItems,
      ...calc,
    };

    const pdfBuffer = await _renderPdf(pdfData, company);
    fs.writeFileSync(path.join(localDir, `${sanitized}.pdf`), pdfBuffer);
    const nc = await uploadToNextcloud(pdfBuffer, GMP_CODE, quoteNumber, 'ExportQuotations');

    const saved = await prisma.exportQuotation.create({
      data: {
        companyId: company.id,
        quoteNumber, quoteDate: new Date(quoteDate),
        clientName, clientAddress, clientCountry,
        dispatchMethod, shipmentType: shipmentType || null,
        portOfLoading: portOfLoading || null, portOfDischarge: portOfDischarge || null,
        incoterms: incoterms || null,
        paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
        paymentAdvanceAmount: advanceAmount,
        paymentBalanceMode: paymentBalanceMode || 'ON_DELIVERY',
        paymentNetDays: paymentNetDays || null,
        outputCurrency, fxRate: fxRateNum, fxRateDate,
        subtotal: calc.subtotal, discountTotal: calc.discountTotal,
        roundAdjustment: calc.roundAdjustment, grandTotal: calc.grandTotal,
        grandTotalConverted: grandConverted,
        amountInWords: calc.amountInWords,
        additionalInfo: additionalInfo || null,
        forceMajeureClause: majeureText,
        includeForceMajeure: includeForceMajeure !== false,
        pdfPath: `/public/export-quotations/${sanitized}.pdf`,
        nextcloudPath: nc.nextcloudPath,
        status: 'ACTIVE',
        items: { create: calc.processedItems.map(it => ({
          lineNo: it.lineNo, description: it.description, uom: it.uom,
          qty: it.qty, rate: it.rate, amount: it.amount,
        })) },
      },
      include: { items: true },
    });

    await prisma.exportQuotationAuditLog.create({
      data: { quoteNumber, quotationId: saved.id, action: 'CREATE', details: JSON.stringify({ timestamp: new Date().toISOString() }) },
    });

    res.status(201).json(saved);
  } catch (err) {
    console.error('POST /api/export-quotations error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Update / Regenerate Export Quotation ─────────────────────
router.put('/:quoteId', async (req, res) => {
  const quoteNumber = decodeURIComponent(req.params.quoteId);
  const {
    quoteDate, clientName, clientAddress, clientCountry,
    dispatchMethod, shipmentType, portOfLoading, portOfDischarge, incoterms,
    paymentAdvancePct, paymentBalanceMode, paymentNetDays,
    outputCurrency, fxRate, fxRateDate,
    discount, roundOverride,
    additionalInfo, forceMajeureClause, includeForceMajeure,
    items,
  } = req.body;

  if (!quoteDate || !clientName || !clientAddress || !clientCountry || !dispatchMethod || !outputCurrency || !fxRate || !items?.length)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    const existing = await prisma.exportQuotation.findUnique({
      where: { quoteNumber },
      include: { company: true, items: true },
    });
    if (!existing) return res.status(404).json({ error: 'Export quotation not found' });

    const company = existing.company;
    const calc           = calculateExportTotals(items, discount, roundOverride ?? null);
    const fxRateNum      = parseFloat(fxRate);
    const grandConverted = parseFloat((calc.grandTotal / fxRateNum).toFixed(2));
    const advanceAmount  = calculateAdvanceAmount(calc.grandTotal, parseFloat(paymentAdvancePct) || 0);
    const majeureText    = forceMajeureClause ?? FORCE_MAJEURE_BOILERPLATE;

    const sanitized = quoteNumber.replace(/\//g, '_');
    const localDir  = path.join(process.cwd(), `public/export-quotations`);
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

    // Delete old local PDF if it exists
    const oldPdfPath = path.join(localDir, `${sanitized}.pdf`);
    if (fs.existsSync(oldPdfPath)) fs.unlinkSync(oldPdfPath);

    const pdfData = {
      quoteNumber, quoteDate, clientName, clientAddress, clientCountry,
      dispatchMethod, shipmentType, portOfLoading, portOfDischarge, incoterms,
      paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
      paymentAdvanceAmount: advanceAmount,
      paymentBalanceMode: paymentBalanceMode || 'ON_DELIVERY',
      paymentNetDays: paymentNetDays || null,
      outputCurrency, fxRate: fxRateNum, fxRateDate,
      grandTotalConverted: grandConverted,
      additionalInfo, forceMajeureClause: majeureText,
      includeForceMajeure: includeForceMajeure !== false,
      items: calc.processedItems,
      ...calc,
    };

    const pdfBuffer = await _renderPdf(pdfData, company);
    fs.writeFileSync(path.join(localDir, `${sanitized}.pdf`), pdfBuffer);
    const nc = await uploadToNextcloud(pdfBuffer, GMP_CODE, quoteNumber, 'ExportQuotations');

    const updated = await prisma.$transaction(async (tx) => {
      await tx.exportQuotationItem.deleteMany({ where: { quotationId: existing.id } });
      return tx.exportQuotation.update({
        where: { id: existing.id },
        data: {
          quoteDate: new Date(quoteDate),
          clientName, clientAddress, clientCountry,
          dispatchMethod, shipmentType: shipmentType || null,
          portOfLoading: portOfLoading || null, portOfDischarge: portOfDischarge || null,
          incoterms: incoterms || null,
          paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
          paymentAdvanceAmount: advanceAmount,
          paymentBalanceMode: paymentBalanceMode || 'ON_DELIVERY',
          paymentNetDays: paymentNetDays || null,
          outputCurrency, fxRate: fxRateNum, fxRateDate,
          subtotal: calc.subtotal, discountTotal: calc.discountTotal,
          roundAdjustment: calc.roundAdjustment, grandTotal: calc.grandTotal,
          grandTotalConverted: grandConverted, amountInWords: calc.amountInWords,
          additionalInfo: additionalInfo || null,
          forceMajeureClause: majeureText,
          includeForceMajeure: includeForceMajeure !== false,
          pdfPath: `/public/export-quotations/${sanitized}.pdf`,
          nextcloudPath: nc.nextcloudPath,
          items: { create: calc.processedItems.map(it => ({
            lineNo: it.lineNo, description: it.description, uom: it.uom,
            qty: it.qty, rate: it.rate, amount: it.amount,
          })) },
        },
        include: { items: true },
      });
    });

    await prisma.exportQuotationAuditLog.create({
      data: { quoteNumber, quotationId: existing.id, action: 'UPDATE', details: JSON.stringify({ timestamp: new Date().toISOString() }) },
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /api/export-quotations error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Cancel Export Quotation ───────────────────────────────────

router.post('/:quoteId/cancel', async (req, res) => {
  try {
    const existing = await prisma.exportQuotation.findUnique({ where: { quoteNumber: req.params.quoteId } });
    if (!existing) return res.status(404).json({ error: 'Export quotation not found' });

    const cancelled = await prisma.exportQuotation.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
    await prisma.exportQuotationAuditLog.create({
      data: { quoteNumber: existing.quoteNumber, quotationId: existing.id, action: 'CANCEL', details: JSON.stringify({ timestamp: new Date().toISOString() }) },
    });
    res.json(cancelled);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function _renderPdf(data, company) {
  const templatePath = path.join(process.cwd(), 'templates/ExportQuotation_template.html');
  return generateInvoicePdf({ ...data, company, _templatePath: templatePath });
}

export default router;
