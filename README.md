# 🧾 Premium Invoice Console

A self-hosted, operational dashboard and invoice generator designed for businesses (pre-configured for Avionautics & GMP International). Featuring automated PDF rendering, Nextcloud cloud storage synchronization, direct scan-to-pay UPI QR code generation, client directory indexing, and rich visual telemetry.

![Aesthetics](https://img.shields.io/badge/Aesthetics-Premium-348F6C?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Express%20%7C%20Prisma%20%7C%20Puppeteer-3F3D56?style=for-the-badge)
![Database](https://img.shields.io/badge/Database-SQLite-E2C992?style=for-the-badge)

---

## ✨ Features

### 📊 Real-Time Operations Dashboard
*   **Operational Metrics**: Summary cards displaying **Total Revenue**, **Active/Cancelled Invoices**, **Tax Invoice Count**, and registered companies.
*   **Revenue Analytics**: Interactive Area Chart (powered by `recharts`) showing monthly tax invoice revenue trends with real-time company-level filtering.
*   **Company Breakdown**: Visual table comparing billed revenue and invoice counts between Avionautics and GMP International.

### 💳 Digital Wallet & UPI Payments
*   **Bank details**: Centralized display of Account Name, Account Number, Bank Name, and IFSC with quick copy-to-clipboard buttons.
*   **Dynamic QR Codes**: Generates standard UPI QR codes (`upi://pay?pa=...`) for scan-and-pay utilizing any major banking app (GPay, PhonePe, Paytm, etc.).

### 👥 Automatic Client Directory
*   **Auto-Extraction**: Indexes and groups client names, billing addresses, and GSTINs automatically from your generated invoices. No separate client database table required.
*   **Search**: Highly responsive search bar to filter clients by name, GSTIN, or billing location.
*   **Metadata tracking**: Shows invoice count per client and the date of their last issued invoice.

### 📁 Invoice Registry & PDF Engine
*   **Puppeteer Rendering**: Compiles Handlebars-based HTML templates (`Sample_template.html`) into precise, professional A4 PDF invoices.
*   **Dual PDF Commands**: View PDF previews in-app inside a modal, or click **Download PDF** to save them directly to your local disk.
*   **Audit Trail**: Logs creation, cancelation, and modification history (diffing changes like Buyer Name or Grand Total adjustments).
*   **Cloud Sync**: Automatically pushes generated PDFs to Nextcloud WebDAV cloud storage.

---

## 🛠️ Tech Stack

*   **Frontend**: React (Vite), vanilla CSS layout with modern design tokens, `lucide-react` (icon suite), `recharts` (telemetry graphs), `qrcode.react` (vector QR engine).
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

5.  **Run migrations & Seed the database**:
    ```bash
    npx prisma migrate dev --name init
    npm run seed
    ```

6.  **Run the application**:
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
│   └── invoiceUtils.js      # GST math and number-to-words helpers
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx # Revenue telemetry & charts
│   │   │   ├── Wallet.jsx    # Bank details & UPI QR codes
│   │   │   ├── Clients.jsx   # Searchable client directory
│   │   │   ├── Sidebar.jsx   # App navigation menu
│   │   │   ├── InvoiceList.jsx
│   │   │   └── InvoiceForm.jsx
│   │   ├── App.jsx           # Main layout router
│   │   └── index.css         # UI Design tokens & animations
└── server.js                # Express API endpoints
```
