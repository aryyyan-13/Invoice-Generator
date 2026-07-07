import React, { useState, useEffect, useMemo } from 'react';
import { Search, User, MapPin, Hash, FileText } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

/* ── Client card ─────────────────────────────────────── */
function ClientCard({ client }) {
  const initials = client.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  // Generate a consistent hue from name for avatar color
  const hue = [...client.name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <div style={{
      background: 'white', border: '1px solid var(--border-color)',
      borderRadius: 14, padding: '20px 24px',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex', flexDirection: 'column', gap: 14,
      transition: 'var(--transition-smooth)',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
    >
      {/* Header row: avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: `hsl(${hue}, 50%, 88%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700,
          color: `hsl(${hue}, 50%, 30%)`,
        }} aria-hidden="true">
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {client.name}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {client.invoiceCount} invoice{client.invoiceCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Detail rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
        {client.gstin && client.gstin !== 'URD' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Hash size={14} color="var(--color-primary)" style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
            <div>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block' }}>GSTIN</span>
              <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-main)' }}>{client.gstin}</span>
            </div>
          </div>
        )}

        {client.gstin === 'URD' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={14} color="var(--text-muted)" aria-hidden="true" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Unregistered Dealer</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <MapPin size={14} color="var(--color-primary)" style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
          <div>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block' }}>Address</span>
            <span style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>{client.address}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <FileText size={13} color="var(--text-muted)" aria-hidden="true" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Last invoice: <strong style={{ color: 'var(--text-main)' }}>{new Date(client.lastInvoiceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Clients Page ───────────────────────────────── */
export default function Clients() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/invoices`)
      .then(r => { if (!r.ok) throw new Error('Failed to load invoices'); return r.json(); })
      .then(data => { setInvoices(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  /* ── Deduplicate by GSTIN (or name for URD) ─────────── */
  const clients = useMemo(() => {
    const map = {};
    invoices.forEach(inv => {
      const key = (inv.buyerGstin && inv.buyerGstin !== 'URD')
        ? inv.buyerGstin
        : `URD::${inv.buyerName}`;

      if (!map[key]) {
        map[key] = {
          key,
          name: inv.buyerName,
          gstin: inv.buyerGstin || 'URD',
          address: inv.buyerAddress,
          invoiceCount: 0,
          lastInvoiceDate: inv.invoiceDate,
        };
      }
      map[key].invoiceCount++;
      if (new Date(inv.invoiceDate) > new Date(map[key].lastInvoiceDate)) {
        map[key].lastInvoiceDate = inv.invoiceDate;
      }
    });

    return Object.values(map).sort((a, b) => b.invoiceCount - a.invoiceCount);
  }, [invoices]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.gstin.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q)
    );
  }, [clients, search]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
      <p>Loading clients…</p>
    </div>
  );

  if (error) return (
    <div style={{ color: 'var(--danger-color)', padding: 24 }}>
      Error: {error}. Ensure the backend is running.
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page heading + search */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--text-main)' }}>
            Client Directory
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {clients.length} unique client{clients.length !== 1 ? 's' : ''} extracted from your invoices.
          </p>
        </div>

        {/* Search bar */}
        <label htmlFor="client-search" style={{ position: 'absolute', left: '-9999px' }}>Search clients</label>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'white', border: '1px solid var(--border-color)',
          borderRadius: 10, padding: '9px 14px', minWidth: 240,
          transition: 'var(--transition-smooth)',
        }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
        >
          <Search size={15} color="var(--text-muted)" aria-hidden="true" />
          <input
            id="client-search"
            type="search"
            placeholder="Search by name, GSTIN or address…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              border: 'none', background: 'transparent', outline: 'none',
              fontSize: 13, color: 'var(--text-main)', fontFamily: 'var(--font-body)',
              width: '100%', padding: 0,
            }}
            autoComplete="off"
          />
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '40vh', gap: 12, color: 'var(--text-muted)', textAlign: 'center',
        }}>
          <User size={40} color="var(--border-color)" aria-hidden="true" />
          <p style={{ fontSize: 15, fontWeight: 600 }}>
            {search ? 'No clients match your search.' : 'No clients found.'}
          </p>
          <p style={{ fontSize: 13 }}>
            {search ? 'Try a different search term.' : 'Clients will appear here once you create invoices.'}
          </p>
        </div>
      )}

      {/* Client Grid */}
      {filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}>
          {filtered.map(client => (
            <ClientCard key={client.key} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}
