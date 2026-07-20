import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import CountrySelect from '../shared/CountrySelect';
import CurrencySelect from '../shared/CurrencySelect';

const API_BASE = 'http://localhost:3001/api';
const UOM_OPTIONS = ['nos', 'kg', 'units', 'pcs', 'ltr', 'mtr', 'set', 'hrs', 'job', 'MT'];
const INCOTERMS_OPTIONS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const DEFAULT_ITEM = { description: '', uom: 'nos', qty: '', rate: '' };
const DEFAULT_DECLARATION = `I hereby declare that the above-mentioned goods are exported as per applicable Indian export regulations, and the details given are true and correct to the best of my knowledge.`;

const inp = { width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 14, color: '#000', background: 'rgba(255,255,255,0.05)', outline: 'none' };
const lbl = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4, display: 'block' };
const sec = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 };
const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
const row3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 };

export default function CommercialInvoiceForm({ editCommercialInvoice, onCancel, onSuccess }) {
  const isEditMode = !!editCommercialInvoice;
  const today = new Date().toISOString().split('T')[0];

  const [invoiceKind, setInvoiceKind] = useState('COMMERCIAL');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [nextNumber, setNextNumber] = useState('Generating…');

  const [exporterName, setExporterName] = useState('GMP International');
  const [exporterAddress, setExporterAddress] = useState('Block C-2, Industrial Area Phase II, Noida, Uttar Pradesh - 201305');
  const [exporterContact, setExporterContact] = useState('');

  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  const [outputCurrency, setOutputCurrency] = useState('');
  const [fxRate, setFxRate] = useState('');
  const [fxRateDate, setFxRateDate] = useState(today);

  const [incoterms, setIncoterms] = useState('');
  const [paymentAdvancePct, setPaymentAdvancePct] = useState(0);
  const [paymentBalanceMode, setPaymentBalanceMode] = useState('ON_DELIVERY');
  const [paymentNetDays, setPaymentNetDays] = useState('');

  const [bankAccountNumber, setBankAccountNumber] = useState('004205001234');
  const [bankName, setBankName] = useState('ICICI Bank');
  const [bankBranchAddress, setBankBranchAddress] = useState('');
  const [swiftBicCode, setSwiftBicCode] = useState('');
  const [purposeCode, setPurposeCode] = useState('');
  const [declaration, setDeclaration] = useState(DEFAULT_DECLARATION);

  const [items, setItems] = useState([{ ...DEFAULT_ITEM }]);
  const [discount, setDiscount] = useState(0);
  const [roundOverride, setRoundOverride] = useState('');

  const [showCustoms, setShowCustoms] = useState(false);
  const [customs, setCustoms] = useState({
    countryOfOrigin: '', countryOfFinalDestination: '', finalDestination: '',
    portOfLoading: '', vesselOrFlightNo: '', shippingBillNumber: '', shippingBillDate: '',
    shippingPortCode: '', preCarriageBy: '', placeOfPreCarriage: '',
    transporterName: '', vehicleNumber: '', lrNumber: '', challanNumber: '', challanDate: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Prefill in edit mode
  useEffect(() => {
    if (!editCommercialInvoice) return;
    const ci = editCommercialInvoice;
    setInvoiceKind(ci.invoiceKind ?? 'COMMERCIAL');
    setInvoiceDate(ci.invoiceDate?.split('T')[0] ?? today);
    setDueDate(ci.dueDate?.split('T')[0] ?? '');
    setNextNumber(ci.invoiceNumber);
    setExporterName(ci.exporterName ?? '');
    setExporterAddress(ci.exporterAddress ?? '');
    setExporterContact(ci.exporterContact ?? '');
    setClientName(ci.clientName ?? '');
    setClientAddress(ci.clientAddress ?? '');
    setOutputCurrency(ci.outputCurrency ?? '');
    setFxRate(String(ci.fxRate ?? ''));
    setFxRateDate(ci.fxRateDate?.split('T')[0] ?? today);
    setIncoterms(ci.incoterms ?? '');
    setPaymentAdvancePct(ci.paymentAdvancePct ?? 0);
    setPaymentBalanceMode(ci.paymentBalanceMode ?? 'ON_DELIVERY');
    setPaymentNetDays(String(ci.paymentNetDays ?? ''));
    setBankAccountNumber(ci.bankAccountNumber ?? '');
    setBankName(ci.bankName ?? '');
    setBankBranchAddress(ci.bankBranchAddress ?? '');
    setSwiftBicCode(ci.swiftBicCode ?? '');
    setPurposeCode(ci.purposeCode ?? '');
    setDeclaration(ci.declaration ?? DEFAULT_DECLARATION);
    setDiscount(ci.discountTotal ?? 0);
    setRoundOverride(String(ci.roundAdjustment ?? ''));
    setItems(ci.items?.map(it => ({ description: it.description, uom: it.uom, qty: String(it.qty), rate: String(it.rate) })) ?? [{ ...DEFAULT_ITEM }]);
    // Customs
    const hasCustoms = ci.countryOfOrigin || ci.portOfLoading || ci.shippingBillNumber || ci.challanNumber || ci.lrNumber;
    if (hasCustoms) setShowCustoms(true);
    setCustoms({
      countryOfOrigin: ci.countryOfOrigin ?? '', countryOfFinalDestination: ci.countryOfFinalDestination ?? '',
      finalDestination: ci.finalDestination ?? '', portOfLoading: ci.portOfLoading ?? '',
      vesselOrFlightNo: ci.vesselOrFlightNo ?? '', shippingBillNumber: ci.shippingBillNumber ?? '',
      shippingBillDate: ci.shippingBillDate?.split('T')[0] ?? '', shippingPortCode: ci.shippingPortCode ?? '',
      preCarriageBy: ci.preCarriageBy ?? '', placeOfPreCarriage: ci.placeOfPreCarriage ?? '',
      transporterName: ci.transporterName ?? '', vehicleNumber: ci.vehicleNumber ?? '',
      lrNumber: ci.lrNumber ?? '', challanNumber: ci.challanNumber ?? '',
      challanDate: ci.challanDate?.split('T')[0] ?? '',
    });
  }, [editCommercialInvoice]);

  // Preview next number (only in create mode)
  useEffect(() => {
    if (isEditMode) return;
    fetch(`${API_BASE}/commercial-invoices/preview-next?invoiceKind=${invoiceKind}&date=${invoiceDate}`)
      .then(r => r.json())
      .then(d => setNextNumber(d.nextInvoiceNumber || 'Error'))
      .catch(() => setNextNumber('Error'));
  }, [invoiceKind, invoiceDate, isEditMode]);

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0), 0);
  const discountNum = parseFloat(discount) || 0;
  const rawGrand = subtotal - discountNum;
  const grandTotal = roundOverride !== '' ? parseFloat(roundOverride) : Math.round(rawGrand);
  const roundAdj = grandTotal - rawGrand;
  const advanceAmount = parseFloat(((grandTotal * paymentAdvancePct) / 100).toFixed(2));
  const fxNum = parseFloat(fxRate) || 0;
  const grandConverted = fxNum ? (grandTotal / fxNum).toFixed(2) : '—';

  const updateItem = (i, field, val) => { const n = [...items]; n[i] = { ...n[i], [field]: val }; setItems(n); };
  const setCustomField = (f, v) => setCustoms(prev => ({ ...prev, [f]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientName || !clientAddress || !outputCurrency || !fxRate || !items.some(it => it.description)) {
      setErrorMessage('Please fill all required fields (Client, Currency, FX Rate, and at least one item).');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const url    = isEditMode
        ? `${API_BASE}/commercial-invoices/${encodeURIComponent(editCommercialInvoice.invoiceNumber)}`
        : `${API_BASE}/commercial-invoices`;
      const method = isEditMode ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceKind, invoiceDate, dueDate: dueDate || null,
          exporterName, exporterAddress, exporterContact,
          clientName, clientAddress,
          outputCurrency, fxRate: parseFloat(fxRate), fxRateDate,
          incoterms: incoterms || null,
          paymentAdvancePct: parseFloat(paymentAdvancePct) || 0,
          paymentBalanceMode, paymentNetDays: paymentNetDays || null,
          bankAccountNumber, bankName, bankBranchAddress, swiftBicCode,
          purposeCode: purposeCode || null, declaration,
          discount: discountNum,
          roundOverride: roundOverride !== '' ? parseFloat(roundOverride) : null,
          items: items.filter(it => it.description),
          ...customs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} Commercial Invoice`);
      onSuccess?.();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const kindColor = invoiceKind === 'COMMERCIAL' ? '#1e3a5f' : '#4a1d96';

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: 22 }}>{isEditMode ? `✏️ Edit Invoice: ${editCommercialInvoice.invoiceNumber}` : '📄 New Commercial / Proforma Invoice'}</h2>

      {/* Kind Toggle */}
      <div style={{ display: 'flex', gap: 0, border: `2px solid ${kindColor}`, borderRadius: 10, overflow: 'hidden', width: 'fit-content' }}>
        {['COMMERCIAL', 'PROFORMA'].map(k => (
          <button key={k} type="button" onClick={() => setInvoiceKind(k)}
            style={{ padding: '10px 24px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: invoiceKind === k ? kindColor : 'transparent', color: invoiceKind === k ? '#fff' : kindColor }}>
            {k === 'COMMERCIAL' ? '🏦 Commercial Invoice' : '📋 Proforma Invoice'}
          </button>
        ))}
      </div>

      <div style={{ background: kindColor, color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 13, opacity: 0.9 }}>
        GMP International — {invoiceKind === 'COMMERCIAL' ? 'Commercial' : 'Proforma'} Invoice
      </div>

      {/* 1. Invoice Details */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Invoice Details</h3>
        <div style={row3}>
          <div>
            <label style={lbl}>Invoice Date</label>
            <input type="date" style={inp} value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Due Date (Optional)</label>
            <input type="date" style={inp} value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Invoice Number (Auto)</label>
            <input style={{ ...inp, fontWeight: 700, opacity: 0.7 }} value={nextNumber} readOnly />
          </div>
        </div>
        <div style={row2}>
          <div>
            <label style={lbl}>Incoterms</label>
            <select style={inp} value={incoterms} onChange={e => setIncoterms(e.target.value)}>
              <option value="">— None —</option>
              {INCOTERMS_OPTIONS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Exporter Details */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Exporter Details</h3>
        <div>
          <label style={lbl}>Exporter Name</label>
          <input type="text" style={inp} value={exporterName} onChange={e => setExporterName(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Exporter Address</label>
          <textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={exporterAddress} onChange={e => setExporterAddress(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Exporter Contact</label>
          <input type="text" style={inp} value={exporterContact} onChange={e => setExporterContact(e.target.value)} placeholder="Phone / Email" />
        </div>
      </div>

      {/* 3. Client */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Bill To (Client)</h3>
        <div>
          <label style={lbl}>Client Name *</label>
          <input type="text" style={inp} value={clientName} onChange={e => setClientName(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Client Address *</label>
          <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={clientAddress} onChange={e => setClientAddress(e.target.value)} />
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
          <div style={{ background: '#e8edf5', border: '1px solid #1e3a5f', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
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
                <th key={h} style={{ padding: '8px 10px', textAlign: ['Amount (₹)', 'Qty', 'Rate (₹)'].includes(h) ? 'right' : 'left', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
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
                    <input list={`uom-ci-${i}`} style={{ ...inp, fontSize: 13, width: 80 }} value={it.uom} onChange={e => updateItem(i, 'uom', e.target.value)} />
                    <datalist id={`uom-ci-${i}`}>{UOM_OPTIONS.map(u => <option key={u} value={u} />)}</datalist>
                  </td>
                  <td style={{ padding: '4px 6px' }}><input type="number" style={{ ...inp, fontSize: 13, textAlign: 'right', width: 80 }} value={it.qty} onChange={e => updateItem(i, 'qty', e.target.value)} /></td>
                  <td style={{ padding: '4px 6px' }}><input type="number" step="0.01" style={{ ...inp, fontSize: 13, textAlign: 'right', width: 100 }} value={it.rate} onChange={e => updateItem(i, 'rate', e.target.value)} /></td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>₹{amt.toFixed(2)}</td>
                  <td>{items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16} /></button>}</td>
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
          <div><label style={lbl}>Discount (₹)</label><input type="number" style={inp} value={discount} onChange={e => setDiscount(e.target.value)} /></div>
          <div><label style={lbl}>Round Off Override</label><input type="number" style={inp} value={roundOverride} onChange={e => setRoundOverride(e.target.value)} placeholder="Auto" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 280 }}>
            {[['Subtotal', `₹${subtotal.toFixed(2)}`], ['Discount', `-₹${discountNum.toFixed(2)}`], ['Round Off', `₹${roundAdj.toFixed(2)}`]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--border-color)', fontSize: 13 }}><span>{k}</span><span>{v}</span></div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 700, fontSize: 16, color: kindColor }}>
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
          <div><label style={lbl}>Advance %</label><input type="number" min={0} max={100} style={inp} value={paymentAdvancePct} onChange={e => setPaymentAdvancePct(e.target.value)} /></div>
          <div><label style={lbl}>Advance Amount (₹)</label><input style={{ ...inp, opacity: 0.7 }} value={`₹${advanceAmount.toFixed(2)}`} readOnly /></div>
          <div><label style={lbl}>Balance Mode</label>
            <select style={inp} value={paymentBalanceMode} onChange={e => setPaymentBalanceMode(e.target.value)}>
              <option value="ON_DELIVERY">On Delivery</option><option value="NET_DAYS">Net Days</option>
            </select>
          </div>
        </div>
        {paymentBalanceMode === 'NET_DAYS' && <div style={{ maxWidth: 200 }}><label style={lbl}>Number of Days</label><input type="number" style={inp} value={paymentNetDays} onChange={e => setPaymentNetDays(e.target.value)} /></div>}
      </div>

      {/* 8. Bank Details */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Bank Details</h3>
        <div style={row2}>
          <div><label style={lbl}>Account Number</label><input type="text" style={inp} value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} /></div>
          <div><label style={lbl}>Bank Name</label><input type="text" style={inp} value={bankName} onChange={e => setBankName(e.target.value)} /></div>
        </div>
        <div style={row2}>
          <div><label style={lbl}>Branch Address</label><input type="text" style={inp} value={bankBranchAddress} onChange={e => setBankBranchAddress(e.target.value)} /></div>
          <div><label style={lbl}>SWIFT / BIC Code</label><input type="text" style={inp} value={swiftBicCode} onChange={e => setSwiftBicCode(e.target.value)} placeholder="e.g. ICICINBBCTS" /></div>
        </div>
      </div>

      {/* 9. Purpose Code */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>RBI Purpose Code</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Purpose Code (Optional)</label>
            <input type="text" style={inp} value={purposeCode} onChange={e => setPurposeCode(e.target.value)} placeholder="e.g. P0101" />
          </div>
          <a href="https://www.rbi.org.in/upload/notification/pdfs/52220.pdf" target="_blank" rel="noreferrer"
            style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            📄 View RBI List
          </a>
        </div>
      </div>

      {/* 10. Shipping / Customs (Collapsible) */}
      <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
        <button type="button" onClick={() => setShowCustoms(!showCustoms)}
          style={{ width: '100%', padding: '16px 24px', background: 'var(--bg-card)', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>
          <span>📦 Shipping & Customs Details (Optional)</span>
          {showCustoms ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {showCustoms && (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={row2}>
              <div><label style={lbl}>Country of Origin</label><CountrySelect value={customs.countryOfOrigin} onChange={v => setCustomField('countryOfOrigin', v)} placeholder="Select country of origin…" /></div>
              <div><label style={lbl}>Country of Final Destination</label><CountrySelect value={customs.countryOfFinalDestination} onChange={v => setCustomField('countryOfFinalDestination', v)} placeholder="Select destination country…" /></div>
            </div>
            <div style={row3}>
              <div><label style={lbl}>Final Destination</label><input type="text" style={inp} value={customs.finalDestination} onChange={e => setCustomField('finalDestination', e.target.value)} /></div>
              <div><label style={lbl}>Port of Loading</label><input type="text" style={inp} value={customs.portOfLoading} onChange={e => setCustomField('portOfLoading', e.target.value)} /></div>
              <div><label style={lbl}>Vessel / Flight No</label><input type="text" style={inp} value={customs.vesselOrFlightNo} onChange={e => setCustomField('vesselOrFlightNo', e.target.value)} /></div>
            </div>
            <div style={row3}>
              <div><label style={lbl}>Shipping Bill No</label><input type="text" style={inp} value={customs.shippingBillNumber} onChange={e => setCustomField('shippingBillNumber', e.target.value)} /></div>
              <div><label style={lbl}>Shipping Bill Date</label><input type="date" style={inp} value={customs.shippingBillDate} onChange={e => setCustomField('shippingBillDate', e.target.value)} /></div>
              <div><label style={lbl}>Shipping Port Code</label><input type="text" style={inp} value={customs.shippingPortCode} onChange={e => setCustomField('shippingPortCode', e.target.value)} /></div>
            </div>
            <div style={row3}>
              <div><label style={lbl}>Pre-Carriage By</label><input type="text" style={inp} value={customs.preCarriageBy} onChange={e => setCustomField('preCarriageBy', e.target.value)} /></div>
              <div><label style={lbl}>Place of Pre-Carriage</label><input type="text" style={inp} value={customs.placeOfPreCarriage} onChange={e => setCustomField('placeOfPreCarriage', e.target.value)} /></div>
              <div><label style={lbl}>Transporter Name</label><input type="text" style={inp} value={customs.transporterName} onChange={e => setCustomField('transporterName', e.target.value)} /></div>
            </div>
            <div style={row3}>
              <div><label style={lbl}>Vehicle No</label><input type="text" style={inp} value={customs.vehicleNumber} onChange={e => setCustomField('vehicleNumber', e.target.value)} /></div>
              <div><label style={lbl}>L.R. No</label><input type="text" style={inp} value={customs.lrNumber} onChange={e => setCustomField('lrNumber', e.target.value)} /></div>
              <div><label style={lbl}>Challan No</label><input type="text" style={inp} value={customs.challanNumber} onChange={e => setCustomField('challanNumber', e.target.value)} /></div>
            </div>
          </div>
        )}
      </div>

      {/* 11. Declaration */}
      <div style={sec}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--theme-accent)' }}>Declaration</h3>
        <textarea rows={3} style={{ ...inp, resize: 'vertical', fontSize: 12 }} value={declaration} onChange={e => setDeclaration(e.target.value)} />
      </div>

      {errorMessage && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#dc2626', fontSize: 14 }}>⚠️ {errorMessage}</div>
      )}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
        <button type="submit" disabled={isLoading} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: kindColor, color: '#fff', fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: 14 }}>
          {isLoading ? 'Generating PDF…' : '✅ Save & Generate PDF'}
        </button>
      </div>
    </form>
  );
}
