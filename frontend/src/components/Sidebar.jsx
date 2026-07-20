import React from 'react';
import {
  LayoutDashboard,
  Wallet,
  Users,
  FileText,
  Settings,
  LogOut,
  HeadphonesIcon,
  ShoppingCart,
  ClipboardList,
  Globe,
  Landmark,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard',            label: 'Dashboard',           Icon: LayoutDashboard },
  { id: 'wallet',               label: 'Wallet',              Icon: Wallet          },
  { id: 'clients',              label: 'Clients',             Icon: Users           },
  { id: 'invoices',             label: 'Invoice',             Icon: FileText        },
  { id: 'purchase-orders',      label: 'Purchase Orders',     Icon: ShoppingCart    },
  { id: 'quotations',           label: 'Quotations',          Icon: ClipboardList   },
  { id: 'export-quotations',    label: 'Export Quotations',   Icon: Globe,  tag: 'GMP' },
  { id: 'commercial-invoices',  label: 'Comm. Invoices',      Icon: Landmark, tag: 'GMP' },
  { id: 'settings',             label: 'Settings',            Icon: Settings        },
];

export default function Sidebar({ activeSection, onNavigate, onClose }) {
  return (
    <nav className="sidebar" aria-label="Main navigation">
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="sidebar-logo-text">
          Invoice<span className="sidebar-logo-dot" />
        </span>
      </div>

      {/* Navigation Links */}
      <ul className="sidebar-nav" role="menubar" style={{ listStyle: 'none', padding: '8px 12px', gap: '2px', display: 'flex', flexDirection: 'column' }}>
        {NAV_ITEMS.map(({ id, label, Icon, tag }) => (
          <li key={id} role="none">
            <button
              role="menuitem"
              className={`sidebar-nav-item ${activeSection === id ? 'active' : ''}`}
              onClick={() => {
                onNavigate(id);
                if (onClose) onClose(); // close on mobile
              }}
              aria-current={activeSection === id ? 'page' : undefined}
            >
              <Icon className="sidebar-icon" aria-hidden="true" />
              {label}
              {tag && <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, background: '#1a6b3c', color: '#fff', padding: '1px 6px', borderRadius: 10, letterSpacing: '0.3px' }}>{tag}</span>}
            </button>
          </li>
        ))}

      </ul>

      {/* Live Support Placeholder */}
      <div className="sidebar-support" aria-label="Support section">
        <div className="sidebar-support-illustration" aria-hidden="true">
          <HeadphonesIcon size={28} />
        </div>
        <p className="sidebar-support-title">Need assistance?</p>
        <button
          className="btn-support"
          type="button"
          aria-label="Contact live support"
        >
          Live Support
        </button>
      </div>

      {/* Logout */}
      <button
        className="sidebar-logout"
        type="button"
        aria-label="Logout"
        style={{ marginTop: '12px' }}
      >
        <LogOut size={16} aria-hidden="true" />
        Logout
      </button>
    </nav>
  );
}
