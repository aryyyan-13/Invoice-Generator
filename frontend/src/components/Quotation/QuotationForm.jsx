import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';
const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.'];
const UOM_OPTIONS = ['nos', 'kg', 'units', 'pcs', 'ltr', 'mtr', 'set', 'hrs', 'job'];
const DEFAULT_ITEM = { description: '', uom: 'nos', qty: '', rate: '', taxRate: 18 };

import { getGstSplit } from '../../../../utils/sharedFinancialUtils.js';
import { FORCE_MAJEURE_BOILERPLATE } from '../../../../utils/quotationUtils.js';

const inputStyle = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)',
  borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-main)',
  background: 'white', outline: 'none',
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4, display: 'block' };
const section = { background: 'white', border: '1px solid var(--border-color)', borderRadius: 8, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 };
const row = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
const row3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 };

export default function QuotationForm({ editQuotation, onCancel, onSuccess }) {
  const [companies, setCompanies]       = useState([]);
  const [companyCode, setCompanyCode]   = useState('');
  const [qType, setQType]               = useState('GOODS');
  const [qDate, setQDate]               = useState(new Date().toISOString().split('T')[0]);
  const [nextQNumber, setNextQNumber]   = useState('');

  const [clientName, setClientName]         = useState('');
  const [clientGstin, setClientGstin]       = useState('');
  const [clientAddress, setClientAddress]   = useState('');
  const [clientContact, setClientContact]   = useState('');
  const [salutation, setSalutation]         = useState('Mr.');
  const [attentionName, setAttentionName]   = useState('');

  const [items, setItems]         = useState([{ ...DEFAULT_ITEM }]);
  const [discount, setDiscount]   = useState('');
  const [roundOverride, setRoundOverride] = useState('');

  const [advancePct, setAdvancePct]         = useState('');
  const [balanceMode, setBalanceMode]       = useState('ON_DELIVERY');
  const [netDays, setNetDays]               = useState('');
  const [termsAndConditions, setTerms]      = useState('');
  const [forceMajeure, setForceMajeure]     = useState('');
  const [showFMInput, setShowFMInput]       = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/companies`).then(r => r.json()).then(setCompanies).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editQuotation) return;
    setCompanyCode(editQuotation.company?.code ?? '');
    setQType(editQuotation.quotationType ?? 'GOODS');
    setQDate(editQuotation.quotationDate?.split('T')[0] ?? '');
    setClientName(editQuotation.clientName ?? '');
    setClientGstin(editQuotation.clientGstin ?? '');
    setClientAddress(editQuotation.clientAddress ?? '');
    setClientContact(editQuotation.clientContactNo ?? '');
    setSalutation(editQuotation.attentionSalutation ?? 'Mr.');
    setAttentionName(editQuotation.attentionName ?? '');
    setAdvancePct(String(editQuotation.paymentAdvancePct ?? ''));
    setBalanceMode(editQuotation.paymentBalanceMode ?? 'ON_DELIVERY');
    setNetDays(String(editQuotation.paymentNetDays ?? ''));
    setTerms(editQuotation.termsAndConditions ?? '');
    setForceMajeure(editQuotation.forceMajeureClause ?? '');
    setShowFMInput(!!editQuotation.forceMajeureClause);
    setDiscount(String(editQuotation.discountTotal ?? ''));
    setRoundOverride(String(editQuotation.roundAdjustment ?? ''));
    setItems(editQuotation.items?.map(i => ({ ...i })) ?? [{ ...DEFAULT_ITEM }]);
  }, [editQuotation]);

  useEffect(() => {
    if (!companyCode || !qDate) return;
    fetch(`${API_BASE}/quotations/preview-next?companyCode=${companyCode}&quotationType=${qType}&date=${qDate}`)
      .then(r => r.json()).then(d => setNextQNumber(d.nextQuotationNumber ?? '')).catch(() => {});
  }, [companyCode, qType, qDate]);

  const calc = useCallback(() => {
    let subtotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
    const company = companies.find(c => c.code === companyCode);
    const cs = company?.gstin?.substring(0, 2) ?? '';
    const cc = (clientGstin && clientGstin.length >= 2 && clientGstin.toUpperCase() !== 'URD') ? clientGstin.substring(0, 2) : cs;
    const intra = cs === cc || !clientGstin || clientGstin.trim().toUpperCase() === 'URD';

    items.forEach(item => {
      const amt = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
      const tax = parseFloat(item.taxRate) || 0;
      subtotal += amt;
      const { cgstRate, sgstRate, igstRate } = getGstSplit(company?.gstin, clientGstin, tax);
      cgstTotal += amt * (cgstRate / 100);
      sgstTotal += amt * (sgstRate / 100);
      igstTotal += amt * (igstRate / 100);
    });
    const disc  = parseFloat(discount) || 0;
    const taxable = subtotal - disc;
    
    // Distribute tax proportionally over the taxable value
    const taxRatio = subtotal > 0 ? (taxable / subtotal) : 1;
    cgstTotal *= taxRatio;
    sgstTotal *= taxRatio;
    igstTotal *= taxRatio;
    const pre = taxable + cgstTotal + sgstTotal + igstTotal;
    const autoRnd = Math.round(pre) - pre;
    const rnd = roundOverride !== '' ? parseFloat(roundOverride) : parseFloat(autoRnd.toFixed(2));
    return { subtotal, taxable, cgstTotal, sgstTotal, igstTotal, rnd, grand: pre + rnd, intra };
  }, [items, discount, roundOverride, companyCode, companies, clientGstin]);

  const totals = calc();
  const fmt = n => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);

  const addItem = () => setItems(p => [...p, { ...DEFAULT_ITEM }]);
  const removeItem = i => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i, f, v) => setItems(p => p.map((item, idx) => idx === i ? { ...item, [f]: v } : item));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!companyCode) return setError('Please select a company.');
    if (items.every(it => !it.description)) return setError('Add at least one line item.');
    setSubmitting(true);

    const body = {
      companyCode, quotationType: qType, quotationDate: qDate,
      clientName, clientGstin, clientAddress, clientContactNo: clientContact,
      attentionSalutation: salutation, attentionName,
      paymentAdvancePct: parseFloat(advancePct) || 0,
      paymentBalanceMode: balanceMode,
      paymentNetDays: balanceMode === 'NET_DAYS' ? parseInt(netDays) || null : null,
      termsAndConditions,
      forceMajeureClause: showFMInput ? (forceMajeure || FORCE_MAJEURE_BOILERPLATE) : '',
      discount: parseFloat(discount) || 0,
      roundOverride: roundOverride !== '' ? parseFloat(roundOverride) : null,
      items: items.filter(i => i.description),
    };

    try {
      let url = `${API_BASE}/quotations`;
      let method = 'POST';
      if (editQuotation) {
        const [prefix, , type, fy, seq] = editQuotation.quotationNumber.split('/');
        url = `${API_BASE}/quotations/${prefix}/${type}/${fy}/${seq}`;
        method = 'PUT';
      }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCompany = companies.find(c => c.code === companyCode);

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ───────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700 }}>{editQuotation ? 'Edit Quotation' : 'New Quotation'}</h2>
          {nextQNumber && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Will be issued as <strong style={{ color: 'var(--color-primary)' }}>{nextQNumber}</strong></p>}
        </div>
        {/* Type toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 10, padding: 4, border: '1px solid var(--border-color)' }}>
          {['GOODS', 'SERVICE'].map(t => (
            <button key={t} type="button" onClick={() => setQType(t)}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', background: qType === t ? 'var(--color-primary)' : 'transparent', color: qType === t ? 'white' : 'var(--text-muted)', transition: 'var(--transition-smooth)' }}>
              {t === 'GOODS' ? '📦 Goods' : '🔧 Service'}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: 'var(--danger-color)', fontSize: 13 }}>{error}</div>}

      {/* ── Company + Date ────────────────────────────── */}
      <div style={section}>
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>Document Details</p>
        <div style={row}>
          <div>
            <label style={labelStyle}>Issuing Company</label>
            <select value={companyCode} onChange={e => setCompanyCode(e.target.value)} style={inputStyle} required>
              <option value="">Select company…</option>
              {companies.map(c => <option key={c.code} value={c.code}>{c.displayName}</option>)}
            </select>
            {selectedCompany && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-surface)', borderRadius: 8, fontSize: 13, border: '1px solid var(--border-color)', display: 'flex', gap: 12, alignItems: 'center' }}>
                {selectedCompany.logoPath && <img src={`${API_BASE.replace('/api', '')}${selectedCompany.logoPath}`} alt="logo" style={{ height: '32px', width: '32px', objectFit: 'contain' }} />}
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Bank Details</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {selectedCompany.bankName} • A/C: {selectedCompany.accountNo} • IFSC: {selectedCompany.ifsc}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Quotation Date</label>
            <input type="date" value={qDate} onChange={e => setQDate(e.target.value)} style={inputStyle} required />
          </div>
        </div>
      </div>

      {/* ── Client Details ───────────────────────────── */}
      <div style={section}>
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>Client Details</p>
        <div style={row}>
          <div><label style={labelStyle}>Client Name</label><input value={clientName} onChange={e => setClientName(e.target.value)} style={inputStyle} required placeholder="Client Corp. Ltd." /></div>
          <div><label style={labelStyle}>Client GSTIN</label><input value={clientGstin} onChange={e => setClientGstin(e.target.value.toUpperCase())} style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="29AABCV1234C1ZV" /></div>
        </div>
        <div><label style={labelStyle}>Client Address</label><textarea value={clientAddress} onChange={e => setClientAddress(e.target.value)} style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} required /></div>
        <div style={row3}>
          <div><label style={labelStyle}>Contact No.</label><input value={clientContact} onChange={e => setClientContact(e.target.value)} style={inputStyle} placeholder="+91 98765 43210" /></div>
          <div>
            <label style={labelStyle}>Salutation</label>
            <select value={salutation} onChange={e => setSalutation(e.target.value)} style={inputStyle}>
              {SALUTATIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Attention (Name)</label><input value={attentionName} onChange={e => setAttentionName(e.target.value)} style={inputStyle} placeholder="Priya Sharma" /></div>
        </div>
      </div>

      {/* ── Line Items ───────────────────────────────── */}
      <div style={section}>
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>Line Items</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                {['Description', 'UOM', 'Qty', 'Rate (excl. GST)', 'GST %', 'Amount', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: 'var(--font-heading)', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const amt = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 8px', minWidth: 200 }}><input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} style={{ ...inputStyle, padding: '6px 8px' }} placeholder="Description of work / product" /></td>
                    <td style={{ padding: '6px 8px', minWidth: 90 }}>
                      <input list="uom-options" value={item.uom} onChange={e => updateItem(i, 'uom', e.target.value)} style={{ ...inputStyle, padding: '6px 8px' }} placeholder="Unit" />
                    </td>
                    <td style={{ padding: '6px 8px', minWidth: 80 }}><input type="number" value={item.qty} onChange={e => updateItem(i, 'qty', e.target.value)} style={{ ...inputStyle, padding: '6px 8px' }} min="0" step="0.01" /></td>
                    <td style={{ padding: '6px 8px', minWidth: 120 }}><input type="number" value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} style={{ ...inputStyle, padding: '6px 8px' }} min="0" step="0.01" /></td>
                    <td style={{ padding: '6px 8px', minWidth: 80 }}>
                      <select value={item.taxRate} onChange={e => updateItem(i, 'taxRate', parseFloat(e.target.value))} style={{ ...inputStyle, padding: '6px 8px' }}>
                        {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px', minWidth: 110, textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>₹{fmt(amt)}</td>
                    <td style={{ padding: '6px 8px' }}>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)' }}><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="uom-options">
            {UOM_OPTIONS.map(u => <option key={u} value={u} />)}
          </datalist>
        </div>
        <button type="button" onClick={addItem}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px dashed var(--border-color)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)', fontFamily: 'var(--font-body)', fontWeight: 500, alignSelf: 'flex-start' }}>
          <Plus size={14} /> Add Item
        </button>
      </div>

      {/* ── Financial Summary ─────────────────────────── */}
      <div style={{ ...section, gap: 8 }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Financial Summary</p>
        {[
          ['Subtotal', totals.subtotal],
          ['Discount', totals.subtotal - totals.taxable],
          ['Taxable Value', totals.taxable],
          ...(totals.intra
            ? [['CGST', totals.cgstTotal], ['SGST', totals.sgstTotal]]
            : [['IGST', totals.igstTotal]]),
          ['Round Off', totals.rnd],
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', padding: '2px 0', borderBottom: '1px dashed var(--border-color)' }}>
            <span>{label}</span><span style={{ fontFamily: 'monospace' }}>₹{fmt(val)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: 'var(--text-main)', padding: '8px 0 0' }}>
          <span>Grand Total</span>
          <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-heading)' }}>₹{fmt(totals.grand)}</span>
        </div>
        <div style={{ ...row, marginTop: 12 }}>
          <div><label style={labelStyle}>Discount (₹)</label><input type="number" value={discount} onChange={e => setDiscount(e.target.value)} style={inputStyle} min="0" step="0.01" /></div>
          <div><label style={labelStyle}>Round Off Override</label><input type="number" value={roundOverride} onChange={e => setRoundOverride(e.target.value)} style={inputStyle} step="0.01" placeholder={`Auto: ${fmt(totals.rnd)}`} /></div>
        </div>
      </div>

      {/* ── Payment Terms ─────────────────────────────── */}
      <div style={section}>
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>Payment Terms</p>
        <div style={row}>
          <div>
            <label style={labelStyle}>Advance (%)</label>
            <input type="number" value={advancePct} onChange={e => setAdvancePct(e.target.value)} style={inputStyle} min="0" max="100" />
            {advancePct && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>≈ ₹{fmt((totals.grand * parseFloat(advancePct)) / 100)} advance</p>}
          </div>
          <div>
            <label style={labelStyle}>Balance Payable</label>
            <select value={balanceMode} onChange={e => setBalanceMode(e.target.value)} style={inputStyle}>
              <option value="ON_DELIVERY">On Delivery / Completion</option>
              <option value="NET_DAYS">Within ___ days</option>
            </select>
            {balanceMode === 'NET_DAYS' && (
              <input type="number" value={netDays} onChange={e => setNetDays(e.target.value)} style={{ ...inputStyle, marginTop: 8 }} placeholder="Number of days" min="1" />
            )}
          </div>
        </div>
      </div>

      {/* ── T&C + Force Majeure ─────────────────────── */}
      <div style={section}>
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>Terms & Conditions</p>
        <textarea value={termsAndConditions} onChange={e => setTerms(e.target.value)} style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} placeholder="Standard payment and delivery terms…" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-main)' }}>
            <input type="checkbox" checked={showFMInput} onChange={e => { setShowFMInput(e.target.checked); if (e.target.checked && !forceMajeure) setForceMajeure(FORCE_MAJEURE_BOILERPLATE); }} />
            Include Force Majeure Clause
          </label>
        </div>
        {showFMInput && (
          <textarea value={forceMajeure} onChange={e => setForceMajeure(e.target.value)} style={{ ...inputStyle, minHeight: 100, resize: 'vertical', fontSize: 12 }} />
        )}
      </div>

      {/* ── Actions ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 10, fontSize: 14, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Cancel</button>
        <button type="submit" disabled={submitting}
          style={{ padding: '10px 24px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Saving…' : (editQuotation ? 'Regenerate Quotation' : 'Create Quotation')}
        </button>
      </div>
    </form>
  );
}
