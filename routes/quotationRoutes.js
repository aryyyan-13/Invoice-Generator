import express from 'express';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { calculateQuotationTotals, getNextQuotationNumber, calculateAdvanceAmount, FORCE_MAJEURE_BOILERPLATE } from '../utils/quotationUtils.js';
import { getFiscalYear } from '../utils/sharedFinancialUtils.js';
import { generateInvoicePdf } from '../utils/pdfRenderer.js';
import { uploadToNextcloud } from '../utils/nextcloudClient.js';

const router = express.Router();
const prisma = new PrismaClient();

// ── Preview next Quotation number ────────────────────────────
router.get('/preview-next', async (req, res) => {
  const { companyCode, quotationType, date } = req.query;
  if (!companyCode || !quotationType || !date)
    return res.status(400).json({ error: 'companyCode, quotationType, and date are required' });

  try {
    const company = await prisma.company.findUnique({ where: { code: companyCode.toUpperCase() } });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const fy = getFiscalYear(date);
    const typeCode = quotationType.toUpperCase() === 'GOODS' ? 'GDS' : 'SVC';
    const seq = await prisma.quotationSequence.findUnique({
      where: { companyCode_quotationType_fiscalYear: { companyCode: company.code, quotationType: quotationType.toUpperCase(), fiscalYear: fy } }
    });
    const nextVal = (seq?.currentVal ?? 0) + 1;
    const nextQuotationNumber = `${company.invoicePrefix}/QT/${typeCode}/${fy}/${String(nextVal).padStart(4, '0')}`;
    res.json({ nextQuotationNumber, nextVal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── List Quotations ──────────────────────────────────────────
router.get('/', async (req, res) => {
  const { search, companyCode, quotationType, status } = req.query;
  try {
    const where = {};
    if (status)        where.status        = status.toUpperCase();
    if (quotationType) where.quotationType = quotationType.toUpperCase();
    if (companyCode)   where.company       = { code: companyCode.toUpperCase() };
    if (search)        where.OR            = [
      { quotationNumber: { contains: search } },
      { clientName:      { contains: search } },
    ];

    const quotations = await prisma.quotation.findMany({
      where,
      include: { company: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(quotations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single Quotation ─────────────────────────────────────
router.get('/:prefix/:type/:fy/:seq', async (req, res) => {
  const quotationNumber = `${req.params.prefix}/QT/${req.params.type}/${req.params.fy}/${req.params.seq}`;
  try {
    const q = await prisma.quotation.findUnique({
      where: { quotationNumber },
      include: { company: true, items: true, auditLogs: true },
    });
    if (!q) return res.status(404).json({ error: 'Quotation not found' });
    res.json(q);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve Quotation PDF ──────────────────────────────────────
router.get('/:prefix/:type/:fy/:seq/pdf', async (req, res) => {
  const quotationNumber = `${req.params.prefix}/QT/${req.params.type}/${req.params.fy}/${req.params.seq}`;
  try {
    const q = await prisma.quotation.findUnique({ where: { quotationNumber }, include: { company: true, items: true } });
    if (!q) return res.status(404).json({ error: 'Quotation not found' });

    const pdfBuffer = await _renderQuotationPdf(q, q.company);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quotationNumber.replace(/\//g, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create Quotation ─────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    companyCode, quotationType, quotationDate,
    clientName, clientGstin, clientAddress, clientContactNo,
    attentionSalutation, attentionName,
    paymentAdvancePct, paymentBalanceMode, paymentNetDays,
    termsAndConditions, forceMajeureClause,
    discount, roundOverride,
    items,
  } = req.body;

  if (!companyCode || !quotationType || !quotationDate || !clientName || !clientAddress || !items?.length)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    const company = await prisma.company.findUnique({ where: { code: companyCode.toUpperCase() } });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const calc = calculateQuotationTotals(company.gstin, clientGstin, items, discount, roundOverride ?? null);
    const quotationNumber = await getNextQuotationNumber(company.code, company.invoicePrefix, quotationType.toUpperCase(), quotationDate, prisma);
    const advanceAmount = calculateAdvanceAmount(calc.grandTotal, parseFloat(paymentAdvancePct) || 0);

    const sanitized = quotationNumber.replace(/\//g, '_');
    const localDir  = path.join(process.cwd(), `public/quotations/${company.code}`);
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

    const majeureText = forceMajeureClause ?? FORCE_MAJEURE_BOILERPLATE;

    const pdfBuffer = await _renderQuotationPdf({
      quotationNumber, quotationType: quotationType.toUpperCase(), quotationDate,
      clientName, clientGstin, clientAddress, clientContactNo,
      attentionSalutation, attentionName,
      paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
      paymentAdvanceAmount: advanceAmount,
      paymentBalanceMode: paymentBalanceMode || 'ON_DELIVERY',
      paymentNetDays: paymentNetDays || null,
      termsAndConditions, forceMajeureClause: majeureText,
      items: calc.processedItems,
      ...calc,
    }, company);

    fs.writeFileSync(path.join(localDir, `${sanitized}.pdf`), pdfBuffer);
    const nc = await uploadToNextcloud(pdfBuffer, company.code, quotationNumber, 'Quotations');

    const saved = await prisma.quotation.create({
      data: {
        companyId: company.id,
        quotationNumber, quotationType: quotationType.toUpperCase(),
        quotationDate: new Date(quotationDate),
        clientName, clientGstin: clientGstin || 'URD', clientAddress,
        clientContactNo: clientContactNo || '',
        attentionSalutation: attentionSalutation || 'Mr.',
        attentionName: attentionName || '',
        paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
        paymentAdvanceAmount: advanceAmount,
        paymentBalanceMode: paymentBalanceMode || 'ON_DELIVERY',
        paymentNetDays: paymentNetDays || null,
        termsAndConditions: termsAndConditions || null,
        forceMajeureClause: majeureText,
        subtotal: calc.subtotal, discountTotal: calc.discountTotal,
        cgstTotal: calc.cgstTotal, sgstTotal: calc.sgstTotal, igstTotal: calc.igstTotal,
        roundAdjustment: calc.roundAdjustment,
        grandTotal: calc.grandTotal, amountInWords: calc.amountInWords,
        pdfPath: `/public/quotations/${company.code}/${sanitized}.pdf`,
        nextcloudPath: nc.nextcloudPath,
        status: 'ACTIVE',
        items: {
          create: calc.processedItems.map(item => ({
            lineNo: item.lineNo, description: item.description, uom: item.uom,
            qty: item.qty, rate: item.rate, amount: item.amount, taxRate: item.taxRate,
            cgstRate: item.cgstRate, sgstRate: item.sgstRate, igstRate: item.igstRate,
            cgstAmount: item.cgstAmount, sgstAmount: item.sgstAmount, igstAmount: item.igstAmount,
          })),
        },
      },
      include: { items: true },
    });

    await prisma.quotationAuditLog.create({
      data: { quotationNumber, quotationId: saved.id, action: 'CREATE', details: JSON.stringify({ timestamp: new Date().toISOString() }) }
    });

    res.status(201).json(saved);
  } catch (err) {
    console.error('POST /api/quotations error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Edit / Regenerate Quotation ──────────────────────────────
router.put('/:prefix/:type/:fy/:seq', async (req, res) => {
  const quotationNumber = `${req.params.prefix}/QT/${req.params.type}/${req.params.fy}/${req.params.seq}`;
  try {
    const existing = await prisma.quotation.findUnique({ where: { quotationNumber }, include: { company: true } });
    if (!existing) return res.status(404).json({ error: 'Quotation not found' });
    if (existing.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot edit a cancelled quotation' });

    const { items, discount, roundOverride, ...fields } = req.body;
    const calc = calculateQuotationTotals(existing.company.gstin, fields.clientGstin ?? existing.clientGstin, items ?? [], discount, roundOverride ?? null);

    const pdfBuffer = await _renderQuotationPdf({ ...existing, ...fields, items: calc.processedItems, ...calc }, existing.company);
    fs.writeFileSync(path.join(process.cwd(), existing.pdfPath), pdfBuffer);
    const nc = await uploadToNextcloud(pdfBuffer, existing.company.code, quotationNumber, 'Quotations');

    const updated = await prisma.quotation.update({
      where: { id: existing.id },
      data: {
        ...fields,
        subtotal: calc.subtotal, discountTotal: calc.discountTotal,
        cgstTotal: calc.cgstTotal, sgstTotal: calc.sgstTotal, igstTotal: calc.igstTotal,
        roundAdjustment: calc.roundAdjustment,
        grandTotal: calc.grandTotal, amountInWords: calc.amountInWords,
        nextcloudPath: nc.nextcloudPath,
        items: {
          deleteMany: {},
          create: calc.processedItems.map(item => ({
            lineNo: item.lineNo, description: item.description, uom: item.uom,
            qty: item.qty, rate: item.rate, amount: item.amount, taxRate: item.taxRate,
            cgstRate: item.cgstRate, sgstRate: item.sgstRate, igstRate: item.igstRate,
            cgstAmount: item.cgstAmount, sgstAmount: item.sgstAmount, igstAmount: item.igstAmount,
          })),
        },
      },
      include: { items: true },
    });

    await prisma.quotationAuditLog.create({
      data: { quotationNumber, quotationId: existing.id, action: 'REGENERATE', details: JSON.stringify({ timestamp: new Date().toISOString() }) }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Cancel Quotation ─────────────────────────────────────────
router.post('/:prefix/:type/:fy/:seq/cancel', async (req, res) => {
  const quotationNumber = `${req.params.prefix}/QT/${req.params.type}/${req.params.fy}/${req.params.seq}`;
  try {
    const existing = await prisma.quotation.findUnique({ where: { quotationNumber } });
    if (!existing) return res.status(404).json({ error: 'Quotation not found' });

    const cancelled = await prisma.quotation.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
    await prisma.quotationAuditLog.create({
      data: { quotationNumber, quotationId: existing.id, action: 'CANCEL', details: JSON.stringify({ timestamp: new Date().toISOString() }) }
    });

    res.json(cancelled);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function _renderQuotationPdf(quotationData, company) {
  const templatePath = path.join(process.cwd(), 'templates/Quotation_template.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error('Quotation_template.html not found. Please add it to the templates/ directory.');
  }
  return generateInvoicePdf({ ...quotationData, company, _templatePath: templatePath });
}

export default router;
