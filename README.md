# 🧾 Premium Invoice & Operations Console

A self-hosted operational dashboard, CRM-ready directory, and multi-document generator designed for businesses (pre-configured for Avionautics & GMP International). Featuring automated PDF rendering, Nextcloud cloud storage synchronization, direct scan-to-pay UPI QR code generation, client directory indexing, and a modern, high-density B2B SaaS layout.

![Aesthetics](https://img.shields.io/badge/Aesthetics-B2B_SaaS-348F6C?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Express%20%7C%20Prisma%20%7C%20Puppeteer-3F3D56?style=for-the-badge)
![Database](https://img.shields.io/badge/Database-SQLite-18181B?style=for-the-badge)

---

## ✨ Features

### 📊 Real-Time Operations Dashboard & CRM Ready
*   **Operational Metrics**: Summary cards displaying **Total Revenue**, **Active/Cancelled Invoices**, **Tax Invoice Count**, and registered companies.
*   **Revenue Analytics**: Interactive Area Chart (powered by `recharts`) showing monthly tax invoice revenue trends with real-time company-level filtering.
*   **High-Density Layout**: Built with a clean, high-contrast B2B SaaS visual design using Geist typography and tight 8px geometries to accommodate future CRM additions.

### 💼 Suite of Document Generators
*   **Invoices**: Generate domestic GST invoices with automatic HSN/SAC lookups, SGST/CGST/IGST breakdown, and auto-computed totals.
*   **Purchase Orders (POs)**: Generate Goods or Services POs with custom shipping terms and line-item details.
*   **Quotations**: Build formal quotes for domestic prospects.
*   **Export Quotations**: Formulate international quotes with custom export configurations (Port of Loading, Destination, Terms of Delivery).
*   **Commercial Invoices**: Compile detailed commercial invoice records for custom clearance and shipping.

### 💳 Digital Wallet & UPI Payments
*   **Bank Details**: Centralized display of Account Name, Account Number, Bank Name, and IFSC with quick copy-to-clipboard buttons.
*   **Dynamic QR Codes**: Generates standard UPI QR codes (`upi://pay?pa=...`) for scan-and-pay utilizing any major banking app (GPay, PhonePe, Paytm, etc.).

### 👥 Automatic Client Directory
*   **Auto-Extraction**: Indexes and groups client names, billing addresses, and GSTINs automatically from your generated invoices. No separate client database table required.
*   **Search**: Highly responsive search bar to filter clients by name, GSTIN, or billing location.
*   **Metadata tracking**: Shows invoice count per client and the date of their last issued invoice.

### 📁 Invoice Registry & PDF Engine
*   **Puppeteer Rendering**: Compiles Handlebars-based HTML templates (`Sample_template.html`, `PO_template.html`, etc.) into precise, professional A4 PDF invoices.
*   **Dual PDF Commands**: View PDF previews in-app inside a modal, or click **Download PDF** to save them directly to local disk.
*   **Audit Trail**: Logs creation, cancelation, and modification history (diffing changes like Buyer Name or Grand Total adjustments).
*   **Cloud Sync**: Automatically pushes generated PDFs to Nextcloud WebDAV cloud storage.

---

## 🛠️ Tech Stack

*   **Frontend**: React (Vite), vanilla CSS layout with Geist UI design tokens, `lucide-react` (icon suite), `recharts` (telemetry graphs), `qrcode.react` (vector QR engine).
*   **Backend**: Node.js & Express API, Puppeteer (headless browser PDF renderer), Handlebars.js (HTML compiler).
*   **Database & ORM**: SQLite (`invoice_generator.db`), Prisma ORM.

---

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18+)
*   npm

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/aryyyan-13/Invoice-Generator.git
    cd Invoice-Generator
    ```

2.  **Configure environment variables**:
    Create a `.env` file in the root directory:
    ```env
    PORT=3001
    NEXTCLOUD_URL=https://gmpintl.com/mycloud
    NEXTCLOUD_USERNAME=your_username@gmpintl.com
    NEXTCLOUD_APP_PASSWORD=your_app_password
    DATABASE_URL="file:../data/invoice_generator.db"
    ```

3.  **Install dependencies**:
    ```bash
    # Root & Backend dependencies
    npm install

    # Frontend dependencies
    cd frontend
    npm install
    cd ..
    ```

4.  **Run migrations & Seed the database**:
    ```bash
    npx prisma migrate dev --name init
    npm run seed
    ```

5.  **Run the application**:
    To run both the backend server and frontend development server concurrently:
    ```bash
    npm run dev
    ```
    *   **Frontend**: `http://localhost:5173`
    *   **Backend API**: `http://localhost:3001`

---

## 🧪 Running Tests

An integration test suite is included to verify GST calculations, GSTIN format compliance, invoice numbering sequences, and word translations:
```bash
npm run test
```

---

## 📂 Project Structure

```
.
├── prisma/
│   ├── schema.prisma        # SQLite database models
│   └── seed.js              # Company and HSN seed configurations
├── utils/
│   ├── pdfRenderer.js       # Puppeteer compilation logic
│   ├── nextcloudClient.js   # WebDAV cloud synchronization
│   ├── poUtils.js           # Purchase Order financial helpers
│   ├── quotationUtils.js    # Quotation financial helpers
│   └── invoiceUtils.js      # GST math and number-to-words helpers
├── routes/
│   ├── poRoutes.js          # Purchase Order endpoints
│   ├── quotationRoutes.js   # Quotation endpoints
│   └── ...                  # Other document routing modules
├── templates/
│   ├── PO_template.html     # HTML layout for Purchase Orders
│   └── Quotation_template.html
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx # Revenue telemetry & charts
│   │   │   ├── Wallet.jsx    # Bank details & UPI QR codes
│   │   │   ├── Clients.jsx   # Searchable client directory
│   │   │   ├── Sidebar.jsx   # App navigation menu
│   │   │   ├── PurchaseOrder/ # PO List and Creator components
│   │   │   ├── Quotation/     # Quotation components
│   │   │   ├── InvoiceList.jsx
│   │   │   └── InvoiceForm.jsx
│   │   ├── App.jsx           # Main layout router
│   │   └── index.css         # Geist UI Design tokens & animations
└── server.js                # Express API endpoints
```
