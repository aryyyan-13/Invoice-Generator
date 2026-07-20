import { useState, useMemo } from 'react';
import countries from '../../data/countries.json';

export default function CountrySelect({ value, onChange, placeholder = 'Select country…', style }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () => countries.filter(c => c.toLowerCase().includes(query.toLowerCase())).slice(0, 50),
    [query]
  );

  const select = (c) => { onChange(c); setQuery(c); setOpen(false); };

  return (
    <div style={{ position: 'relative', ...style }}>
      <input
        type="text"
        value={open ? query : value || ''}
        placeholder={placeholder}
        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#000', fontSize: '14px' }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#1e2535', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none' }}>
          {filtered.map(c => (
            <li key={c} onMouseDown={() => select(c)} style={{ padding: '8px 14px', cursor: 'pointer', color: '#e2e8f0', fontSize: '13px' }}
              onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.target.style.background = 'transparent'}>
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
