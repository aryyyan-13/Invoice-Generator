import { getFiscalYear, getGstSplit, convertNumberToWords } from './sharedFinancialUtils.js';

/**
 * Atomically increments the POSequence and returns the formatted PO number.
 * Format: {PREFIX}/PO/{GDS|SVC}/{FY}/{SEQ padded 4}  e.g. "AV/PO/GDS/26-27/0001"
 * ponytail: number format placeholder — update when confirmed by product owner
 */
export async function getNextPoNumber(companyCode, prefix, poType, dateInput, prisma) {
  const fy = getFiscalYear(dateInput);
  const typeCode = poType === 'GOODS' ? 'GDS' : 'SVC';

  const seq = await prisma.pOSequence.upsert({
    where:  { companyCode_poType_fiscalYear: { companyCode, poType, fiscalYear: fy } },
    update: { currentVal: { increment: 1 } },
    create: { companyCode, poType, fiscalYear: fy, currentVal: 1 },
  });

  return `${prefix}/PO/${typeCode}/${fy}/${String(seq.currentVal).padStart(4, '0')}`;
}

/**
 * Calculates all PO financial totals from line items.
 * P&F is only applied for GOODS POs (per design decision).
 * Round adjustment: auto-suggested nearest ₹1 (can be overridden).
 */
export function calculatePOTotals(companyGstin, vendorGstin, items, discountInput = 0, pfInput = 0, roundOverride = null, poType = 'GOODS') {
  const processedItems = items.map((item, i) => {
    const qty    = parseFloat(item.qty)     || 0;
    const rate   = parseFloat(item.rate)    || 0;
    const taxRate = parseFloat(item.taxRate) || 0;
    const amount = qty * rate;
    const { cgstRate, sgstRate, igstRate } = getGstSplit(companyGstin, vendorGstin, taxRate);
    return {
      lineNo:      i + 1,
      description: item.description,
      hsnOrSacCode: item.hsnOrSacCode ?? item.hsnCode ?? '',
      uom:         item.uom,
      qty, rate, amount, taxRate, cgstRate, sgstRate, igstRate,
      cgstAmount:  amount * (cgstRate / 100),
      sgstAmount:  amount * (sgstRate / 100),
      igstAmount:  amount * (igstRate / 100),
    };
  });

  const subtotal     = processedItems.reduce((s, i) => s + i.amount, 0);
  const discountTotal = parseFloat(discountInput) || 0;
  const taxableValue  = subtotal - discountTotal;

  const cgstTotal = processedItems.reduce((s, i) => s + i.cgstAmount * ((taxableValue / (subtotal || 1))), 0);
  const sgstTotal = processedItems.reduce((s, i) => s + i.sgstAmount * ((taxableValue / (subtotal || 1))), 0);
  const igstTotal = processedItems.reduce((s, i) => s + i.igstAmount * ((taxableValue / (subtotal || 1))), 0);

  const pfTotal   = poType === 'GOODS' ? (parseFloat(pfInput) || 0) : 0;

  const preRound  = taxableValue + cgstTotal + sgstTotal + igstTotal + pfTotal;
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
    pfTotal:       parseFloat(pfTotal.toFixed(2)),
    roundAdjustment: parseFloat(roundAdjustment.toFixed(2)),
    grandTotal:    parseFloat(grandTotal.toFixed(2)),
    amountInWords: convertNumberToWords(grandTotal),
  };
}
