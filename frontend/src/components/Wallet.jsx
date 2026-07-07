import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CreditCard, Building2, Smartphone, Copy, CheckCheck } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

/* ── Copy-to-clipboard helper button ─────────────────── */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      aria-label={copied ? 'Copied!' : `Copy ${text}`}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: copied ? 'var(--color-primary)' : 'var(--text-muted)',
        display: 'inline-flex', alignItems: 'center', padding: '2px 4px',
        borderRadius: 4, transition: 'var(--transition-fast)',
      }}
    >
      {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
    </button>
  );
}

/* ── Detail row ──────────────────────────────────────── */
function DetailRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-color)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}
      </span>
      <span style={{
        fontSize: 14, color: 'var(--text-main)', fontWeight: 600,
        fontFamily: mono ? 'monospace' : 'var(--font-body)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {value}
        <CopyBtn text={value} />
      </span>
    </div>
  );
}

/* ── Company Wallet Card ─────────────────────────────── */
function CompanyWalletCard({ company }) {
  // Standard UPI deep link for QR
  const upiUri = `upi://pay?pa=${encodeURIComponent(company.upiId)}&pn=${encodeURIComponent(company.displayName)}&cu=INR`;

  return (
    <div style={{
      background: 'white', border: '1px solid var(--border-color)',
      borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Header bar */}
      <div style={{
        background: `linear-gradient(135deg, ${company.themePrimary}ee, ${company.themePrimary}99)`,
        padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Building2 size={22} color="white" aria-hidden="true" />
        </div>
        <div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 700, color: 'white', margin: 0 }}>
            {company.displayName}
          </h3>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, marginTop: 2 }}>
            GSTIN: {company.gstin}
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start' }}>
        {/* Bank & UPI Details */}
        <div>
          {/* Bank Details */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <CreditCard size={15} color="var(--color-primary)" aria-hidden="true" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-heading)' }}>
                Bank Details
              </span>
            </div>
            <DetailRow label="Account Name" value={company.accountName} />
            <DetailRow label="Account No." value={company.accountNo} mono />
            <DetailRow label="Bank" value={company.bankName} />
            <DetailRow label="IFSC" value={company.ifsc} mono />
          </div>

          {/* UPI Details */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Smartphone size={15} color="var(--color-primary)" aria-hidden="true" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-heading)' }}>
                UPI
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--text-main)', flex: 1 }}>
                {company.upiId}
              </span>
              <CopyBtn text={company.upiId} />
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            padding: 12, background: 'white', borderRadius: 12, border: '2px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <QRCodeSVG
              value={upiUri}
              size={130}
              fgColor={company.themePrimary === '#000000' ? '#1a1a2e' : company.themePrimary}
              bgColor="white"
              level="M"
              aria-label={`UPI QR code for ${company.displayName}`}
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 140, lineHeight: 1.5 }}>
            Scan to pay via any UPI app
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Main Wallet Page ────────────────────────────────── */
export default function Wallet() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/companies`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(data => { setCompanies(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
      <p>Loading wallet…</p>
    </div>
  );

  if (error) return (
    <div style={{ color: 'var(--danger-color)', padding: 24 }}>
      Error: {error}. Ensure the backend is running.
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Page heading */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--text-main)' }}>
          Wallet
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Bank details and UPI payment QR codes for your companies.
        </p>
      </div>

      {/* Company Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {companies.map(company => (
          <CompanyWalletCard key={company.id} company={company} />
        ))}
      </div>

      {/* Disclaimer */}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
        QR codes use the standard UPI deep link format. Scan with Google Pay, PhonePe, Paytm, or any compatible UPI app.
      </p>
    </div>
  );
}
