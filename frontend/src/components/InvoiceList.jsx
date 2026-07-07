import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001/api';

export default function InvoiceList({ onEdit, onCreateNew }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Extended view state: track which invoice numbers are expanded
  const [expandedInvoice, setExpandedInvoice] = useState(null);

  // PDF Preview State
  const [previewUrl, setPreviewUrl] = useState('');

  const fetchInvoices = () => {
    setLoading(true);
    let url = `${API_BASE}/invoices?`;
    if (search) url += `search=${search}&`;
    if (filterCompany) url += `companyCode=${filterCompany}&`;
    if (filterType) url += `invoiceType=${filterType}&`;
    if (filterStatus) url += `status=${filterStatus}&`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        setInvoices(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching invoices:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInvoices();
  }, [search, filterCompany, filterType, filterStatus]);

  // Handle Cancel Invoice
  const handleCancel = (invoiceNumber, e) => {
    e.stopPropagation(); // Avoid expanding/collapsing row on click
    if (!window.confirm(`Are you sure you want to CANCEL invoice ${invoiceNumber}? This action will mark it cancelled in the database and audit trail.`)) {
      return;
    }

    fetch(`${API_BASE}/invoices/${invoiceNumber}/cancel`, {
      method: 'POST'
    })
      .then(res => {
        if (!res.ok) throw new Error("Cancel failed");
        return res.json();
      })
      .then(() => {
        fetchInvoices();
        if (expandedInvoice === invoiceNumber) {
          setExpandedInvoice(null);
        }
      })
      .catch(err => alert(err.message));
  };

  // Toggle expanded details
  const toggleExpand = (invoiceNumber) => {
    if (expandedInvoice === invoiceNumber) {
      setExpandedInvoice(null);
    } else {
      setExpandedInvoice(invoiceNumber);
    }
  };

  const handleOpenPdf = (invoiceNumber, e) => {
    e.stopPropagation();
    const pdfUrl = `${API_BASE}/invoices/${invoiceNumber}/pdf`;
    setPreviewUrl(pdfUrl);
  };

  const handleDownloadPdf = (invoiceNumber, e) => {
    e.stopPropagation();
    // Use the PDF API URL; the anchor's `download` attribute triggers save-to-disk
    const pdfUrl = `${API_BASE}/invoices/${invoiceNumber}/pdf`;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `${invoiceNumber.replace(/\//g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Format date helper
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Parse audit log diff helper
  const renderAuditDetails = (log) => {
    try {
      const details = JSON.parse(log.details);
      if (log.action === "CREATE") {
        return <span>Invoice created.</span>;
      }
      if (log.action === "CANCEL") {
        return <span style={{ color: 'var(--danger-color)' }}>Invoice cancelled.</span>;
      }
      if (log.action === "REGENERATE") {
        const changes = [];
        if (details.before?.buyerName !== details.after?.buyerName) {
          changes.push(`Buyer Name changed from "${details.before.buyerName}" to "${details.after.buyerName}"`);
        }
        if (details.before?.grandTotal !== details.after?.grandTotal) {
          changes.push(`Grand Total changed from ₹${details.before.grandTotal} to ₹${details.after.grandTotal}`);
        }
        if (details.before?.itemsCount !== details.after?.itemsCount) {
          changes.push(`Line items count changed from ${details.before.itemsCount} to ${details.after.itemsCount}`);
        }
        if (new Date(details.before?.invoiceDate).getTime() !== new Date(details.after?.invoiceDate).getTime()) {
          changes.push(`Invoice Date changed`);
        }
        return (
          <div>
            <strong>Regenerated and PDF Overwritten.</strong>
            {changes.length > 0 ? (
              <ul style={{ paddingLeft: '16px', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                {changes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}> (No core structural values changed)</span>
            )}
          </div>
        );
      }
      return <span>Action logged.</span>;
    } catch (e) {
      return <span>{log.details}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Search and Filters Header */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flex: 1, minWidth: '300px', gap: '12px' }}>
          <input
            type="text"
            placeholder="Search by invoice number, buyer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} style={{ width: '160px' }}>
            <option value="">All Companies</option>
            <option value="AVIONAUTICS">Avionautics</option>
            <option value="GMP">GMP International</option>
          </select>

          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: '160px' }}>
            <option value="">All Types</option>
            <option value="TAX">Tax Invoice</option>
            <option value="PROFORMA">Proforma Invoice</option>
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: '160px' }}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <button className="btn btn-primary" onClick={onCreateNew}>
            + Create Invoice
          </button>
        </div>
      </div>

      {/* Invoice Table list */}
      <div className="card" style={{ padding: '0px', overflowX: 'auto' }}>
        <table className="items-table" style={{ margin: 0 }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 1)' }}>
              <th style={{ width: '40px' }}></th>
              <th>Invoice No</th>
              <th>Company</th>
              <th>Date</th>
              <th>Type</th>
              <th>Buyer</th>
              <th>Grand Total</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading invoices...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No invoices found matching criteria.
                </td>
              </tr>
            ) : (
              invoices.map(invoice => {
                const isExpanded = expandedInvoice === invoice.invoiceNumber;
                return (
                  <React.Fragment key={invoice.id}>
                    <tr
                      onClick={() => toggleExpand(invoice.invoiceNumber)}
                      style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ textAlign: 'center', fontSize: '16px' }}>
                        {isExpanded ? '▼' : '▶'}
                      </td>
                      <td style={{ fontWeight: 'bold' }}>{invoice.invoiceNumber}</td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          background: invoice.company.code === 'AVIONAUTICS' ? 'rgba(118, 30, 29, 0.2)' : 'rgba(255,255,255,0.05)',
                          color: invoice.company.code === 'AVIONAUTICS' ? '#991b1bff' : 'red',
                          border: `1px solid ${invoice.company.code === 'AVIONAUTICS' ? '#ffffff' : '#333'}`
                        }}>
                          {invoice.company.displayName}
                        </span>
                      </td>
                      <td>{formatDate(invoice.invoiceDate)}</td>
                      <td>
                        <span style={{ fontWeight: '500', fontSize: '12px' }}>
                          {invoice.invoiceType === 'TAX' ? 'Tax' : 'Proforma'}
                        </span>
                      </td>
                      <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <strong>{invoice.buyerName}</strong>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>GSTIN: {invoice.buyerGstin}</div>
                      </td>
                      <td style={{ fontWeight: 'bold', color: 'var(--theme-accent)' }}>
                        ₹{invoice.grandTotal.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className={`badge-status ${invoice.status === 'ACTIVE' ? 'badge-active' : 'badge-cancelled'}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                            onClick={(e) => handleOpenPdf(invoice.invoiceNumber, e)}
                          >
                            View PDF
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                            onClick={(e) => handleDownloadPdf(invoice.invoiceNumber, e)}
                            aria-label={`Download PDF for invoice ${invoice.invoiceNumber}`}
                          >
                            ↓ Download
                          </button>

                          {invoice.status === 'ACTIVE' && (
                            <>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '12px' }}
                                onClick={() => onEdit(invoice)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-danger"
                                style={{ padding: '6px 10px', fontSize: '12px' }}
                                onClick={(e) => handleCancel(invoice.invoiceNumber, e)}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr style={{ background: 'rgba(255, 255, 255, 0.015)' }}>
                        <td colSpan="9" style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            {/* Left Side: Items & paths */}
                            <div>
                              <h4 style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                Nextcloud WebDAV Storage
                              </h4>
                              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
                                {invoice.nextcloudPath || "N/A"}
                              </div>

                              <h4 style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                Itemized Breakdown
                              </h4>
                              <table style={{ width: '100%', fontSize: '12px' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '6px 0', color: 'var(--text-muted)' }}>Description</th>
                                    <th style={{ padding: '6px 0', textAlign: 'right', color: 'var(--text-muted)' }}>Qty</th>
                                    <th style={{ padding: '6px 0', textAlign: 'right', color: 'var(--text-muted)' }}>Rate</th>
                                    <th style={{ padding: '6px 0', textAlign: 'right', color: 'var(--text-muted)' }}>Tax %</th>
                                    <th style={{ padding: '6px 0', textAlign: 'right', color: 'var(--text-muted)' }}>Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {invoice.items?.map((it, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                      <td style={{ padding: '6px 0' }}>{it.description} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({it.hsnCode})</span></td>
                                      <td style={{ padding: '6px 0', textAlign: 'right' }}>{it.qty} {it.uom}</td>
                                      <td style={{ padding: '6px 0', textAlign: 'right' }}>₹{it.rate.toFixed(2)}</td>
                                      <td style={{ padding: '6px 0', textAlign: 'right' }}>{it.taxRate}%</td>
                                      <td style={{ padding: '6px 0', textAlign: 'right' }}>₹{it.amount.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Right Side: Audit logs trail */}
                            <div>
                              <h4 style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                Invoice Audit Trail & Edit History
                              </h4>
                              <div className="audit-list">
                                {invoice.auditLogs?.length === 0 ? (
                                  <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No audit history found.</div>
                                ) : (
                                  invoice.auditLogs?.map(log => (
                                    <div key={log.id} className="audit-item">
                                      <div className="audit-meta">
                                        <span style={{
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontWeight: 'bold',
                                          fontSize: '9px',
                                          background: log.action === 'CREATE' ? 'rgba(16, 185, 129, 0.15)' : log.action === 'CANCEL' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                          color: log.action === 'CREATE' ? 'var(--ok-color)' : log.action === 'CANCEL' ? 'var(--danger-color)' : 'var(--warn-color)'
                                        }}>
                                          {log.action}
                                        </span>
                                        <span>{new Date(log.timestamp).toLocaleString('en-IN')}</span>
                                      </div>
                                      <div style={{ fontSize: '12px', marginTop: '4px' }}>
                                        {renderAuditDetails(log)}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Download button in expanded row */}
                          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '7px 14px', fontSize: '12px' }}
                              onClick={(e) => handleOpenPdf(invoice.invoiceNumber, e)}
                              aria-label={`Preview PDF for ${invoice.invoiceNumber}`}
                            >
                              Preview PDF
                            </button>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '7px 14px', fontSize: '12px' }}
                              onClick={(e) => handleDownloadPdf(invoice.invoiceNumber, e)}
                              aria-label={`Download PDF for ${invoice.invoiceNumber}`}
                            >
                              ↓ Download PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* PDF Preview Modal Backdrop */}
      {previewUrl && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px'
        }}>
          <div style={{
            background: 'var(--bg-surface-solid)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: '1000px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Invoice PDF Preview</h3>
              <button className="btn btn-secondary" onClick={() => setPreviewUrl('')} style={{ padding: '6px 12px' }}>
                Close Preview
              </button>
            </div>
            <div style={{ flex: 1, background: '#525659' }}>
              <iframe
                src={previewUrl}
                title="Invoice PDF"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
