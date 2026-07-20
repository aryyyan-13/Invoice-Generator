import { getFiscalYear, convertNumberToWords } from './sharedFinancialUtils.js';

export const FORCE_MAJEURE_BOILERPLATE = `Force Majeure: Neither party shall be liable for failure to perform obligations if such failure is caused by Acts of God, war, government actions, natural disasters, pandemics, or any other circumstances beyond reasonable control. In such events, the affected party shall notify the other party promptly.`;

/**
 * Atomically generates the next Export Quotation number.
 * Format: GMP/EXQ/{FY}/{SEQ padded to 4}
 */
export async function getNextExportQuoteNumber(date, prisma) {
  const fy = getFiscalYear(date);
  const seq = await prisma.exportQuotationSequence.upsert({
    where:  { fiscalYear: fy },
    update: { currentVal: { increment: 1 } },
    create: { fiscalYear: fy, currentVal: 1 },
  });
  return `GMP/EXQ/${fy}/${String(seq.currentVal).padStart(4, '0')}`;
}

/**
 * Calculates export quotation totals (no GST — zero-rated exports).
 */
export function calculateExportTotals(items, discountInput = 0, roundOverride = null) {
  const processedItems = items.map((item, i) => {
    const qty    = parseFloat(item.qty)  || 0;
    const rate   = parseFloat(item.rate) || 0;
    const amount = qty * rate;
    return { lineNo: i + 1, description: item.description, uom: item.uom, qty, rate, amount };
  });

  const subtotal      = processedItems.reduce((s, it) => s + it.amount, 0);
  const discountTotal = parseFloat(discountInput) || 0;
  const taxableValue  = subtotal - discountTotal;

  const rawGrand    = taxableValue;
  const grandTotal  = roundOverride !== null ? parseFloat(roundOverride) : Math.round(rawGrand);
  const roundAdj    = grandTotal - rawGrand;

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
