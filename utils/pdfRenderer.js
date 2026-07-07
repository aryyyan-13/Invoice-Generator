import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';

// Path to the Sample_template.html
const TEMPLATE_PATH = '/Users/aryan/Desktop/invoice generator/Sample_template.html';

/**
 * Reads a local file and converts it to a Base64 data URI.
 * @param {string} filePath - Absolute path to the file.
 * @returns {string} Base64 Data URI
 */
function getLogoDataUri(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const data = fs.readFileSync(filePath);
    const base64 = data.toString('base64');
    
    if (ext === '.svg') {
      return `data:image/svg+xml;base64,${base64}`;
    } else if (ext === '.png') {
      return `data:image/png;base64,${base64}`;
    } else if (ext === '.jpg' || ext === '.jpeg') {
      return `data:image/jpeg;base64,${base64}`;
    }
    return `data:image/svg+xml;base64,${base64}`;
  } catch (err) {
    console.error(`Error reading logo for Base64 conversion: ${err.message}`);
    return '';
  }
}

/**
 * Compiles the invoice data into the HTML template and generates a PDF Buffer.
 * @param {object} invoiceData - Full data matching the template fields.
 * @returns {Promise<Buffer>} PDF file Buffer
 */
export async function generateInvoicePdf(invoiceData) {
  // 1. Read HTML template
  let htmlTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  // 2. Prepare company logo as Base64 Data URI
  const logoFilename = path.basename(invoiceData.company.logoPath);
  const absoluteLogoPath = path.join('/Users/aryan/Desktop/invoice generator/public/logos', logoFilename);
  const logoDataUri = getLogoDataUri(absoluteLogoPath);

  // 3. Inject dynamic CSS variables inside the <head> of the template
  const cssOverrides = `
    <style>
      :root {
        --brand: ${invoiceData.company.themePrimary};
        --brand-2: ${invoiceData.company.themePrimary};
        --accent: ${invoiceData.company.themeAccent};
      }
    </style>
  `;
  htmlTemplate = htmlTemplate.replace('</head>', `${cssOverrides}</head>`);

  // 4. Compile with Handlebars
  const template = Handlebars.compile(htmlTemplate);
  
  // Map company.logo_url for template rendering
  const renderData = {
    ...invoiceData,
    company: {
      ...invoiceData.company,
      logo_url: logoDataUri
    }
  };

  const compiledHtml = template(renderData);

  // 5. Render to PDF with Puppeteer
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(compiledHtml, { waitUntil: 'load' });
    
    // Renders as a single page A4 PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0px',
        bottom: '0px',
        left: '0px',
        right: '0px'
      }
    });

    return pdfBuffer;
  } catch (error) {
    console.error(`Puppeteer PDF generation error: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
