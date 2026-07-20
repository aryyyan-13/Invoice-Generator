import { getFiscalYear, convertNumberToWords } from './sharedFinancialUtils.js';

/**
 * Atomically generates the next Commercial/Proforma Invoice number.
 * COMMERCIAL → GMP/CI/{FY}/{SEQ padded to 4}
 * PROFORMA   → GMP/PI/{FY}/{SEQ padded to 4}
 */
export async function getNextCommercialInvoiceNumber(invoiceKind, date, prisma) {
  const fy      = getFiscalYear(date);
  const kind    = invoiceKind.toUpperCase(); // COMMERCIAL | PROFORMA
  const prefix  = kind === 'PROFORMA' ? 'PI' : 'CI';

  const seq = await prisma.commercialInvoiceSequence.upsert({
    where:  { invoiceKind_fiscalYear: { invoiceKind: kind, fiscalYear: fy } },
    update: { currentVal: { increment: 1 } },
    create: { invoiceKind: kind, fiscalYear: fy, currentVal: 1 },
  });
  return `GMP/${prefix}/${fy}/${String(seq.currentVal).padStart(4, '0')}`;
}

/**
 * Calculates commercial/proforma invoice totals (no GST — export documents).
 */
export function calculateCommercialTotals(items, discountInput = 0, roundOverride = null) {
  const processedItems = items.map((item, i) => {
    const qty    = parseFloat(item.qty)  || 0;
    const rate   = parseFloat(item.rate) || 0;
    const amount = qty * rate;
    return { lineNo: i + 1, description: item.description, uom: item.uom, qty, rate, amount };
  });

  const subtotal      = processedItems.reduce((s, it) => s + it.amount, 0);
  const discountTotal = parseFloat(discountInput) || 0;
  const taxableValue  = subtotal - discountTotal;

  const rawGrand   = taxableValue;
  const grandTotal = roundOverride !== null ? parseFloat(roundOverride) : Math.round(rawGrand);
  const roundAdj   = grandTotal - rawGrand;

  return {
    processedItems,
    subtotal,
    discountTotal,
    roundAdjustment: roundAdj,
    grandTotal,
    amountInWords: convertNumberToWords(grandTotal),
  };
}

export function calculateAdvanceAmount(grandTotal, advancePct) {
  return parseFloat(((grandTotal * advancePct) / 100).toFixed(2));
}
