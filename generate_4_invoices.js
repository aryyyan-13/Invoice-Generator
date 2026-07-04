
// check for the generation * if not required; remove this entire file

import puppeteer from 'puppeteer';

const runs = [
  { company: 'Avionautics', type: 'PROFORMA', label: 'AV_PROFORMA' },
  { company: 'Avionautics', type: 'TAX', label: 'AV_TAX' },
  { company: 'GMP International', type: 'PROFORMA', label: 'GMP_PROFORMA' },
  { company: 'GMP International', type: 'TAX', label: 'GMP_TAX' }
];

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const run of runs) {
      console.log(`Generating ${run.type} for ${run.company}...`);
      const page = await browser.newPage();
      await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 1000));

      // Click Create Invoice
      const created = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find(b => b.textContent.includes('+ Create Invoice'));
        if (b) { b.click(); return true; }
        return false;
      });

      if (created) {
        await new Promise(r => setTimeout(r, 1000));
      }

      // Fill Form
      await page.evaluate((run) => {
        // Select Company
        const btns = Array.from(document.querySelectorAll('button'));
        const companyBtn = btns.find(b => b.textContent.includes(run.company));
        if (companyBtn) companyBtn.click();

        // Select Type
        const selects = Array.from(document.querySelectorAll('select'));
        if (selects.length > 0) {
          selects[0].value = run.type;
          selects[0].dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill inputs
        const inputs = Array.from(document.querySelectorAll('input'));
        const findInput = (text) => inputs.find(i =>
          (i.placeholder && i.placeholder.toLowerCase().includes(text.toLowerCase())) ||
          (i.name && i.name.toLowerCase().includes(text.toLowerCase())) ||
          (i.id && i.id.toLowerCase().includes(text.toLowerCase())) ||
          (i.parentElement && i.parentElement.textContent.toLowerCase().includes(text.toLowerCase()))
        );

        const setVal = (input, val) => {
          if (input) {
            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        };

        setVal(findInput('buyer name') || findInput('customer name'), 'Test Buyer Corp');
        setVal(findInput('address'), '456 Test Lane, Industrial Area');

        const gstin = findInput('gstin');
        if (gstin) {
          gstin.value = '09BBBBB2222B2Z1';
          gstin.dispatchEvent(new Event('input', { bubbles: true }));
          gstin.dispatchEvent(new Event('blur', { bubbles: true }));
        }

        setVal(findInput('description') || findInput('item'), `Service for ${run.company}`);
        setVal(findInput('hsn'), '9988');
        setVal(findInput('rate') || findInput('price'), '15000');
        setVal(findInput('qty') || findInput('quantity'), '1');

      }, run);

      await new Promise(r => setTimeout(r, 1000));

      // Submit
      const submitClicked = await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]');
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      });

      if (submitClicked) {
        console.log(`Submitted ${run.label}, waiting for API response...`);
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: `/Users/aryan/.gemini/antigravity-ide/brain/3f3541df-bf05-4db0-93d6-bbb4664a33e0/success_${run.label}.png`, fullPage: true });
        console.log(`Saved screenshot to success_${run.label}.png`);
      } else {
        console.log(`Failed to click submit for ${run.label}`);
      }

      await page.close();
    }

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
