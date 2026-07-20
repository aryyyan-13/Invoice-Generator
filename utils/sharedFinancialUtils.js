/**
 * Shared financial helpers used by Invoice, PO, and Quotation modules.
 * Single source of truth — import from here, never duplicate.
 */

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

export function validateGSTIN(gstin) {
  if (!gstin) return { isValid: false, error: 'GSTIN is required.' };
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) return { isValid: false, error: 'GSTIN must be exactly 15 characters.' };
  if (!GSTIN_REGEX.test(clean)) return { isValid: false, error: 'Invalid GSTIN format. Standard: 22AAAAA0000A1Z5.' };
  return { isValid: true };
}

/**
 * Returns "YY-YY" Indian fiscal year string for a given date.
 * April 1 starts a new FY, so Jan-Mar belong to the previous FY.
 */
export function getFiscalYear(dateInput) {
  const date = new Date(dateInput);
  const startYear = date.getMonth() < 3 ? date.getFullYear() - 1 : date.getFullYear();
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
}

/**
 * Returns { isIntrastate, cgstRate, sgstRate, igstRate } for an item's tax rate.
 * Treats missing/URD buyer GSTIN as intrastate (per business rule).
 */
export function getGstSplit(companyGstin, counterpartyGstin, taxRate) {
  const companyState = companyGstin?.substring(0, 2) ?? '';
  const cpState = (counterpartyGstin && counterpartyGstin.length >= 2 && counterpartyGstin.toUpperCase() !== 'URD')
    ? counterpartyGstin.substring(0, 2)
    : companyState;
  const isIntrastate = companyState === cpState || !counterpartyGstin || counterpartyGstin.trim().toUpperCase() === 'URD';

  return isIntrastate
    ? { isIntrastate: true,  cgstRate: taxRate / 2, sgstRate: taxRate / 2, igstRate: 0 }
    : { isIntrastate: false, cgstRate: 0,            sgstRate: 0,            igstRate: taxRate };
}

/**
 * Converts a numeric amount to Indian Rupees in words.
 * e.g. 12050.30 → "Rupees Twelve Thousand and Fifty and Thirty Paise Only"
 */
export function convertNumberToWords(amount) {
  if (isNaN(amount) || amount < 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function numToWords(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) { const r = n % 100; return ones[Math.floor(n / 100)] + ' Hundred' + (r ? ' and ' + numToWords(r) : ''); }
    if (n < 100000) { const r = n % 1000; return numToWords(Math.floor(n / 1000)) + ' Thousand' + (r ? (r < 100 ? ' and ' : ' ') + numToWords(r) : ''); }
    if (n < 10000000) { const r = n % 100000; return numToWords(Math.floor(n / 100000)) + ' Lakh' + (r ? (r < 100 ? ' and ' : ' ') + numToWords(r) : ''); }
    const r = n % 10000000;
    return numToWords(Math.floor(n / 10000000)) + ' Crore' + (r ? (r < 100 ? ' and ' : ' ') + numToWords(r) : '');
  }

  const rounded = Math.round(amount * 100) / 100;
  const [rupStr, paiStr = '0'] = String(rounded).split('.');
  const rupees = parseInt(rupStr, 10);
  const paise = parseInt(paiStr.padEnd(2, '0').substring(0, 2), 10);

  let result = rupees === 0 ? 'Zero Rupees' : 'Rupees ' + numToWords(rupees);
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
  return result.replace(/\s+/g, ' ').trim() + ' Only';
}
