import express from 'express';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { calculatePOTotals, getNextPoNumber } from '../utils/poUtils.js';
import { getFiscalYear } from '../utils/sharedFinancialUtils.js';
import { generateInvoicePdf } from '../utils/pdfRenderer.js';
import { uploadToNextcloud } from '../utils/nextcloudClient.js';

const router = express.Router();
const prisma = new PrismaClient();

// ── Preview next PO number ────────────────────────────────────
router.get('/preview-next', async (req, res) => {
  const { companyCode, poType, date } = req.query;
  if (!companyCode || !poType || !date)
    return res.status(400).json({ error: 'companyCode, poType, and date are required' });

  try {
    const company = await prisma.company.findUnique({ where: { code: companyCode.toUpperCase() } });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const fy = getFiscalYear(date);
    const typeCode = poType.toUpperCase() === 'GOODS' ? 'GDS' : 'SVC';
    const seq = await prisma.pOSequence.findUnique({
      where: { companyCode_poType_fiscalYear: { companyCode: company.code, poType: poType.toUpperCase(), fiscalYear: fy } }
    });
    const nextVal = (seq?.currentVal ?? 0) + 1;
    const nextPoNumber = `${company.invoicePrefix}/PO/${typeCode}/${fy}/${String(nextVal).padStart(4, '0')}`;
    res.json({ nextPoNumber, nextVal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── List POs ──────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { search, companyCode, poType, status } = req.query;
  try {
    const where = {};
    if (status)      where.status  = status.toUpperCase();
    if (poType)      where.poType  = poType.toUpperCase();
    if (companyCode) where.company = { code: companyCode.toUpperCase() };
    if (search)      where.OR = [
      { poNumber:   { contains: search } },
      { vendorName: { contains: search } },
    ];

    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: { company: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(pos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single PO ─────────────────────────────────────────────
router.get('/:prefix/:type/:fy/:seq', async (req, res) => {
  const poNumber = `${req.params.prefix}/PO/${req.params.type}/${req.params.fy}/${req.params.seq}`;
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { poNumber },
      include: { company: true, items: true, auditLogs: true },
    });
    if (!po) return res.status(404).json({ error: 'PO not found' });
    res.json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve PO PDF ──────────────────────────────────────────────
router.get('/:prefix/:type/:fy/:seq/pdf', async (req, res) => {
  const poNumber = `${req.params.prefix}/PO/${req.params.type}/${req.params.fy}/${req.params.seq}`;
  try {
    const po = await prisma.purchaseOrder.findUnique({ where: { poNumber }, include: { company: true, items: true } });
    if (!po) return res.status(404).json({ error: 'PO not found' });

    const pdfBuffer = await _renderPOPdf(po, po.company);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${poNumber.replace(/\//g, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create PO ─────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    companyCode, poType, poDate,
    vendorName, vendorContact, vendorAddress, vendorGstin,
    paymentAdvancePct, paymentBalanceMode, paymentNetDays,
    deliveryScope, deliveryNotes, termsAndConditions,
    discount, pfCharges, roundOverride,
    items,
  } = req.body;

  if (!companyCode || !poType || !poDate || !vendorName || !vendorAddress || !items?.length)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    const company = await prisma.company.findUnique({ where: { code: companyCode.toUpperCase() } });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const calc = calculatePOTotals(company.gstin, vendorGstin, items, discount, pfCharges, roundOverride ?? null, poType.toUpperCase());
    const poNumber = await getNextPoNumber(company.code, company.invoicePrefix, poType.toUpperCase(), poDate, prisma);

    const sanitized = poNumber.replace(/\//g, '_');
    const localDir  = path.join(process.cwd(), `public/pos/${company.code}`);
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    const localPath = path.join(localDir, `${sanitized}.pdf`);

    const advanceAmount = calc.grandTotal * ((parseFloat(paymentAdvancePct) || 0) / 100);

    const pdfBuffer = await _renderPOPdf({
      poNumber, poType: poType.toUpperCase(), poDate,
      vendorName, vendorContact, vendorAddress, vendorGstin,
      paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
      paymentAdvanceAmount: parseFloat(advanceAmount.toFixed(2)),
      paymentBalanceMode: paymentBalanceMode || 'ON_DELIVERY',
      paymentNetDays: paymentNetDays || null,
      deliveryScope: deliveryScope || 'BUYER',
      deliveryNotes, termsAndConditions,
      items: calc.processedItems,
      ...calc,
    }, company);

    fs.writeFileSync(localPath, pdfBuffer);
    const nc = await uploadToNextcloud(pdfBuffer, company.code, poNumber, 'PurchaseOrders');

    const savedPO = await prisma.purchaseOrder.create({
      data: {
        companyId: company.id,
        poNumber, poType: poType.toUpperCase(),
        poDate: new Date(poDate),
        vendorName, vendorContact, vendorAddress, vendorGstin: vendorGstin || null,
        paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
        paymentAdvanceAmount: parseFloat(advanceAmount.toFixed(2)),
        paymentBalanceMode: paymentBalanceMode || 'ON_DELIVERY',
        paymentNetDays: paymentNetDays || null,
        deliveryScope: deliveryScope || 'BUYER',
        deliveryNotes: deliveryNotes || null,
        termsAndConditions: termsAndConditions || null,
        subtotal: calc.subtotal, discountTotal: calc.discountTotal,
        cgstTotal: calc.cgstTotal, sgstTotal: calc.sgstTotal, igstTotal: calc.igstTotal,
        pfTotal: calc.pfTotal, roundAdjustment: calc.roundAdjustment,
        grandTotal: calc.grandTotal, amountInWords: calc.amountInWords,
        pdfPath: `/public/pos/${company.code}/${sanitized}.pdf`,
        nextcloudPath: nc.nextcloudPath,
        status: 'ACTIVE',
        items: {
          create: calc.processedItems.map(item => ({
            lineNo: item.lineNo, description: item.description,
            hsnOrSacCode: item.hsnOrSacCode, uom: item.uom,
            qty: item.qty, rate: item.rate, amount: item.amount, taxRate: item.taxRate,
            cgstRate: item.cgstRate, sgstRate: item.sgstRate, igstRate: item.igstRate,
            cgstAmount: item.cgstAmount, sgstAmount: item.sgstAmount, igstAmount: item.igstAmount,
          })),
        },
      },
      include: { items: true },
    });

    await prisma.pOAuditLog.create({
      data: { poNumber, poId: savedPO.id, action: 'CREATE', details: JSON.stringify({ timestamp: new Date().toISOString() }) }
    });

    res.status(201).json(savedPO);
  } catch (err) {
    console.error('POST /api/po error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Edit / Regenerate PO ──────────────────────────────────────
router.put('/:prefix/:type/:fy/:seq', async (req, res) => {
  const poNumber = `${req.params.prefix}/PO/${req.params.type}/${req.params.fy}/${req.params.seq}`;
  try {
    const existing = await prisma.purchaseOrder.findUnique({ where: { poNumber }, include: { company: true } });
    if (!existing) return res.status(404).json({ error: 'PO not found' });
    if (existing.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot edit a cancelled PO' });

    const { items, discount, pfCharges, roundOverride, ...fields } = req.body;
    const calc = calculatePOTotals(existing.company.gstin, fields.vendorGstin ?? existing.vendorGstin, items ?? [], discount, pfCharges, roundOverride ?? null, existing.poType);

    const pdfBuffer = await _renderPOPdf({ ...existing, ...fields, items: calc.processedItems, ...calc }, existing.company);
    const sanitized = poNumber.replace(/\//g, '_');
    fs.writeFileSync(path.join(process.cwd(), existing.pdfPath), pdfBuffer);
    const nc = await uploadToNextcloud(pdfBuffer, existing.company.code, poNumber, 'PurchaseOrders');

    const updated = await prisma.purchaseOrder.update({
      where: { id: existing.id },
      data: {
        ...fields,
        subtotal: calc.subtotal, discountTotal: calc.discountTotal,
        cgstTotal: calc.cgstTotal, sgstTotal: calc.sgstTotal, igstTotal: calc.igstTotal,
        pfTotal: calc.pfTotal, roundAdjustment: calc.roundAdjustment,
        grandTotal: calc.grandTotal, amountInWords: calc.amountInWords,
        nextcloudPath: nc.nextcloudPath,
        items: {
          deleteMany: {},
          create: calc.processedItems.map(item => ({
            lineNo: item.lineNo, description: item.description,
            hsnOrSacCode: item.hsnOrSacCode, uom: item.uom,
            qty: item.qty, rate: item.rate, amount: item.amount, taxRate: item.taxRate,
            cgstRate: item.cgstRate, sgstRate: item.sgstRate, igstRate: item.igstRate,
            cgstAmount: item.cgstAmount, sgstAmount: item.sgstAmount, igstAmount: item.igstAmount,
          })),
        },
      },
      include: { items: true },
    });

    await prisma.pOAuditLog.create({
      data: { poNumber, poId: existing.id, action: 'REGENERATE', details: JSON.stringify({ timestamp: new Date().toISOString() }) }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Cancel PO ─────────────────────────────────────────────────
router.post('/:prefix/:type/:fy/:seq/cancel', async (req, res) => {
  const poNumber = `${req.params.prefix}/PO/${req.params.type}/${req.params.fy}/${req.params.seq}`;
  try {
    const existing = await prisma.purchaseOrder.findUnique({ where: { poNumber } });
    if (!existing) return res.status(404).json({ error: 'PO not found' });

    const cancelled = await prisma.purchaseOrder.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
    await prisma.pOAuditLog.create({
      data: { poNumber, poId: existing.id, action: 'CANCEL', details: JSON.stringify({ timestamp: new Date().toISOString() }) }
    });

    res.json(cancelled);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PDF render helper (internal) ──────────────────────────────
// ponytail: reuses pdfRenderer.js via a different template path
async function _renderPOPdf(poData, company) {
  const templatePath = path.join(process.cwd(), 'templates/PO_template.html');
  // Fall back gracefully if the template hasn't been designed yet
  if (!fs.existsSync(templatePath)) {
    throw new Error('PO_template.html not found. Please add it to the templates/ directory.');
  }
  return generateInvoicePdf({ ...poData, company, _templatePath: templatePath });
}

export default router;
