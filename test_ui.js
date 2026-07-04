import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  try {
    console.log("Navigating to frontend...");
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    
    // Give it a moment to render
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Looking for Create New button...");
    // Find a button that might be "Create New Invoice"
    const buttons = await page.$$('button');
    let createBtn = null;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('+ Create Invoice')) {
        createBtn = btn;
        break;
      }
    }
    
    if (createBtn) {
      console.log("Clicking Create New Invoice...");
      await createBtn.click();
      await new Promise(r => setTimeout(r, 1000));
    } else {
      console.log("Assuming we are already on the form.");
    }
    
    console.log("Filling form...");
    // Fill out the form fields. Need to find them by placeholder or some selector.
    // Let's type into inputs based on their IDs or placeholders if possible.
    // Instead of precise selectors, we'll use evaluate to fill known fields if possible.
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      
      const findInputByLabelOrPlaceholder = (text) => {
        return inputs.find(i => 
          (i.placeholder && i.placeholder.toLowerCase().includes(text.toLowerCase())) ||
          (i.name && i.name.toLowerCase().includes(text.toLowerCase())) ||
          (i.id && i.id.toLowerCase().includes(text.toLowerCase())) ||
          (i.parentElement && i.parentElement.textContent.toLowerCase().includes(text.toLowerCase()))
        );
      };
      
      const nameInput = findInputByLabelOrPlaceholder('buyer name') || findInputByLabelOrPlaceholder('customer name');
      if (nameInput) { nameInput.value = 'Acme Corporation'; nameInput.dispatchEvent(new Event('input', { bubbles: true })); }
      
      const addrInput = findInputByLabelOrPlaceholder('address');
      if (addrInput) { addrInput.value = '123 Tech Park, New Delhi'; addrInput.dispatchEvent(new Event('input', { bubbles: true })); }
      
      const gstinInput = findInputByLabelOrPlaceholder('gstin');
      if (gstinInput) { 
        gstinInput.value = '07BBBBB1111B1Z2'; 
        gstinInput.dispatchEvent(new Event('input', { bubbles: true })); 
        gstinInput.dispatchEvent(new Event('blur', { bubbles: true })); // Trigger validation
      }
      
      // Items
      const descInput = findInputByLabelOrPlaceholder('description') || findInputByLabelOrPlaceholder('item');
      if (descInput) { descInput.value = 'Consulting Services'; descInput.dispatchEvent(new Event('input', { bubbles: true })); }
      
      const hsnInput = findInputByLabelOrPlaceholder('hsn');
      if (hsnInput) { hsnInput.value = '998311'; hsnInput.dispatchEvent(new Event('input', { bubbles: true })); }
      
      const rateInput = findInputByLabelOrPlaceholder('rate') || findInputByLabelOrPlaceholder('price');
      if (rateInput) { rateInput.value = '50000'; rateInput.dispatchEvent(new Event('input', { bubbles: true })); }
      
      const qtyInput = findInputByLabelOrPlaceholder('qty') || findInputByLabelOrPlaceholder('quantity');
      if (qtyInput) { qtyInput.value = '1'; qtyInput.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    
    // Wait for GSTIN validation
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Submitting form...");
    const submitClicked = await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) { btn.click(); return true; }
      return false;
    });
    
    if (submitClicked) {
      console.log("Clicked submit, waiting for response...");
      await new Promise(r => setTimeout(r, 3000));
    } else {
      console.log("Could not find submit button.");
    }
    
    const screenshotPath = '/Users/aryan/.gemini/antigravity-ide/brain/3f3541df-bf05-4db0-93d6-bbb4664a33e0/invoice_generation_success.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log("Screenshot saved to: " + screenshotPath);
    
  } catch (error) {
    console.error("Error during puppeteer script:", error);
  } finally {
    await browser.close();
  }
})();
