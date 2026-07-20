import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';
const UOM_OPTIONS = ['kg', 'units', 'nos', 'pcs', 'ltr', 'mtr', 'set'];
const DEFAULT_ITEM = { description: '', hsnOrSacCode: '', uom: 'nos', qty: '', rate: '', taxRate: 18 };

import { getGstSplit } from '../../../../utils/sharedFinancialUtils.js';
import { FORCE_MAJEURE_BOILERPLATE } from '../../../../utils/quotationUtils.js';

const inputStyle = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)',
  borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-main)',
  background: 'white', outline: 'none',
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4, display: 'block' };
const sectionStyle = { background: 'white', border: '1px solid var(--border-color)', borderRadius: 8, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 };
const rowStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };

export default function POForm({ editPO, onCancel, onSuccess }) {
  const [companies, setCompanies] = useState([]);
  const [companyCode, setCompanyCode] = useState('');
  const [poType, setPoType] = useState('GOODS');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextPoNumber, setNextPoNumber] = useState('');

  const [vendorName, setVendorName] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');

  const [items, setItems] = useState([{ ...DEFAULT_ITEM }]);
  const [discount, setDiscount] = useState('');
  const [pfCharges, setPfCharges] = useState('');
  const [roundOverride, setRoundOverride] = useState('');

  const [advancePct, setAdvancePct] = useState('');
  const [balanceMode, setBalanceMode] = useState('ON_DELIVERY');
  const [netDays, setNetDays] = useState('');
  const [deliveryScope, setDeliveryScope] = useState('BUYER');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load companies
  useEffect(() => {
    fetch(`${API_BASE}/companies`).then(r => r.json()).then(setCompanies).catch(() => {});
  }, []);

  // Prefill for edit mode
  useEffect(() => {
    if (editPO) {
      setCompanyCode(editPO.company?.code ?? '');
      setPoType(editPO.poType);
      setPoDate(editPO.poDate?.split('T')[0] ?? '');
      setVendorName(editPO.vendorName ?? '');
      setVendorContact(editPO.vendorContact ?? '');
      setVendorAddress(editPO.vendorAddress ?? '');
      setVendorGstin(editPO.vendorGstin ?? '');
      setAdvancePct(String(editPO.paymentAdvancePct ?? ''));
      setBalanceMode(editPO.paymentBalanceMode ?? 'ON_DELIVERY');
      setNetDays(String(editPO.paymentNetDays ?? ''));
      setDeliveryScope(editPO.deliveryScope ?? 'BUYER');
      setDeliveryNotes(editPO.deliveryNotes ?? '');
      setTermsAndConditions(editPO.termsAndConditions ?? '');
      setDiscount(String(editPO.discountTotal ?? ''));
      setPfCharges(String(editPO.pfTotal ?? ''));
      setRoundOverride(String(editPO.roundAdjustment ?? ''));
      setItems(editPO.items?.map(i => ({ ...i, hsnOrSacCode: i.hsnOrSacCode })) ?? [{ ...DEFAULT_ITEM }]);
    }
  }, [editPO]);


  // Preview next PO number
  useEffect(() => {
    if (!companyCode || !poDate) return;
    fetch(`${API_BASE}/po/preview-next?companyCode=${companyCode}&poType=${poType}&date=${poDate}`)
      .then(r => r.json()).then(d => setNextPoNumber(d.nextPoNumber ?? '')).catch(() => {});
  }, [companyCode, poType, poDate]);

  // Live calculation
  const calc = useCallback(() => {
    let subtotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
    const company = companies.find(c => c.code === companyCode);
    const companyState = company?.gstin?.substring(0, 2) ?? '';
    const vendorState  = (vendorGstin && vendorGstin.length >= 2) ? vendorGstin.substring(0, 2) : companyState;
    const intrastate   = companyState === vendorState || !vendorGstin;

    items.forEach(item => {
      const amt = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
      const tax = parseFloat(item.taxRate) || 0;
      subtotal += amt;
      const { cgstRate, sgstRate, igstRate } = getGstSplit(company?.gstin, vendorGstin, tax);
      cgstTotal += amt * (cgstRate / 100);
      sgstTotal += amt * (sgstRate / 100);
      igstTotal += amt * (igstRate / 100);
    });
    const disc = parseFloat(discount) || 0;
    const pf   = poType === 'GOODS' ? (parseFloat(pfCharges) || 0) : 0;
    const taxable = subtotal - disc;
    
    // Distribute tax proportionally over the taxable value
    const taxRatio = subtotal > 0 ? (taxable / subtotal) : 1;
    cgstTotal *= taxRatio;
    sgstTotal *= taxRatio;
    igstTotal *= taxRatio;

    const preRound = taxable + cgstTotal + sgstTotal + igstTotal + pf;
    const autoRound = Math.round(preRound) - preRound;
    const rnd = roundOverride !== '' ? parseFloat(roundOverride) : parseFloat(autoRound.toFixed(2));
    return { subtotal, taxable, cgstTotal, sgstTotal, igstTotal, pf, rnd, grand: preRound + rnd, intrastate };
  }, [items, discount, pfCharges, roundOverride, companyCode, companies, vendorGstin, poType]);

  const totals = calc();

  const fmt = n => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);

  const addItem = () => setItems(prev => [...prev, { ...DEFAULT_ITEM }]);
  const removeItem = i => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!companyCode) return setError('Please select a company.');
    if (items.every(it => !it.description)) return setError('Add at least one line item.');
    setSubmitting(true);

    const body = {
      companyCode, poType, poDate,
      vendorName, vendorContact, vendorAddress, vendorGstin,
      paymentAdvancePct: parseFloat(advancePct) || 0,
      paymentBalanceMode: balanceMode,
      paymentNetDays: balanceMode === 'NET_DAYS' ? parseInt(netDays) || null : null,
      deliveryScope, deliveryNotes, termsAndConditions,
      discount: parseFloat(discount) || 0,
      pfCharges: parseFloat(pfCharges) || 0,
      roundOverride: roundOverride !== '' ? parseFloat(roundOverride) : null,
      items: items.filter(i => i.description),
    };

    try {
      let url = `${API_BASE}/po`;
      let method = 'POST';
      if (editPO) {
        const [prefix, , type, fy, seq] = editPO.poNumber.split('/');
        url = `${API_BASE}/po/${prefix}/${type}/${fy}/${seq}`;
        method = 'PUT';
      }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
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
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700 }}>{editPO ? 'Edit Purchase Order' : 'New Purchase Order'}</h2>
          {nextPoNumber && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Will be issued as <strong style={{ color: 'var(--color-primary)' }}>{nextPoNumber}</strong></p>}
        </div>
        {/* Type toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 10, padding: 4, border: '1px solid var(--border-color)' }}>
          {['GOODS', 'SERVICE'].map(t => (
            <button key={t} type="button" onClick={() => setPoType(t)}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
                background: poType === t ? 'var(--color-primary)' : 'transparent',
                color: poType === t ? 'white' : 'var(--text-muted)',
                transition: 'var(--transition-smooth)',
              }}
            >{t === 'GOODS' ? '📦 Goods PO' : '🔧 Service PO'}</button>
          ))}
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: 'var(--danger-color)', fontSize: 13 }}>{error}</div>}

      {/* ── Company + Date ────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>Document Details</p>
        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>Company (Issuer)</label>
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
            <label style={labelStyle}>PO Date</label>
            <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} style={inputStyle} required />
          </div>
        </div>
      </div>

      {/* ── Vendor Details ───────────────────────────── */}
      <div style={sectionStyle}>
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>Vendor Details</p>
        <div style={rowStyle}>
          <div><label style={labelStyle}>Vendor Name</label><input value={vendorName} onChange={e => setVendorName(e.target.value)} style={inputStyle} required placeholder="Vendor Co. Pvt. Ltd." /></div>
          <div><label style={labelStyle}>Contact</label><input value={vendorContact} onChange={e => setVendorContact(e.target.value)} style={inputStyle} placeholder="+91 98765 43210" /></div>
        </div>
        <div><label style={labelStyle}>Vendor Address</label><textarea value={vendorAddress} onChange={e => setVendorAddress(e.target.value)} style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} required /></div>
        <div style={{ maxWidth: 300 }}><label style={labelStyle}>Vendor GSTIN (optional)</label><input value={vendorGstin} onChange={e => setVendorGstin(e.target.value.toUpperCase())} style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="29AABCV1234C1ZV" /></div>
      </div>

      {/* ── Line Items ───────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>Line Items</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                {['Description', poType === 'GOODS' ? 'HSN' : 'SAC', 'UOM', 'Qty', 'Rate', 'Tax %', 'Amount', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: 'var(--font-heading)', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const amt = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 8px', minWidth: 180 }}><input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} style={{ ...inputStyle, padding: '6px 8px' }} placeholder="Item description" /></td>
                    <td style={{ padding: '6px 8px', minWidth: 100 }}><input value={item.hsnOrSacCode} onChange={e => updateItem(i, 'hsnOrSacCode', e.target.value)} style={{ ...inputStyle, padding: '6px 8px', fontFamily: 'monospace' }} /></td>
                    <td style={{ padding: '6px 8px', minWidth: 90 }}>
                      <input list="uom-options" value={item.uom} onChange={e => updateItem(i, 'uom', e.target.value)} style={{ ...inputStyle, padding: '6px 8px' }} placeholder="Unit" />
                    </td>
                    <td style={{ padding: '6px 8px', minWidth: 80 }}><input type="number" value={item.qty} onChange={e => updateItem(i, 'qty', e.target.value)} style={{ ...inputStyle, padding: '6px 8px' }} min="0" step="0.01" /></td>
                    <td style={{ padding: '6px 8px', minWidth: 100 }}><input type="number" value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} style={{ ...inputStyle, padding: '6px 8px' }} min="0" step="0.01" /></td>
                    <td style={{ padding: '6px 8px', minWidth: 80 }}>
                      <select value={item.taxRate} onChange={e => updateItem(i, 'taxRate', parseFloat(e.target.value))} style={{ ...inputStyle, padding: '6px 8px' }}>
                        {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px', minWidth: 100, textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>₹{fmt(amt)}</td>
                    <td style={{ padding: '6px 8px' }}>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)' }}>
                          <Trash2 size={14} />
                        </button>
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
        <button type="button" onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px dashed var(--border-color)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)', fontFamily: 'var(--font-body)', fontWeight: 500, alignSelf: 'flex-start' }}>
          <Plus size={14} /> Add Line Item
        </button>
      </div>

      {/* ── Totals ───────────────────────────────────── */}
      <div style={{ ...sectionStyle, gap: 8 }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Financial Summary</p>
        {[
          ['Subtotal', totals.subtotal],
          ['Discount', -totals.taxable + totals.subtotal, true],
          ['Taxable Value', totals.taxable],
          ...(totals.intrastate
            ? [['CGST', totals.cgstTotal], ['SGST', totals.sgstTotal]]
            : [['IGST', totals.igstTotal]]),
          ...(poType === 'GOODS' ? [['P&F Charges', totals.pf]] : []),
          ['Round Off', totals.rnd],
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', padding: '2px 0', borderBottom: '1px dashed var(--border-color)' }}>
            <span>{label}</span>
            <span style={{ fontFamily: 'monospace' }}>₹{fmt(val)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: 'var(--text-main)', padding: '8px 0 0' }}>
          <span>Grand Total</span>
          <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-heading)' }}>₹{fmt(totals.grand)}</span>
        </div>

        {/* Editable fields below totals */}
        <div style={{ ...rowStyle, marginTop: 12 }}>
          <div><label style={labelStyle}>Discount (₹)</label><input type="number" value={discount} onChange={e => setDiscount(e.target.value)} style={inputStyle} min="0" step="0.01" /></div>
          {poType === 'GOODS' && <div><label style={labelStyle}>P&F Charges (₹)</label><input type="number" value={pfCharges} onChange={e => setPfCharges(e.target.value)} style={inputStyle} min="0" step="0.01" /></div>}
          <div><label style={labelStyle}>Round Off Override (₹)</label><input type="number" value={roundOverride} onChange={e => setRoundOverride(e.target.value)} style={inputStyle} step="0.01" placeholder={`Auto: ${fmt(totals.rnd)}`} /></div>
        </div>
      </div>

      {/* ── Payment Terms ─────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>Payment Terms</p>
        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>Advance (%)</label>
            <input type="number" value={advancePct} onChange={e => setAdvancePct(e.target.value)} style={inputStyle} min="0" max="100" />
            {advancePct && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>≈ ₹{fmt((totals.grand * parseFloat(advancePct)) / 100)} advance</p>}
          </div>
          <div>
            <label style={labelStyle}>Balance Payable</label>
            <select value={balanceMode} onChange={e => setBalanceMode(e.target.value)} style={inputStyle}>
              <option value="ON_DELIVERY">On Delivery</option>
              <option value="NET_DAYS">Within ___ days</option>
            </select>
            {balanceMode === 'NET_DAYS' && (
              <input type="number" value={netDays} onChange={e => setNetDays(e.target.value)} style={{ ...inputStyle, marginTop: 8 }} placeholder="Number of days" min="1" />
            )}
          </div>
        </div>
      </div>

      {/* ── Delivery Terms ─────────────────────────────── */}
      <div style={sectionStyle}>
        <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>Delivery Terms</p>
        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>Delivery Scope</label>
            <select value={deliveryScope} onChange={e => setDeliveryScope(e.target.value)} style={inputStyle}>
              <option value="BUYER">Buyer arranges pickup</option>
              <option value="SELLER">Seller delivers to site</option>
              <option value="THIRD_PARTY_COURIER">Via named courier</option>
            </select>
          </div>
          <div><label style={labelStyle}>Delivery Notes</label><input value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} style={inputStyle} placeholder="Additional delivery instructions…" /></div>
        </div>
      </div>

      {/* ── T&C ──────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>Terms & Conditions</p>
          <button type="button" onClick={() => setTermsAndConditions(prev => prev + (prev ? '\n' : '') + FORCE_MAJEURE_BOILERPLATE)}
            style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: '1px solid var(--color-primary)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            + Insert Standard Clause
          </button>
        </div>
        <textarea value={termsAndConditions} onChange={e => setTermsAndConditions(e.target.value)} style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} placeholder="Enter terms and conditions…" />
      </div>

      {/* ── Actions ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 10, fontSize: 14, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Cancel</button>
        <button type="submit" disabled={submitting}
          style={{ padding: '10px 24px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Saving…' : (editPO ? 'Regenerate PO' : 'Create PO')}
        </button>
      </div>
    </form>
  );
}
