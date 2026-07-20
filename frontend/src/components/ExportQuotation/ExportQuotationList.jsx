import React, { useState, useEffect } from 'react';
import { Eye, Download, XCircle, Plus, Pencil } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

export default function ExportQuotationList({ onNewQuote, onEdit }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  const fetchQuotes = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterStatus) params.set('status', filterStatus);
    fetch(`${API_BASE}/export-quotations?${params}`)
      .then(r => r.json())
      .then(data => { setQuotes(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(fetchQuotes, [search, filterStatus]);

  const handleCancel = (q, e) => {
    e.stopPropagation();
    if (!window.confirm(`Cancel Export Quotation ${q.quoteNumber}?`)) return;
    fetch(`${API_BASE}/export-quotations/${encodeURIComponent(q.quoteNumber)}/cancel`, { method: 'POST' })
      .then(() => fetchQuotes())
      .catch(err => alert(err.message));
  };

  const statusBadge = (s) => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: s === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
    color: s === 'ACTIVE' ? '#166534' : '#991b1b',
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-main)' }}>🌍 Export Quotations</h2>
        <button onClick={onNewQuote} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#1a6b3c', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          <Plus size={16} /> New Export Quotation
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input type="text" placeholder="Search by client or quote number…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 14, color: '#000' }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 14, color: '#000', background: 'white' }}>
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>
      ) : quotes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
          <div>No export quotations found. Create your first one!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {quotes.map(q => (
            <div key={q.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{q.quoteNumber}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{q.clientName} · {q.clientCountry} · {q.dispatchMethod}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{new Date(q.quoteDate).toLocaleDateString('en-IN')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#1a6b3c' }}>₹{q.grandTotal?.toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{q.grandTotalConverted} {q.outputCurrency}</div>
                  </div>
                  <span style={statusBadge(q.status)}>{q.status}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button title="Preview PDF" onClick={() => setPreviewUrl(`${API_BASE}/export-quotations/${encodeURIComponent(q.quoteNumber)}/pdf`)}
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      <Eye size={15} />
                    </button>
                    <a href={`${API_BASE}/export-quotations/${encodeURIComponent(q.quoteNumber)}/pdf`} download={`${q.quoteNumber.replace(/\//g,'_')}.pdf`}
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                      <Download size={15} />
                    </a>
                    {q.status === 'ACTIVE' && (
                      <>
                        <button title="Edit" onClick={e => { e.stopPropagation(); onEdit?.(q); }}
                          style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid #bfdbfe', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: '#3b82f6' }}>
                          <Pencil size={15} />
                        </button>
                        <button title="Cancel" onClick={e => handleCancel(q, e)}
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: '#ef4444' }}>
                          <XCircle size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '90vw', maxWidth: 900, marginBottom: 8 }}>
            <button onClick={() => setPreviewUrl(null)} style={{ background: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700 }}>✕ Close</button>
          </div>
          <iframe src={previewUrl} style={{ width: '90vw', maxWidth: 900, height: '85vh', border: 'none', borderRadius: 8 }} title="PDF Preview" />
        </div>
      )}
    </div>
  );
}
