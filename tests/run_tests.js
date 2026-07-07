import assert from 'assert';
import { 
  validateGSTIN, 
  convertNumberToWords, 
  getFiscalYear 
} from '../utils/invoiceUtils.js';

// Mock calculation function replicating backend calculateInvoiceTotals logic
function testCalculateTotals(sellerGstin, buyerGstin, items, discount = 0) {
  const sellerState = sellerGstin ? sellerGstin.substring(0, 2) : "";
  const buyerState = buyerGstin ? buyerGstin.substring(0, 2) : sellerState;
  
  const isIntrastate = (sellerState === buyerState) || !buyerGstin || buyerGstin.toUpperCase() === 'URD';

  const processedItems = items.map((item, index) => {
    const qty = item.qty;
    const rate = item.rate;
    const taxRate = item.taxRate;
    const amount = qty * rate;

    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;

    if (isIntrastate) {
      cgstRate = taxRate / 2;
      sgstRate = taxRate / 2;
    } else {
      igstRate = taxRate;
    }

    const cgstAmount = amount * (cgstRate / 100);
    const sgstAmount = amount * (sgstRate / 100);
    const igstAmount = amount * (igstRate / 100);

    return {
      amount,
      cgstAmount,
      sgstAmount,
      igstAmount
    };
  });

  const subtotal = processedItems.reduce((sum, item) => sum + item.amount, 0);
  const taxableValue = subtotal - discount;
  const discountFactor = subtotal > 0 ? (taxableValue / subtotal) : 1;

  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  processedItems.forEach(item => {
    cgstTotal += item.cgstAmount * discountFactor;
    sgstTotal += item.sgstAmount * discountFactor;
    igstTotal += item.igstAmount * discountFactor;
  });

  const rawGrandTotal = taxableValue + cgstTotal + sgstTotal + igstTotal;
  const grandTotal = Math.round(rawGrandTotal);
  const roundAdjustment = grandTotal - rawGrandTotal;

  return {
    subtotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    grandTotal,
    roundAdjustment,
    isIntrastate
  };
}

function runTests() {
  console.log("=== INTEGRATION TEST RUNNER STARTED ===");

  // 1. Fiscal Year Transitions
  console.log("Testing Fiscal Year Calculation...");
  assert.strictEqual(getFiscalYear("2026-03-31"), "25-26");
  assert.strictEqual(getFiscalYear("2026-04-01"), "26-27");
  assert.strictEqual(getFiscalYear("2027-03-15"), "26-27");
  assert.strictEqual(getFiscalYear("2027-04-05"), "27-28");
  console.log("✓ Fiscal Year tests passed.");

  // 2. GSTIN Validity
  console.log("Testing GSTIN Validation...");
  assert.strictEqual(validateGSTIN("07AAAAA1111A1Z0").isValid, true);
  assert.strictEqual(validateGSTIN("09BBBBB2222B2Z1").isValid, true);
  assert.strictEqual(validateGSTIN("INVALID").isValid, false);
  assert.strictEqual(validateGSTIN("1234567890123456").isValid, false); // Length 16
  console.log("✓ GSTIN Validation tests passed.");

  // 3. Amount in Words
  console.log("Testing Amount in Words...");
  assert.strictEqual(
    convertNumberToWords(100),
    "Rupees One Hundred Only"
  );
  assert.strictEqual(
    convertNumberToWords(100000),
    "Rupees One Lakh Only"
  );
  assert.strictEqual(
    convertNumberToWords(52345.50),
    "Rupees Fifty Two Thousand Three Hundred and Forty Five and Fifty Paise Only"
  );
  assert.strictEqual(
    convertNumberToWords(10000005.02),
    "Rupees One Crore and Five and Two Paise Only"
  );
  console.log("✓ Amount in Words tests passed.");

  // 4. Intrastate vs Interstate Tax Routing
  console.log("Testing Intrastate/Interstate Routing & Math...");
  
  // Intrastate: Delhi (07) to Delhi (07)
  const resIntra = testCalculateTotals(
    "07AAAAA1111A1Z0", // Seller (Delhi)
    "07BBBBB2222B2Z1", // Buyer (Delhi)
    [
      { qty: 10, rate: 100, taxRate: 18 }, // basic: 1000, tax: 18% (CGST 9% + SGST 9%)
      { qty: 2, rate: 500, taxRate: 12 }   // basic: 1000, tax: 12% (CGST 6% + SGST 6%)
    ],
    100 // discount
  );

  assert.strictEqual(resIntra.isIntrastate, true);
  assert.strictEqual(resIntra.subtotal, 2000);
  // Taxable basic is 2000 - 100 = 1900.
  // Discount factor = 1900/2000 = 0.95.
  // Item 1 tax base: 1000 * 0.95 = 950. CGST (9%): 85.5, SGST (9%): 85.5.
  // Item 2 tax base: 1000 * 0.95 = 950. CGST (6%): 57, SGST (6%): 57.
  // CGST total = 85.5 + 57 = 142.5.
  // SGST total = 142.5.
  // Grand total = 1900 + 142.5 + 142.5 = 2185.0.
  assert.strictEqual(resIntra.cgstTotal, 142.5);
  assert.strictEqual(resIntra.sgstTotal, 142.5);
  assert.strictEqual(resIntra.igstTotal, 0);
  assert.strictEqual(resIntra.grandTotal, 2185);

  // Interstate: Delhi (07) to Uttar Pradesh (09)
  const resInter = testCalculateTotals(
    "07AAAAA1111A1Z0", // Seller (Delhi)
    "09BBBBB2222B2Z1", // Buyer (UP)
    [
      { qty: 5, rate: 200, taxRate: 18 } // basic: 1000, tax: 18% (IGST 18%)
    ]
  );
  assert.strictEqual(resInter.isIntrastate, false);
  assert.strictEqual(resInter.igstTotal, 180);
  assert.strictEqual(resInter.grandTotal, 1180);

  console.log("✓ GST Routing and Math tests passed.");
  console.log("=== ALL TESTS COMPLETED SUCCESSFULLY ===");
}

try {
  runTests();
  process.exit(0);
} catch (e) {
  console.error("❌ TEST FAILED:", e.message);
  console.error(e.stack);
  process.exit(1);
}
