import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, Download, XCircle, ShoppingCart, Package, Wrench } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n ?? 0);

const STATUS_COLORS = { ACTIVE: '#348F6C', CANCELLED: '#ef4444' };
const TYPE_COLORS   = { GOODS: '#3b82f6', SERVICE: '#f59e0b' };

export default function POList({ onCreateNew, onEdit }) {
  const [pos, setPOs]                   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterType, setFilterType]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [previewUrl, setPreviewUrl]     = useState('');
  const [expanded, setExpanded]         = useState(null);

  const fetchPOs = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)        params.set('search', search);
    if (filterCompany) params.set('companyCode', filterCompany);
    if (filterType)    params.set('poType', filterType);
    if (filterStatus)  params.set('status', filterStatus);

    fetch(`${API_BASE}/po?${params}`)
      .then(r => r.json())
      .then(data => { setPOs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(fetchPOs, [search, filterCompany, filterType, filterStatus]);

  const handleCancel = (po, e) => {
    e.stopPropagation();
    if (!window.confirm(`Cancel PO ${po.poNumber}? This cannot be undone.`)) return;
    const [prefix, , type, fy, seq] = po.poNumber.split('/');
    fetch(`${API_BASE}/po/${prefix}/${type}/${fy}/${seq}/cancel`, { method: 'POST' })
      .then(r => { if (!r.ok) throw new Error('Cancel failed'); return r.json(); })
      .then(fetchPOs)
      .catch(err => alert(err.message));
  };

  const handlePreview = (po, e) => {
    e.stopPropagation();
    const [prefix, , type, fy, seq] = po.poNumber.split('/');
    setPreviewUrl(`${API_BASE}/po/${prefix}/${type}/${fy}/${seq}/pdf`);
  };

  const handleDownload = (po, e) => {
    e.stopPropagation();
    const [prefix, , type, fy, seq] = po.poNumber.split('/');
    window.open(`${API_BASE}/po/${prefix}/${type}/${fy}/${seq}/pdf`, '_blank');
  };

  const inputStyle = {
    background: 'white', border: '1px solid var(--border-color)', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-main)',
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ───────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--text-main)' }}>
            Purchase Orders
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {pos.length} order{pos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onCreateNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--color-primary)', color: 'white', border: 'none',
            borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600,
            fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'var(--transition-smooth)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-primary-dark)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--color-primary)'}
        >
          <Plus size={16} aria-hidden="true" /> New PO
        </button>
      </div>

      {/* ── Filters ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...inputStyle, minWidth: 220 }}>
          <Search size={14} color="var(--text-muted)" aria-hidden="true" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search PO number or vendor…"
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-main)', width: '100%' }}
          />
        </div>
        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} style={inputStyle}>
          <option value="">All Companies</option>
          <option value="AVIONAUTICS">Avionautics</option>
          <option value="GMP">GMP International</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={inputStyle}>
          <option value="">All Types</option>
          <option value="GOODS">Goods</option>
          <option value="SERVICE">Service</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle}>
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* ── Table ────────────────────────────────────── */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Loading…</p>
      ) : pos.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 0', color: 'var(--text-muted)' }}>
          <ShoppingCart size={40} color="var(--border-color)" aria-hidden="true" />
          <p style={{ fontSize: 15, fontWeight: 600 }}>No purchase orders yet.</p>
          <button onClick={onCreateNew} style={{ color: 'var(--color-primary)', background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
            Create your first PO →
          </button>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                {['PO Number', 'Vendor', 'Type', 'Date', 'Total', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', textAlign: h === 'Total' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pos.map((po, i) => (
                <tr
                  key={po.id}
                  onClick={() => setExpanded(expanded === po.id ? null : po.id)}
                  style={{ borderBottom: i < pos.length - 1 ? '1px solid var(--border-color)' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{po.poNumber}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-main)', fontWeight: 500 }}>{po.vendorName}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${TYPE_COLORS[po.poType]}18`, color: TYPE_COLORS[po.poType], borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
                      {po.poType === 'GOODS' ? <Package size={11} /> : <Wrench size={11} />}
                      {po.poType}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{new Date(po.poDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{fmt(po.grandTotal)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: `${STATUS_COLORS[po.status]}18`, color: STATUS_COLORS[po.status], borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
                      {po.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <button onClick={e => handlePreview(po, e)} title="Preview PDF" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-primary)', padding: 4 }}><Eye size={15} /></button>
                      <button onClick={e => handleDownload(po, e)} title="Download PDF" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Download size={15} /></button>
                      {po.status === 'ACTIVE' && (
                        <>
                          <button onClick={e => { e.stopPropagation(); onEdit(po); }} title="Edit" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, fontSize: 12, fontFamily: 'var(--font-body)' }}>Edit</button>
                          <button onClick={e => handleCancel(po, e)} title="Cancel PO" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger-color)', padding: 4 }}><XCircle size={15} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PDF Preview Modal ─────────────────────────── */}
      {previewUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setPreviewUrl('')}>
          <div style={{ width: '90%', maxWidth: 900, height: '90vh', background: 'white', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <button onClick={() => setPreviewUrl('')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
            </div>
            <iframe src={previewUrl} style={{ flex: 1, border: 'none' }} title="PO PDF Preview" />
          </div>
        </div>
      )}
    </div>
  );
}
