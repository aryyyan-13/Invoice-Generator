import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, FileText, Receipt, Building2 } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

/* ── Custom tooltip for charts ─────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'white', border: '1px solid var(--border-color)',
      borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--shadow-md)',
      fontFamily: 'var(--font-mono)', fontSize: 12, fontVariantNumeric: 'tabular-nums'
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', fontSize: 10 }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color, fontWeight: 600 }}>
          {entry.name}: {fmt(entry.value)}
        </p>
      ))}
    </div>
  );
}

/* ── Summary card ──────────────────────────────────── */
function MetricCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{
      background: 'white', border: '1px solid var(--border-color)',
      borderRadius: 10, padding: '20px 24px',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex', alignItems: 'flex-start', gap: 16,
      transition: 'var(--transition-smooth)',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 10, flexShrink: 0,
        background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={22} color={color} aria-hidden="true" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          {label}
        </p>
        <p style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
          {value}
        </p>
        {sub && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────── */
export default function Dashboard() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revenueBy, setRevenueBy] = useState('AV'); // 'AV' | 'GMP' | 'ALL'

  useEffect(() => {
    fetch(`${API_BASE}/invoices`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(data => { setInvoices(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  /* ── Computed metrics ────────────────────────────── */
  const activeInvoices = useMemo(() => invoices.filter(i => i.status === 'ACTIVE'), [invoices]);
  const taxInvoices = useMemo(() => activeInvoices.filter(i => i.invoiceType === 'TAX'), [activeInvoices]);

  const totalRevenue = useMemo(
    () => taxInvoices.reduce((s, i) => s + (i.grandTotal || 0), 0),
    [taxInvoices]
  );

  const totalInvoices = invoices.length;
  const activeCount = activeInvoices.length;

  /* ── Revenue over time (group by month-year) ──────── */
  const chartData = useMemo(() => {
    const filtered = revenueBy === 'ALL'
      ? taxInvoices
      : taxInvoices.filter(i => i.company?.invoicePrefix === revenueBy);

    const byMonth = {};
    filtered.forEach(inv => {
      const d = new Date(inv.invoiceDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      if (!byMonth[key]) byMonth[key] = { key, label, revenue: 0 };
      byMonth[key].revenue += inv.grandTotal || 0;
    });

    return Object.values(byMonth)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(m => ({ ...m, revenue: Math.round(m.revenue) }));
  }, [taxInvoices, revenueBy]);

  /* ── Per-company totals (for table) ──────────────── */
  const byCompany = useMemo(() => {
    const map = {};
    taxInvoices.forEach(inv => {
      const name = inv.company?.displayName || 'Unknown';
      if (!map[name]) map[name] = { name, revenue: 0, count: 0 };
      map[name].revenue += inv.grandTotal || 0;
      map[name].count++;
    });
    return Object.values(map);
  }, [taxInvoices]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
      <p>Loading dashboard…</p>
    </div>
  );

  if (error) return (
    <div style={{ color: 'var(--danger-color)', padding: 24 }}>
      Error loading data: {error}. Ensure the backend is running.
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Page heading */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--text-main)' }}>
          Overview
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Real-time metrics across all companies and fiscal years.
        </p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <MetricCard
          icon={TrendingUp}
          label="Total Revenue (Tax)"
          value={fmt(totalRevenue)}
          sub="Across all active tax invoices"
          color="#348F6C"
        />
        <MetricCard
          icon={FileText}
          label="Total Invoices"
          value={totalInvoices.toLocaleString('en-IN')}
          sub={`${activeCount} active · ${totalInvoices - activeCount} cancelled`}
          color="#3b82f6"
        />
        <MetricCard
          icon={Receipt}
          label="Tax Invoices"
          value={taxInvoices.length.toLocaleString('en-IN')}
          sub="Active GST tax invoices"
          color="#f59e0b"
        />
        <MetricCard
          icon={Building2}
          label="Companies"
          value="2"
          sub="Avionautics · GMP International"
          color="#8b5cf6"
        />
      </div>

      {/* Revenue Chart */}
      <div style={{
        background: 'white', border: '1px solid var(--border-color)',
        borderRadius: 8, padding: '24px', boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
              Revenue Over Time
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Monthly tax invoice revenue (₹)
            </p>
          </div>
          {/* Company filter */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[['ALL', 'All'], ['AV', 'Avionautics'], ['GMP', 'GMP Intl']].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setRevenueBy(val)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--border-color)', cursor: 'pointer',
                  background: revenueBy === val ? 'var(--color-primary)' : 'var(--bg-surface)',
                  color: revenueBy === val ? 'white' : 'var(--text-muted)',
                  transition: 'var(--transition-fast)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No tax invoice data for the selected company.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#348F6C" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#348F6C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8d8d9c', fontFamily: 'var(--font-body)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#8d8d9c', fontFamily: 'var(--font-body)' }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#348F6C" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 4, fill: '#348F6C', strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Per-Company breakdown table */}
      {byCompany.length > 0 && (
        <div style={{
          background: 'white', border: '1px solid var(--border-color)',
          borderRadius: 8, padding: '24px', boxShadow: 'var(--shadow-sm)',
        }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 16 }}>
            Revenue by Company
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)' }}>
            <thead>
              <tr>
                {['Company', 'Tax Invoices', 'Total Revenue'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--bg-surface)', fontWeight: 700 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byCompany.map((c, i) => (
                <tr key={c.name} style={{ borderBottom: i < byCompany.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                  <td style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-main)', fontSize: 14 }}>{c.name}</td>
                  <td style={{ padding: '12px 12px', color: 'var(--text-muted)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{c.count}</td>
                  <td style={{ padding: '12px 12px', fontWeight: 700, color: 'var(--color-primary)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmt(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
