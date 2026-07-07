import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://localhost:3001/api';

const UOM_OPTIONS = ['kg', 'units', 'nos'];

export default function InvoiceForm({ editInvoice, onCancel, onSuccess }) {
  const isEditMode = !!editInvoice;

  // 1. Company Configuration State (seeding defaults)
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // 2. Invoice Fields State
  const [invoiceType, setInvoiceType] = useState('TAX');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().substring(0, 10));
  const [poNumber, setPoNumber] = useState('');
  const [transportMode, setTransportMode] = useState('MANUAL');
  const [lrNumber, setLrNumber] = useState('');

  // Buyer Details
  const [buyerName, setBuyerName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');
  const [gstinValid, setGstinValid] = useState(null);
  const [gstinError, setGstinError] = useState('');

  // Shipping Details
  const [shipSameAsBilling, setShipSameAsBilling] = useState(true);
  const [shipToName, setShipToName] = useState('');
  const [shipToAddress, setShipToAddress] = useState('');
  const [shipToGstin, setShipToGstin] = useState('');

  // Items State
  const [items, setItems] = useState([
    { description: '', hsnCode: '', uom: 'units', qty: 0, rate: 0, taxRate: 18.0 }
  ]);

  // Financial Summary State
  const [discount, setDiscount] = useState(0);
  const [nextNumberPreview, setNextNumberPreview] = useState('Generating...');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // HSN Autocomplete helpers
  const [hsnSuggestions, setHsnSuggestions] = useState({}); // row index -> list of suggestions
  const [activeHsnRow, setActiveHsnRow] = useState(null);

  // Fetch company configs on load
  useEffect(() => {
    fetch(`${API_BASE}/companies`)
      .then(res => res.json())
      .then(data => {
        setCompanies(data);
        if (data.length > 0) {
          // If editing, find matching company. If creating, default to first company
          const initialCompany = isEditMode
            ? data.find(c => c.id === editInvoice.companyId)
            : data[0];
          setSelectedCompany(initialCompany || data[0]);
        }
      })
      .catch(err => console.error("Error loading companies:", err));
  }, [editInvoice]);

  // Load existing invoice details if in edit mode
  useEffect(() => {
    if (editInvoice) {
      setInvoiceType(editInvoice.invoiceType);
      setInvoiceDate(editInvoice.invoiceDate.substring(0, 10));
      setPoNumber(editInvoice.poNumber || '');
      setTransportMode(editInvoice.transportMode);
      setLrNumber(editInvoice.lrNumber || '');
      setBuyerName(editInvoice.buyerName);
      setBuyerAddress(editInvoice.buyerAddress);
      setBuyerGstin(editInvoice.buyerGstin === 'URD' ? '' : editInvoice.buyerGstin);

      const hasSeparateShipping =
        editInvoice.shipToName !== editInvoice.buyerName ||
        editInvoice.shipToAddress !== editInvoice.buyerAddress ||
        (editInvoice.shipToGstin && editInvoice.shipToGstin !== editInvoice.buyerGstin);

      setShipSameAsBilling(!hasSeparateShipping);
      setShipToName(editInvoice.shipToName || '');
      setShipToAddress(editInvoice.shipToAddress || '');
      setShipToGstin(editInvoice.shipToGstin === 'URD' ? '' : editInvoice.shipToGstin || '');

      setDiscount(editInvoice.discountTotal);
      setItems(editInvoice.items.map(item => ({
        description: item.description,
        hsnCode: item.hsnCode,
        uom: item.uom,
        qty: item.qty,
        rate: item.rate,
        taxRate: item.taxRate
      })));
      setNextNumberPreview(editInvoice.invoiceNumber);
    }
  }, [editInvoice]);

  // Inject CSS Variables for Dynamic Color Theme
  useEffect(() => {
    if (selectedCompany) {
      document.documentElement.style.setProperty('--theme-primary', selectedCompany.themePrimary);
      document.documentElement.style.setProperty('--theme-secondary', selectedCompany.themeSecondary);
      document.documentElement.style.setProperty('--theme-accent', selectedCompany.themeAccent);

      // Update next invoice number preview (if not in edit mode)
      if (!isEditMode) {
        fetchNextNumberPreview(selectedCompany.code, invoiceDate);
      }
    }
  }, [selectedCompany, invoiceDate, isEditMode]);

  // Copy billing to shipping
  useEffect(() => {
    if (shipSameAsBilling) {
      setShipToName(buyerName);
      setShipToAddress(buyerAddress);
      setShipToGstin(buyerGstin);
    }
  }, [shipSameAsBilling, buyerName, buyerAddress, buyerGstin]);

  // Helper to fetch invoice number preview
  const fetchNextNumberPreview = (code, date) => {
    fetch(`${API_BASE}/invoices/preview-next?companyCode=${code}&date=${date}`)
      .then(res => res.json())
      .then(data => {
        setNextNumberPreview(data.nextInvoiceNumber);
      })
      .catch(err => {
        console.error("Error fetching invoice preview:", err);
        setNextNumberPreview('Sequence error');
      });
  };

  // Run local GSTIN format validation
  const handleGstinBlur = (val) => {
    if (!val) {
      setGstinValid(null);
      setGstinError('');
      return;
    }

    fetch(`${API_BASE}/gst/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gstin: val })
    })
      .then(res => res.json())
      .then(data => {
        setGstinValid(data.isValid);
        setGstinError(data.error || '');
      })
      .catch(err => console.error("Error validating GSTIN:", err));
  };

  // HSN Suggestions lookup
  const handleHsnChange = (index, value) => {
    updateItemField(index, 'hsnCode', value);

    if (value.length < 3) {
      setHsnSuggestions(prev => ({ ...prev, [index]: [] }));
      return;
    }

    fetch(`${API_BASE}/hsn/suggest/${value}`)
      .then(res => res.json())
      .then(data => {
        setHsnSuggestions(prev => ({ ...prev, [index]: data }));
        setActiveHsnRow(index);
      })
      .catch(err => console.error(err));
  };

  const selectHsnSuggestion = (rowIndex, suggestion) => {
    const newItems = [...items];
    newItems[rowIndex].hsnCode = suggestion.hsnCode;
    newItems[rowIndex].taxRate = suggestion.taxRate;
    setItems(newItems);
    setHsnSuggestions(prev => ({ ...prev, [rowIndex]: [] }));
    setActiveHsnRow(null);
  };

  // Items manipulation
  const updateItemField = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItemRow = () => {
    setItems([...items, { description: '', hsnCode: '', uom: 'units', qty: 0, rate: 0, taxRate: 18.0 }]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Client-side math previews
  const calculatePreviewTotals = () => {
    const sellerGstin = selectedCompany ? selectedCompany.gstin : '';
    const sellerState = sellerGstin ? sellerGstin.substring(0, 2) : '';
    const buyerState = buyerGstin ? buyerGstin.substring(0, 2) : sellerState;

    // Unregistered / empty GSTIN defaults to intrastate CGST+SGST
    const isIntrastate = (sellerState === buyerState) || !buyerGstin || buyerGstin.trim().toUpperCase() === 'URD';

    let subtotal = 0;
    items.forEach(item => {
      subtotal += (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
    });

    const taxableValue = subtotal - parseFloat(discount || 0);
    const discountFactor = subtotal > 0 ? (taxableValue / subtotal) : 1;

    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    items.forEach(item => {
      const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
      const taxRate = parseFloat(item.taxRate) || 0;

      let cgstRate = 0;
      let sgstRate = 0;
      let igstRate = 0;

      if (isIntrastate) {
        cgstRate = taxRate / 2;
        sgstRate = taxRate / 2;
      } else {
        igstRate = taxRate;
      }

      cgstTotal += amount * (cgstRate / 100) * discountFactor;
      sgstTotal += amount * (sgstRate / 100) * discountFactor;
      igstTotal += amount * (igstRate / 100) * discountFactor;
    });

    const rawGrandTotal = taxableValue + cgstTotal + sgstTotal + igstTotal;
    const grandTotal = Math.round(rawGrandTotal);
    const roundAdjustment = grandTotal - rawGrandTotal;

    return {
      subtotal: subtotal.toFixed(2),
      taxableValue: taxableValue.toFixed(2),
      cgstTotal: cgstTotal.toFixed(2),
      sgstTotal: sgstTotal.toFixed(2),
      igstTotal: igstTotal.toFixed(2),
      roundAdjustment: roundAdjustment.toFixed(2),
      grandTotal: grandTotal,
      isIntrastate
    };
  };

  const preview = calculatePreviewTotals();

  // Form Submit Handler
  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    // Quick validations
    if (items.some(item => !item.description || item.qty <= 0 || item.rate <= 0)) {
      setErrorMessage("Please ensure all item descriptions, quantities, and rates are filled and greater than zero.");
      setIsLoading(false);
      return;
    }

    if (buyerGstin && gstinValid === false) {
      setErrorMessage("Please correct the Buyer GSTIN before saving.");
      setIsLoading(false);
      return;
    }

    const payload = {
      companyCode: selectedCompany.code,
      invoiceType,
      invoiceDate,
      poNumber,
      buyerGstin: buyerGstin.trim().toUpperCase(),
      buyerName,
      buyerAddress,
      shipToName,
      shipToAddress,
      shipToGstin: shipToGstin.trim().toUpperCase(),
      transportMode,
      lrNumber,
      discount: parseFloat(discount) || 0,
      items: items.map(item => ({
        description: item.description,
        hsnCode: item.hsnCode,
        uom: item.uom,
        qty: parseFloat(item.qty),
        rate: parseFloat(item.rate),
        taxRate: parseFloat(item.taxRate)
      }))
    };

    const url = isEditMode
      ? `${API_BASE}/invoices/${editInvoice.invoiceNumber}`
      : `${API_BASE}/invoices`;

    const method = isEditMode ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || "Save failed") });
        }
        return res.json();
      })
      .then(data => {
        setIsLoading(false);
        onSuccess(data);
      })
      .catch(err => {
        setIsLoading(false);
        setErrorMessage(err.message);
      });
  };

  return (
    <form className="card" onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <h2 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        {isEditMode ? `Regenerate Invoice: ${editInvoice.invoiceNumber}` : "Create New Invoice"}
      </h2>

      {/* 1. Company selector (Branding loads dynamically) */}
      <div className="form-group" style={{ marginBottom: '24px' }}>
        <label>Issuing Company</label>
        <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
          {companies.map(c => {
            const isSelected = selectedCompany?.code === c.code;
            return (
              <button
                key={c.id}
                type="button"
                className="btn"
                disabled={isEditMode} // Cannot change company on edit
                onClick={() => setSelectedCompany(c)}
                style={{
                  flex: 1,
                  padding: '16px',
                  background: isSelected ? c.themePrimary : 'rgba(255, 255, 255, 0.03)',
                  color: isSelected ? c.themeSecondary : 'var(--text-muted)',
                  border: `2px solid ${isSelected ? 'transparent' : 'var(--border-color)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '12px',
                  cursor: isEditMode ? 'not-allowed' : 'pointer',
                  opacity: isEditMode && !isSelected ? 0.5 : 1
                }}
              >
                <span style={{ fontSize: '18px', fontWeight: '700' }}>{c.displayName}</span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>GSTIN: {c.gstin}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Metadata details */}
      <div className="form-row">
        <div className="form-group">
          <label>Invoice Type</label>
          <select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)} disabled={isEditMode}>
            <option value="TAX">Tax Invoice</option>
            <option value="PROFORMA">Proforma Invoice</option>
          </select>
        </div>

        <div className="form-group">
          <label>Invoice Date</label>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Order / PO Number</label>
          <input
            type="text"
            placeholder="e.g. PO-9872"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Transport Mode</label>
          <select value={transportMode} onChange={(e) => setTransportMode(e.target.value)}>
            <option value="MANUAL">Manual</option>
            <option value="COURIER">Courier</option>
          </select>
        </div>

        <div className="form-group">
          <label>LR / Tracking Number (Optional)</label>
          <input
            type="text"
            placeholder="e.g. LR-452136"
            value={lrNumber}
            onChange={(e) => setLrNumber(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Invoice Number Suffix</label>
          <input
            type="text"
            value={nextNumberPreview}
            enabled={true}
            style={{ background: 'rgba(255,255,255,0.05)', fontWeight: 'bold', color: 'var(--theme-accent)' }}
          />
        </div>
      </div>

      {/* 3. Buyer details */}
      <h3 style={{ margin: '20px 0 10px', fontSize: '15px', color: 'var(--theme-accent)' }}>Billing / Buyer Details</h3>

      <div className="form-row">
        <div className="form-group">
          <label>Buyer GSTIN (15-digit)</label>
          <input
            type="text"
            placeholder="e.g. 07AAAAA1111A1Z0"
            value={buyerGstin}
            onChange={(e) => {
              setBuyerGstin(e.target.value);
              setGstinValid(null);
            }}
            onBlur={(e) => handleGstinBlur(e.target.value)}
          />
          {gstinValid === true && <span style={{ fontSize: '11px', color: 'var(--ok-color)' }}>✓ Valid local GSTIN structure</span>}
          {gstinValid === false && <span style={{ fontSize: '11px', color: 'var(--danger-color)' }}>✗ {gstinError}</span>}
          {buyerGstin && gstinValid === true && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
              Tax routing: {preview.isIntrastate ? 'Intrastate (CGST + SGST)' : 'Interstate (IGST)'}
            </span>
          )}
        </div>

        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label>Buyer Name</label>
          <input
            type="text"
            placeholder="Legal Company Name"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label>Billing Address</label>
        <textarea
          rows="2"
          placeholder="Complete Address"
          value={buyerAddress}
          onChange={(e) => setBuyerAddress(e.target.value)}
          required
        />
      </div>

      {/* 4. Ship To details */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '20px 0 10px' }}>
        <input
          type="checkbox"
          id="shipSame"
          checked={shipSameAsBilling}
          onChange={(e) => setShipSameAsBilling(e.target.checked)}
          style={{ width: 'auto', cursor: 'pointer' }}
        />
        <label htmlFor="shipSame" style={{ cursor: 'pointer', textTransform: 'none', fontSize: '14px', color: 'var(--text-main)' }}>
          Shipping details are same as Billing details
        </label>
      </div>

      {!shipSameAsBilling && (
        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
          <h4 style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--text-muted)' }}>Shipping Details</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Shipping GSTIN</label>
              <input
                type="text"
                placeholder="Shipping GSTIN (if different)"
                value={shipToGstin}
                onChange={(e) => setShipToGstin(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Shipping Name</label>
              <input
                type="text"
                placeholder="Receiver / Consignee Name"
                value={shipToName}
                onChange={(e) => setShipToName(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Shipping Address</label>
            <textarea
              rows="2"
              placeholder="Delivery Address"
              value={shipToAddress}
              onChange={(e) => setShipToAddress(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* 5. Items table */}
      <h3 style={{ margin: '24px 0 10px', fontSize: '15px', color: 'var(--theme-accent)' }}>Invoice Line Items</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Description</th>
              <th style={{ width: '15%' }}>HSN Code</th>
              <th style={{ width: '12%' }}>UOM</th>
              <th style={{ width: '10%' }}>Qty</th>
              <th style={{ width: '12%' }}>Rate (excl. GST)</th>
              <th style={{ width: '11%' }}>GST %</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={{ verticalAlign: 'top' }}>
                <td>
                  <input
                    type="text"
                    placeholder="Item details / Services"
                    value={item.description}
                    onChange={(e) => updateItemField(idx, 'description', e.target.value)}
                    required
                  />
                </td>
                <td style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="8-digit HSN"
                    value={item.hsnCode}
                    onChange={(e) => handleHsnChange(idx, e.target.value)}
                    onFocus={() => setActiveHsnRow(idx)}
                    required
                  />
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                    Guide: numeric only
                  </span>

                  {activeHsnRow === idx && hsnSuggestions[idx] && hsnSuggestions[idx].length > 0 && (
                    <div className="suggestions-box">
                      {hsnSuggestions[idx].map(sug => (
                        <div
                          key={sug.id}
                          className="suggestion-item"
                          onClick={() => selectHsnSuggestion(idx, sug)}
                        >
                          <strong>{sug.hsnCode}</strong> - {sug.description} ({sug.taxRate}%)
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    list={`uom-options-${idx}`}
                    placeholder="nos"
                    value={item.uom}
                    onChange={(e) => updateItemField(idx, 'uom', e.target.value)}
                    required
                  />
                  <datalist id={`uom-options-${idx}`}>
                    {UOM_OPTIONS.map(o => <option key={o} value={o} />)}
                  </datalist>
                </td>
                <td>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={item.qty || ''}
                    onChange={(e) => updateItemField(idx, 'qty', parseFloat(e.target.value) || 0)}
                    required
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={item.rate || ''}
                    onChange={(e) => updateItemField(idx, 'rate', parseFloat(e.target.value) || 0)}
                    required
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={item.taxRate || ''}
                    onChange={(e) => updateItemField(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                    required
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => removeItemRow(idx)}
                    disabled={items.length === 1}
                    style={{ padding: '6px 10px', fontSize: '11px' }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="btn btn-secondary" onClick={addItemRow} style={{ marginBottom: '24px' }}>
        + Add Item Row
      </button>

      {/* 6. Calculations & summary layout */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
        <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Basic Subtotal</span>
            <span style={{ fontWeight: '600' }}>₹{preview.subtotal}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Discount (deducted from basic)</span>
            <input
              type="number"
              min="0"
              step="any"
              value={discount || ''}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              style={{ width: '120px', padding: '6px', textAlign: 'right' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Taxable Value</span>
            <span style={{ fontWeight: '600' }}>₹{preview.taxableValue}</span>
          </div>

          {preview.isIntrastate ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
                <span>CGST Total</span>
                <span>₹{preview.cgstTotal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
                <span>SGST Total</span>
                <span>₹{preview.sgstTotal}</span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
              <span>IGST Total</span>
              <span>₹{preview.igstTotal}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span>Round Off Adjustment</span>
            <span>₹{preview.roundAdjustment}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            <strong style={{ fontSize: '18px' }}>Grand Total</strong>
            <strong style={{ fontSize: '18px', color: 'var(--theme-accent)' }}>₹{preview.grandTotal.toLocaleString('en-IN')}</strong>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger-color)', padding: '12px', borderRadius: '8px', margin: '20px 0', fontSize: '13px' }}>
          <strong>Error Saving:</strong> {errorMessage}
        </div>
      )}

      {/* 7. Action buttons */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? (isEditMode ? "Regenerating..." : "Saving...") : (isEditMode ? "Regenerate & Overwrite PDF" : "Generate Invoice")}
        </button>
      </div>
    </form>
  );
}
