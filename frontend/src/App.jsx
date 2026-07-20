import React, { useState, useCallback, useEffect } from 'react';
import InvoiceList from './components/InvoiceList';
import InvoiceForm from './components/InvoiceForm';
import Sidebar from './components/Sidebar';
import DocsSidebar from './components/DocsSidebar';
import Dashboard from './components/Dashboard';
import Wallet from './components/Wallet';
import Clients from './components/Clients';
import POList from './components/PurchaseOrder/POList';
import POForm from './components/PurchaseOrder/POForm';
import QuotationList from './components/Quotation/QuotationList';
import QuotationForm from './components/Quotation/QuotationForm';
import ExportQuotationList from './components/ExportQuotation/ExportQuotationList';
import ExportQuotationForm from './components/ExportQuotation/ExportQuotationForm';
import CommercialInvoiceList from './components/CommercialInvoice/CommercialInvoiceList';
import CommercialInvoiceForm from './components/CommercialInvoice/CommercialInvoiceForm';
import { Search, Bell, Menu, X, ChevronDown } from 'lucide-react';
import './index.css';

/**
 * Placeholder pages for nav items that are not yet implemented.
 * Shows a friendly empty state instead of a blank page.
 */
function PlaceholderPage({ title, description }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '16px',
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'rgba(52,143,108,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden="true"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M9 12h6M12 9v6" />
        </svg>
      </div>
      <div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
          {title}
        </h2>
        <p style={{ fontSize: '14px', maxWidth: '320px', lineHeight: 1.6 }}>{description}</p>
      </div>
    </div>
  );
}

// ponytail: sections that use DocsSidebar instead of the main Sidebar
const DOCS_SECTIONS = new Set(['purchase-orders', 'quotations', 'export-quotations', 'commercial-invoices']);

export default function App() {
  const [activeSection, setActiveSection] = useState('invoices');
  const [invoiceView, setInvoiceView] = useState('list');
  const [editInvoice, setEditInvoice] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [docsView, setDocsView] = useState('list');
  // The PO or Quotation record being edited
  const [editDoc, setEditDoc] = useState(null);
  // Export modules simple list/form toggle
  const [exportQView, setExportQView] = useState('list');
  const [commercialInvView, setCommercialInvView] = useState('list');

  // Close sidebar on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sidebarOpen]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  /* ── Invoice handlers ──────────────────────────── */
  const handleEditInvoice = useCallback((invoice) => {
    setEditInvoice(invoice);
    setInvoiceView('create');
  }, []);

  const handleCreateNew = useCallback(() => {
    setEditInvoice(null);
    setInvoiceView('create');
    setActiveSection('invoices');
  }, []);

  const handleFormSuccess = useCallback(() => {
    setEditInvoice(null);
    setInvoiceView('list');
  }, []);

  const handleFormCancel = useCallback(() => {
    setEditInvoice(null);
    setInvoiceView('list');
  }, []);

  /* ── Sidebar navigation handler ────────────────── */
  const handleNavigate = useCallback((section) => {
    setActiveSection(section);
    if (section === 'invoices') {
      setInvoiceView('list');
      setEditInvoice(null);
    }
    // Reset docs sub-view when switching docs sections
    if (DOCS_SECTIONS.has(section)) { setDocsView('list'); setEditDoc(null); }
  }, []);

  // Exit docs module back to the main app (defaults to invoices)
  const handleDocsBack = useCallback(() => {
    setActiveSection('invoices');
    setDocsView('list');
    setEditDoc(null);
  }, []);

  const handleDocsViewChange = useCallback((view) => {
    if (view !== 'create') setEditDoc(null);
    setDocsView(view);
  }, []);

  /* ── Page title derivation ──────────────────────── */
  const pageTitle = {
    dashboard:       'Dashboard',
    wallet:          'Wallet',
    clients:         'Clients',
    invoices:        invoiceView === 'create' ? (editInvoice ? 'Regenerate Invoice' : 'New Invoice') : 'Invoice Registry',
    'purchase-orders': docsView === 'create' ? 'New Purchase Order' : 'Purchase Orders',
    quotations:      docsView === 'create' ? 'New Quotation' : 'Quotations',
    'export-quotations': exportQView === 'create' ? 'New Export Quotation' : 'Export Quotations',
    'commercial-invoices': commercialInvView === 'create' ? 'New Commercial Invoice' : 'Commercial Invoices',
    settings:        'Settings',
  }[activeSection] ?? 'Dashboard';

  /* ── Content renderer ───────────────────────────── */
  const renderContent = () => {
    switch (activeSection) {
      case 'invoices':
        return invoiceView === 'list' ? (
          <InvoiceList
            key="invoice-list"
            onEdit={handleEditInvoice}
            onCreateNew={handleCreateNew}
          />
        ) : (
          <InvoiceForm
            key="invoice-form"
            editInvoice={editInvoice}
            onCancel={handleFormCancel}
            onSuccess={handleFormSuccess}
          />
        );
      case 'dashboard':       return <Dashboard key="dashboard" />;
      case 'wallet':          return <Wallet key="wallet" />;
      case 'clients':         return <Clients key="clients" />;
      // ponytail: real list/form components — no more placeholder shells
      case 'purchase-orders': return docsView === 'create' ? (
        <POForm
          key="po-form"
          editPO={editDoc}
          onCancel={() => { setDocsView('list'); setEditDoc(null); }}
          onSuccess={() => { setDocsView('list'); setEditDoc(null); }}
        />
      ) : (
        <POList
          key="po-list"
          onCreateNew={() => { setEditDoc(null); setDocsView('create'); }}
          onEdit={(po) => { setEditDoc(po); setDocsView('create'); }}
        />
      );
      case 'quotations': return docsView === 'create' ? (
        <QuotationForm
          key="quotation-form"
          editQuotation={editDoc}
          onCancel={() => { setDocsView('list'); setEditDoc(null); }}
          onSuccess={() => { setDocsView('list'); setEditDoc(null); }}
        />
      ) : (
        <QuotationList
          key="quotation-list"
          onCreateNew={() => { setEditDoc(null); setDocsView('create'); }}
          onEdit={(q) => { setEditDoc(q); setDocsView('create'); }}
        />
      );
      case 'export-quotations': return exportQView === 'create' ? (
        <ExportQuotationForm
          key="export-quotation-form"
          editExportQuotation={editDoc}
          onCancel={() => { setExportQView('list'); setEditDoc(null); }}
          onSuccess={() => { setExportQView('list'); setEditDoc(null); }}
        />
      ) : (
        <ExportQuotationList
          key="export-quotation-list"
          onNewQuote={() => { setEditDoc(null); setExportQView('create'); }}
          onEdit={(q) => { setEditDoc(q); setExportQView('create'); }}
        />
      );
      case 'commercial-invoices': return commercialInvView === 'create' ? (
        <CommercialInvoiceForm
          key="commercial-invoice-form"
          editCommercialInvoice={editDoc}
          onCancel={() => { setCommercialInvView('list'); setEditDoc(null); }}
          onSuccess={() => { setCommercialInvView('list'); setEditDoc(null); }}
        />
      ) : (
        <CommercialInvoiceList
          key="commercial-invoice-list"
          onNewInvoice={() => { setEditDoc(null); setCommercialInvView('create'); }}
          onEdit={(inv) => { setEditDoc(inv); setCommercialInvView('create'); }}
        />
      );
      case 'settings': return (
        <PlaceholderPage
          title="Settings"
          description="Application preferences and company configuration. Coming soon."
        />
      );
      default: return null;
    }
  };

  const isDocsSection = DOCS_SECTIONS.has(activeSection);

  return (
    <div className="dashboard-layout">
      {/* ── Sidebar: swap for DocsSidebar inside PO / Quotation sections ── */}
      {isDocsSection ? (
        <DocsSidebar
          activeSection={activeSection}
          activeView={docsView}
          onNavigate={handleNavigate}
          onViewChange={handleDocsViewChange}
          onBack={handleDocsBack}
        />
      ) : (
        <Sidebar
          activeSection={activeSection}
          onNavigate={handleNavigate}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile Overlay ────────────────────────── */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0,
            zIndex: 200, height: '100vh', width: 'var(--sidebar-width)',
          }}
        >
          {isDocsSection ? (
            <DocsSidebar
              activeSection={activeSection}
              activeView={docsView}
              onNavigate={handleNavigate}
              onViewChange={setDocsView}
              onBack={handleDocsBack}
            />
          ) : (
            <Sidebar
              activeSection={activeSection}
              onNavigate={handleNavigate}
              onClose={() => setSidebarOpen(false)}
            />
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
            style={{
              position: 'absolute', top: '16px', right: '-44px',
              width: '36px', height: '36px',
              background: 'rgba(0,0,0,0.5)', border: 'none',
              borderRadius: '50%', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* ── Main Area ─────────────────────────────── */}
      <div className="main-area">
        {/* Top Header */}
        <header className="top-header" role="banner">
          {/* Left: Hamburger + Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
              aria-controls="sidebar-nav"
            >
              <Menu size={18} />
            </button>

            <label htmlFor="global-search" className="sr-only" style={{ position: 'absolute', left: '-9999px' }}>
              Search invoices
            </label>
            <div className="header-search">
              <Search className="header-search-icon" aria-hidden="true" />
              <input
                id="global-search"
                type="search"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Right: Actions + Profile */}
          <div className="header-actions">
            <button className="header-icon-btn" aria-label="Notifications" type="button">
              <Bell size={17} aria-hidden="true" />
              <span className="header-notif-dot" aria-hidden="true" />
            </button>

            <div
              className="header-profile"
              role="button"
              tabIndex={0}
              aria-label="User profile menu"
              onKeyDown={(e) => e.key === 'Enter' && undefined}
            >
              <div className="header-avatar" aria-hidden="true">
                A
              </div>
              <span className="header-username">Admin</span>
              <ChevronDown size={14} color="rgba(255,255,255,0.7)" aria-hidden="true" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main
          className="page-content animate-slide-up"
          id="main-content"
          role="main"
          aria-label={pageTitle}
          key={activeSection + invoiceView}
        >
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
