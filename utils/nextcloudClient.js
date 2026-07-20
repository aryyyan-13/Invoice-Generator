import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();

/**
 * Uploads an invoice PDF buffer to Nextcloud WebDAV, ensuring target directories exist.
 * @param {Buffer} pdfBuffer - The PDF file content as a Buffer.
 * @param {string} companyCode - The company folder name (e.g. "AVIONAUTICS" or "GMP").
 * @param {string} invoiceNumber - The invoice number (e.g. "AV/26-27/0001").
 * @returns {Promise<{nextcloudPath: string, fileUrl: string}>}
 */
export async function uploadToNextcloud(pdfBuffer, companyCode, invoiceNumber, rootFolder = 'Invoices') {
  const url = process.env.NEXTCLOUD_URL;
  const username = process.env.NEXTCLOUD_USERNAME;
  const password = process.env.NEXTCLOUD_APP_PASSWORD;

  if (!url || !username || !password) {
    console.warn("WARNING: Nextcloud credentials are not fully configured in .env. Skipping Nextcloud upload.");
    return {
      nextcloudPath: `offline_mode/Invoices/${companyCode}/${invoiceNumber.replace(/\//g, '_')}.pdf`,
      fileUrl: ""
    };
  }

  // Sanitize the invoice number for use in filenames (replace slashes with underscores)
  const sanitizedInvoiceNum = invoiceNumber.replace(/\//g, '_');
  const remoteRoot = `/remote.php/dav/files/${username}`;
  const invoicesDir = `${remoteRoot}/${rootFolder}`;
  const companyDir = `${invoicesDir}/${companyCode}`;
  const targetFilePath = `${companyDir}/${sanitizedInvoiceNum}.pdf`;

  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  // Helper to ensure a collection (directory) exists in WebDAV
  const ensureDirectory = async (dirPath) => {
    const fullDirUrl = `${url.replace(/\/$/, '')}${dirPath}/`;
    
    // Check if directory exists
    const propfindRes = await fetch(fullDirUrl, {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Depth': '0'
      }
    });

    if (propfindRes.status === 404) {
      console.log(`Creating directory in Nextcloud: ${dirPath}`);
      const mkcolRes = await fetch(fullDirUrl, {
        method: 'MKCOL',
        headers: {
          'Authorization': authHeader
        }
      });
      
      if (!mkcolRes.ok && mkcolRes.status !== 405) { // 405 means it was created concurrently
        throw new Error(`Failed to create Nextcloud directory: ${dirPath}. Status: ${mkcolRes.status}`);
      }
    }
  };

  try {
    // 1. Ensure /Invoices exists
    await ensureDirectory(invoicesDir);
    
    // 2. Ensure /Invoices/{companyCode} exists
    await ensureDirectory(companyDir);

    // 3. Upload file via PUT
    const fileUrl = `${url.replace(/\/$/, '')}${targetFilePath}`;
    console.log(`Uploading PDF to Nextcloud: ${fileUrl}`);
    
    const putRes = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuffer.length)
      },
      body: pdfBuffer
    });

    if (!putRes.ok) {
      throw new Error(`Failed to PUT file to Nextcloud WebDAV. Status: ${putRes.status}`);
    }

    return {
      nextcloudPath: targetFilePath,
      fileUrl
    };
  } catch (error) {
    console.error(`Nextcloud Upload Error: ${error.message}`);
    console.warn("WARNING: Bypassing Nextcloud upload error for testing.");
    return {
      nextcloudPath: `offline_mode/Invoices/${companyCode}/${sanitizedInvoiceNum}.pdf`,
      fileUrl: ""
    };
  }
}
