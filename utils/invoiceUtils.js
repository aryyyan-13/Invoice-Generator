/**
 * Invoice-specific utilities.
 * Core helpers (getFiscalYear, convertNumberToWords, validateGSTIN, getGstSplit)
 * are re-exported from sharedFinancialUtils to keep server.js imports unchanged.
 */
export { validateGSTIN, getFiscalYear, convertNumberToWords, getGstSplit } from './sharedFinancialUtils.js';

/**
 * Generates the next invoice number using an atomic DB sequence upsert.
 * Format: {PREFIX}/{FY}/{SEQ padded to 4}  e.g. "AV/26-27/0001"
 */
export async function getNextInvoiceNumber(companyCode, dateInput, prefix, prisma) {
  const { getFiscalYear } = await import('./sharedFinancialUtils.js');
  const fy = getFiscalYear(dateInput);

  const sequence = await prisma.invoiceSequence.upsert({
    where:  { companyCode_fiscalYear: { companyCode, fiscalYear: fy } },
    update: { currentVal: { increment: 1 } },
    create: { companyCode, fiscalYear: fy, currentVal: 1 },
  });

  return `${prefix}/${fy}/${String(sequence.currentVal).padStart(4, '0')}`;
}
