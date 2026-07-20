import { getFiscalYear, getGstSplit, convertNumberToWords } from './sharedFinancialUtils.js';

const FORCE_MAJEURE_BOILERPLATE = `1. Force Majeure: Neither party shall be held liable for failure to perform obligations under this quotation if such failure is caused by acts of God, war, civil disturbance, government restrictions, strikes, fire, flood, earthquake, epidemic, or any other cause beyond the reasonable control of the affected party. The affected party shall give prompt written notice of the force majeure event and shall use reasonable efforts to resume performance as soon as practicable.`;

export { FORCE_MAJEURE_BOILERPLATE };

/**
 * Atomically increments the QuotationSequence and returns formatted quotation number.
 * Format: {PREFIX}/QT/{GDS|SVC}/{FY}/{SEQ padded 4}  e.g. "GMP/QT/SVC/26-27/0007"
 * ponytail: number format placeholder — update when confirmed by product owner
 */
export async function getNextQuotationNumber(companyCode, prefix, quotationType, dateInput, prisma) {
  const fy = getFiscalYear(dateInput);
  const typeCode = quotationType === 'GOODS' ? 'GDS' : 'SVC';

  const seq = await prisma.quotationSequence.upsert({
    where:  { companyCode_quotationType_fiscalYear: { companyCode, quotationType, fiscalYear: fy } },
    update: { currentVal: { increment: 1 } },
    create: { companyCode, quotationType, fiscalYear: fy, currentVal: 1 },
  });

  return `${prefix}/QT/${typeCode}/${fy}/${String(seq.currentVal).padStart(4, '0')}`;
}

/**
 * Calculates all Quotation financial totals from line items, including GST block.
 * No P&F for quotations.
 */
export function calculateQuotationTotals(companyGstin, clientGstin, items, discountInput = 0, roundOverride = null) {
  const processedItems = items.map((item, i) => {
    const qty    = parseFloat(item.qty)      || 0;
    const rate   = parseFloat(item.rate)     || 0;
    const taxRate = parseFloat(item.taxRate) || 0;
    const amount = qty * rate;
    const { cgstRate, sgstRate, igstRate } = getGstSplit(companyGstin, clientGstin, taxRate);
    return {
      lineNo:      i + 1,
      description: item.description,
      uom:         item.uom,
      qty, rate, amount, taxRate, cgstRate, sgstRate, igstRate,
      cgstAmount:  amount * (cgstRate / 100),
      sgstAmount:  amount * (sgstRate / 100),
      igstAmount:  amount * (igstRate / 100),
    };
  });

  const subtotal      = processedItems.reduce((s, i) => s + i.amount, 0);
  const discountTotal = parseFloat(discountInput) || 0;
  const taxableValue  = subtotal - discountTotal;

  const cgstTotal = processedItems.reduce((s, i) => s + i.cgstAmount, 0) * (taxableValue / (subtotal || 1));
  const sgstTotal = processedItems.reduce((s, i) => s + i.sgstAmount, 0) * (taxableValue / (subtotal || 1));
  const igstTotal = processedItems.reduce((s, i) => s + i.igstAmount, 0) * (taxableValue / (subtotal || 1));

  const preRound = taxableValue + cgstTotal + sgstTotal + igstTotal;
  const autoRound = Math.round(preRound) - preRound;
  const roundAdjustment = roundOverride !== null ? parseFloat(roundOverride) : parseFloat(autoRound.toFixed(2));
  const grandTotal = preRound + roundAdjustment;

  return {
    processedItems,
    subtotal:      parseFloat(subtotal.toFixed(2)),
    discountTotal: parseFloat(discountTotal.toFixed(2)),
    taxableValue:  parseFloat(taxableValue.toFixed(2)),
    cgstTotal:     parseFloat(cgstTotal.toFixed(2)),
    sgstTotal:     parseFloat(sgstTotal.toFixed(2)),
    igstTotal:     parseFloat(igstTotal.toFixed(2)),
    roundAdjustment: parseFloat(roundAdjustment.toFixed(2)),
    grandTotal:    parseFloat(grandTotal.toFixed(2)),
    amountInWords: convertNumberToWords(grandTotal),
  };
}

/** Returns the advance rupee amount for a given grand total and advance percentage. */
export function calculateAdvanceAmount(grandTotal, advancePct) {
  return parseFloat((grandTotal * (advancePct / 100)).toFixed(2));
}
