import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import CountrySelect from '../shared/CountrySelect';
import CurrencySelect from '../shared/CurrencySelect';

const API_BASE = 'http://localhost:3001/api';
const UOM_OPTIONS = ['nos', 'kg', 'units', 'pcs', 'ltr', 'mtr', 'set', 'hrs', 'job', 'MT'];
const DISPATCH_METHODS = ['SEA', 'AIR', 'COURIER', 'ROAD', 'RAIL'];
const INCOTERMS_OPTIONS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const DEFAULT_ITEM = { description: '', uom: 'nos', qty: '', rate: '' };
// ponytail: inlined — avoids importing from backend utils
const FORCE_MAJEURE_BOILERPLATE = `Force Majeure: Neither party shall be liable for failure to perform obligations if such failure is caused by Acts of God, war, government actions, natural disasters, pandemics, or any other circumstances beyond reasonable control. In such events, the affected party shall notify the other party promptly.`;


const inp = { width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 14, color: '#000', background: 'rgba(255,255,255,0.05)', outline: 'none' };
const lbl = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4, display: 'block' };
const sec = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 };
const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
const row3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 };

export default function ExportQuotationForm({ editExportQuotation, onCancel, onSuccess }) {
  const isEditMode = !!editExportQuotation;
  const today = new Date().toISOString().split('T')[0];

  const [quoteDate, setQuoteDate] = useState(today);
  const [nextQNumber, setNextQNumber] = useState('Generating…');

  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientCountry, setClientCountry] = useState('');

  const [dispatchMethod, setDispatchMethod] = useState('SEA');
  const [shipmentType, setShipmentType] = useState('');
  const [portOfLoading, setPortOfLoading] = useState('');
  const [portOfDischarge, setPortOfDischarge] = useState('');
  const [incoterms, setIncoterms] = useState('');

  const [outputCurrency, setOutputCurrency] = useState('');
  const [fxRate, setFxRate] = useState('');
  const [fxRateDate, setFxRateDate] = useState(today);

  const [items, setItems] = useState([{ ...DEFAULT_ITEM }]);
  const [discount, setDiscount] = useState(0);
  const [roundOverride, setRoundOverride] = useState('');

  const [paymentAdvancePct, setPaymentAdvancePct] = useState(0);
  const [paymentBalanceMode, setPaymentBalanceMode] = useState('ON_DELIVERY');
  const [paymentNetDays, setPaymentNetDays] = useState('');

  const [additionalInfo, setAdditionalInfo] = useState('');
  const [includeForceMajeure, setIncludeForceMajeure] = useState(true);
  const [forceMajeureClause, setForceMajeureClause] = useState(FORCE_MAJEURE_BOILERPLATE);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Prefill in edit mode
  useEffect(() => {
    if (!editExportQuotation) return;
    setQuoteDate(editExportQuotation.quoteDate?.split('T')[0] ?? '');
    setClientName(editExportQuotation.clientName ?? '');
    setClientAddress(editExportQuotation.clientAddress ?? '');
    setClientCountry(editExportQuotation.clientCountry ?? '');
    setDispatchMethod(editExportQuotation.dispatchMethod ?? 'SEA');
    setShipmentType(editExportQuotation.shipmentType ?? '');
    setPortOfLoading(editExportQuotation.portOfLoading ?? '');
    setPortOfDischarge(editExportQuotation.portOfDischarge ?? '');
    setIncoterms(editExportQuotation.incoterms ?? '');
    setOutputCurrency(editExportQuotation.outputCurrency ?? '');
    setFxRate(String(editExportQuotation.fxRate ?? ''));
    setFxRateDate(editExportQuotation.fxRateDate?.split('T')[0] ?? '');
    setDiscount(editExportQuotation.discountTotal ?? 0);
    setRoundOverride(String(editExportQuotation.roundAdjustment ?? ''));
    setPaymentAdvancePct(editExportQuotation.paymentAdvancePct ?? 0);
    setPaymentBalanceMode(editExportQuotation.paymentBalanceMode ?? 'ON_DELIVERY');
    setPaymentNetDays(String(editExportQuotation.paymentNetDays ?? ''));
    setAdditionalInfo(editExportQuotation.additionalInfo ?? '');
    setIncludeForceMajeure(editExportQuotation.includeForceMajeure ?? true);
    setForceMajeureClause(editExportQuotation.forceMajeureClause ?? FORCE_MAJEURE_BOILERPLATE);
    setNextQNumber(editExportQuotation.quoteNumber);
    setItems(editExportQuotation.items?.map(it => ({ description: it.description, uom: it.uom, qty: String(it.qty), rate: String(it.rate) })) ?? [{ ...DEFAULT_ITEM }]);
  }, [editExportQuotation]);

  // Preview next number (only in create mode)
  useEffect(() => {
    if (isEditMode) return;
    fetch(`${API_BASE}/export-quotations/preview-next?date=${quoteDate}`)
      .then(r => r.json())
      .then(d => setNextQNumber(d.nextQuoteNumber || 'Error'))
      .catch(() => setNextQNumber('Error'));
  }, [quoteDate, isEditMode]);

  // ── Totals preview ────────────────────────────────────────────
  const subtotal = items.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0), 0);
  const discountNum = parseFloat(discount) || 0;
  const rawGrand = subtotal - discountNum;
  const grandTotal = roundOverride !== '' ? parseFloat(roundOverride) : Math.round(rawGrand);
  const roundAdj = grandTotal - rawGrand;
  const advanceAmount = parseFloat(((grandTotal * paymentAdvancePct) / 100).toFixed(2));
  const fxNum = parseFloat(fxRate) || 0;
  const grandConverted = fxNum ? (grandTotal / fxNum).toFixed(2) : '—';

  const updateItem = (i, field, val) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    setItems(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientName || !clientAddress || !clientCountry || !dispatchMethod || !outputCurrency || !fxRate || !items.some(it => it.description)) {
      setErrorMessage('Please fill all required fields (Client, Country, Currency, FX Rate, and at least one item).');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const url    = isEditMode
        ? `${API_BASE}/export-quotations/${encodeURIComponent(editExportQuotation.quoteNumber)}`
        : `${API_BASE}/export-quotations`;
      const method = isEditMode ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteDate, clientName, clientAddress, clientCountry,
          dispatchMethod, shipmentType, portOfLoading, portOfDischarge, incoterms,
          outputCurrency, fxRate: parseFloat(fxRate), fxRateDate,
          paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
          paymentBalanceMode, paymentNetDays: paymentNetDays || null,
          discount: discountNum,
          roundOverride: roundOverride !== '' ? parseFloat(roundOverride) : null,
          additionalInfo, includeForceMajeure,
          forceMajeureClause: includeForceMajeure ? forceMajeureClause : null,
          items: items.filter(it => it.description),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} Export Quotation`);
      onSuccess?.();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: 22 }}>{isEditMode ? `✏️ Edit Export Quotation: ${editExportQuotation.quoteNumber}` : '🌍 New Export Quotation'}</h2>
      <div style={{ background: 'var(--theme-primary, #1a6b3c)', color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 13, opacity: 0.9 }}>
        GMP International — Export Document
      </div>

      {/* 1. Quote Details */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Quotation Details</h3>
        <div style={row2}>
          <div>
            <label style={lbl}>Quotation Date</label>
            <input type="date" style={inp} value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Quotation Number (Auto)</label>
            <input type="text" style={{ ...inp, fontWeight: 700, opacity: 0.7 }} value={nextQNumber} readOnly />
          </div>
        </div>
      </div>

      {/* 2. Client Details */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Client Details</h3>
        <div>
          <label style={lbl}>Client Name *</label>
          <input type="text" style={inp} value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. ABC Corp. Ltd." />
        </div>
        <div>
          <label style={lbl}>Client Address *</label>
          <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Full address including city and country" />
        </div>
        <div>
          <label style={lbl}>Country *</label>
          <CountrySelect value={clientCountry} onChange={setClientCountry} />
        </div>
      </div>

      {/* 3. Shipment */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Shipment Details</h3>
        <div style={row3}>
          <div>
            <label style={lbl}>Dispatch Method *</label>
            <select style={inp} value={dispatchMethod} onChange={e => setDispatchMethod(e.target.value)}>
              {DISPATCH_METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Shipment Type</label>
            <input type="text" style={inp} value={shipmentType} onChange={e => setShipmentType(e.target.value)} placeholder="e.g. FCL, LCL, Air Cargo" />
          </div>
          <div>
            <label style={lbl}>Incoterms</label>
            <select style={inp} value={incoterms} onChange={e => setIncoterms(e.target.value)}>
              <option value="">— None —</option>
              {INCOTERMS_OPTIONS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={row2}>
          <div>
            <label style={lbl}>Port of Loading</label>
            <input type="text" style={inp} value={portOfLoading} onChange={e => setPortOfLoading(e.target.value)} placeholder="e.g. Nhava Sheva, Mundra" />
          </div>
          <div>
            <label style={lbl}>Port of Discharge</label>
            <input type="text" style={inp} value={portOfDischarge} onChange={e => setPortOfDischarge(e.target.value)} placeholder="e.g. Jebel Ali, Hamburg" />
          </div>
        </div>
      </div>

      {/* 4. Currency */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Currency & FX Rate</h3>
        <div style={row3}>
          <div>
            <label style={lbl}>Output Currency *</label>
            <CurrencySelect value={outputCurrency} onChange={setOutputCurrency} />
          </div>
          <div>
            <label style={lbl}>1 {outputCurrency || 'CCY'} = ₹ (Rate) *</label>
            <input type="number" step="0.01" style={inp} value={fxRate} onChange={e => setFxRate(e.target.value)} placeholder="e.g. 83.50" />
          </div>
          <div>
            <label style={lbl}>Rate as of Date</label>
            <input type="date" style={inp} value={fxRateDate} onChange={e => setFxRateDate(e.target.value)} />
          </div>
        </div>
        {fxNum > 0 && outputCurrency && (
          <div style={{ background: '#e8f5ee', border: '1px solid #1a6b3c', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
            💱 1 {outputCurrency} = ₹{fxRate} &nbsp;|&nbsp; Grand Total ≈ <strong>{grandConverted} {outputCurrency}</strong>
          </div>
        )}
      </div>

      {/* 5. Line Items */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Items</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface)' }}>
              {['#', 'Description', 'UOM', 'Qty', 'Rate (₹)', 'Amount (₹)', ''].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Amount (₹)' || h === 'Qty' || h === 'Rate (₹)' ? 'right' : 'left', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const amt = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
              return (
                <tr key={i}>
                  <td style={{ padding: '6px 10px', color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ padding: '4px 6px' }}><input style={{ ...inp, fontSize: 13 }} value={it.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Description" /></td>
                  <td style={{ padding: '4px 6px' }}>
                    <input list={`uom-${i}`} style={{ ...inp, fontSize: 13, width: 80 }} value={it.uom} onChange={e => updateItem(i, 'uom', e.target.value)} />
                    <datalist id={`uom-${i}`}>{UOM_OPTIONS.map(u => <option key={u} value={u} />)}</datalist>
                  </td>
                  <td style={{ padding: '4px 6px' }}><input type="number" style={{ ...inp, fontSize: 13, textAlign: 'right', width: 80 }} value={it.qty} onChange={e => updateItem(i, 'qty', e.target.value)} /></td>
                  <td style={{ padding: '4px 6px' }}><input type="number" step="0.01" style={{ ...inp, fontSize: 13, textAlign: 'right', width: 100 }} value={it.rate} onChange={e => updateItem(i, 'rate', e.target.value)} /></td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>₹{amt.toFixed(2)}</td>
                  <td style={{ padding: '4px 6px' }}>
                    {items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16} /></button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="button" onClick={() => setItems([...items, { ...DEFAULT_ITEM }])} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px dashed var(--border-color)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
          <Plus size={14} /> Add Item
        </button>
      </div>

      {/* 6. Financials */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Totals</h3>
        <div style={row3}>
          <div>
            <label style={lbl}>Discount (₹)</label>
            <input type="number" style={inp} value={discount} onChange={e => setDiscount(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Round Off Override (₹)</label>
            <input type="number" style={inp} value={roundOverride} onChange={e => setRoundOverride(e.target.value)} placeholder="Leave blank for auto" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 280 }}>
            {[['Subtotal', `₹${subtotal.toFixed(2)}`], ['Discount', `-₹${discountNum.toFixed(2)}`], ['Round Off', `₹${roundAdj.toFixed(2)}`]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--border-color)', fontSize: 13 }}>
                <span>{k}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 700, fontSize: 16, color: '#1a6b3c' }}>
              <span>Grand Total (INR)</span><span>₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
            {fxNum > 0 && outputCurrency && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}>
                <span>Equiv. ({outputCurrency})</span><span>{grandConverted}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 7. Payment Terms */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Payment Terms</h3>
        <div style={row3}>
          <div>
            <label style={lbl}>Advance %</label>
            <input type="number" min={0} max={100} style={inp} value={paymentAdvancePct} onChange={e => setPaymentAdvancePct(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Advance Amount (₹)</label>
            <input style={{ ...inp, opacity: 0.7 }} value={`₹${advanceAmount.toFixed(2)}`} readOnly />
          </div>
          <div>
            <label style={lbl}>Balance Mode</label>
            <select style={inp} value={paymentBalanceMode} onChange={e => setPaymentBalanceMode(e.target.value)}>
              <option value="ON_DELIVERY">On Delivery</option>
              <option value="NET_DAYS">Net Days</option>
            </select>
          </div>
        </div>
        {paymentBalanceMode === 'NET_DAYS' && (
          <div style={{ maxWidth: 200 }}>
            <label style={lbl}>Number of Days</label>
            <input type="number" style={inp} value={paymentNetDays} onChange={e => setPaymentNetDays(e.target.value)} placeholder="e.g. 30" />
          </div>
        )}
      </div>

      {/* 8. Additional Info */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Additional Information</h3>
        <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)} placeholder="Any additional notes or terms..." />
      </div>

      {/* 9. Force Majeure */}
      <div style={sec}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Force Majeure</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={includeForceMajeure} onChange={e => setIncludeForceMajeure(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Include in document</span>
          </label>
        </div>
        {includeForceMajeure && (
          <textarea rows={4} style={{ ...inp, resize: 'vertical', fontSize: 12 }} value={forceMajeureClause} onChange={e => setForceMajeureClause(e.target.value)} />
        )}
      </div>

      {errorMessage && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#dc2626', fontSize: 14 }}>
          ⚠️ {errorMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
        <button type="submit" disabled={isLoading} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#1a6b3c', color: '#fff', fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: 14 }}>
          {isLoading ? 'Generating PDF…' : '✅ Save & Generate PDF'}
        </button>
      </div>
    </form>
  );
}
