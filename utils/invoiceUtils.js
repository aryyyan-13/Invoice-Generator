const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

/**
 * Validates the structure and format of an Indian GSTIN locally.
 * @param {string} gstin 
 * @returns {{isValid: boolean, error?: string}}
 */
export function validateGSTIN(gstin) {
  if (!gstin) {
    return { isValid: false, error: "GSTIN is required." };
  }
  const cleanGstin = gstin.trim().toUpperCase();
  if (cleanGstin.length !== 15) {
    return { isValid: false, error: "GSTIN must be exactly 15 characters." };
  }
  if (!GSTIN_REGEX.test(cleanGstin)) {
    return { isValid: false, error: "Invalid GSTIN format structure. Standard format: 22AAAAA0000A1Z5." };
  }
  return { isValid: true };
}

/**
 * Converts a numeric amount to Indian Rupees in words.
 * @param {number} amount 
 * @returns {string}
 */
export function convertNumberToWords(amount) {
  if (isNaN(amount) || amount < 0) {
    return "Zero Rupees Only";
  }

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  function numToWords(n) {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    
    if (n < 1000) {
      const rem = n % 100;
      return ones[Math.floor(n / 100)] + " Hundred" + (rem !== 0 ? " and " + numToWords(rem) : "");
    }
    if (n < 100000) {
      const rem = n % 1000;
      return numToWords(Math.floor(n / 1000)) + " Thousand" + (rem !== 0 ? (rem < 100 ? " and " : " ") + numToWords(rem) : "");
    }
    if (n < 10000000) {
      const rem = n % 100000;
      return numToWords(Math.floor(n / 100000)) + " Lakh" + (rem !== 0 ? (rem < 100 ? " and " : " ") + numToWords(rem) : "");
    }
    const rem = n % 10000000;
    return numToWords(Math.floor(n / 10000000)) + " Crore" + (rem !== 0 ? (rem < 100 ? " and " : " ") + numToWords(rem) : "");
  }

  const roundedAmount = Math.round(amount * 100) / 100;
  const parts = String(roundedAmount).split(".");
  const rupees = parseInt(parts[0], 10);
  const paise = parts[1] ? parseInt(parts[1].padEnd(2, "0").substring(0, 2), 10) : 0;
  
  let result = "";
  if (rupees === 0) {
    result = "Zero Rupees";
  } else {
    result = "Rupees " + numToWords(rupees);
  }
  
  if (paise > 0) {
    result += " and " + numToWords(paise) + " Paise";
  }
  
  return result.replace(/\s+/g, " ").trim() + " Only";
}

/**
 * Gets the Indian Fiscal Year string (e.g., "26-27") for a given date.
 * @param {Date|string} dateInput 
 * @returns {string}
 */
export function getFiscalYear(dateInput) {
  const date = new Date(dateInput);
  const month = date.getMonth(); // 0-indexed: 0=Jan, 2=Mar, 3=Apr
  const fullYear = date.getFullYear();
  
  const startYear = month < 3 ? fullYear - 1 : fullYear;
  const endYear = startYear + 1;
  
  const startYrStr = String(startYear).substring(2);
  const endYrStr = String(endYear).substring(2);
  return `${startYrStr}-${endYrStr}`;
}

/**
 * Generates the next invoice number using a database transaction sequence.
 * @param {string} companyCode 
 * @param {Date|string} dateInput 
 * @param {string} prefix 
 * @param {object} prisma 
 * @returns {Promise<string>}
 */
export async function getNextInvoiceNumber(companyCode, dateInput, prefix, prisma) {
  const fy = getFiscalYear(dateInput);
  
  // Upsert to ensure the sequence row exists, incrementing it atomically
  const sequence = await prisma.invoiceSequence.upsert({
    where: {
      companyCode_fiscalYear: {
        companyCode,
        fiscalYear: fy
      }
    },
    update: {
      currentVal: {
        increment: 1
      }
    },
    create: {
      companyCode,
      fiscalYear: fy,
      currentVal: 1
    }
  });

  const paddedNum = String(sequence.currentVal).padStart(4, '0');
  return `${prefix}/${fy}/${paddedNum}`;
}
