import React from 'react';
import {
  ShoppingCart,
  FileText,
  Plus,
  List,
  ChevronLeft,
  ClipboardList,
  Globe,
  Landmark,
} from 'lucide-react';

// ponytail: flat config — each module declares its sub-views
const MODULES = [
  {
    id: 'purchase-orders',
    label: 'Purchase Orders',
    Icon: ShoppingCart,
    views: [
      { id: 'list',   label: 'All Orders',  Icon: List      },
      { id: 'create', label: 'New PO',       Icon: Plus      },
    ],
  },
  {
    id: 'quotations',
    label: 'Quotations',
    Icon: ClipboardList,
    views: [
      { id: 'list',   label: 'All Quotes',   Icon: List      },
      { id: 'create', label: 'New Quotation', Icon: FileText  },
    ],
  },
  {
    id: 'export-quotations',
    label: 'Export Quotations',
    Icon: Globe,
    tag: 'GMP',
    views: [
      { id: 'list',   label: 'All Export Quotes', Icon: List      },
      { id: 'create', label: 'New Export Quote',   Icon: Plus      },
    ],
  },
  {
    id: 'commercial-invoices',
    label: 'Commercial Invoices',
    Icon: Landmark,
    tag: 'GMP',
    views: [
      { id: 'list',   label: 'All Invoices',       Icon: List      },
      { id: 'create', label: 'New Invoice',         Icon: FileText  },
    ],
  },
];


/**
 * Secondary sidebar shown when the user is inside the PO or Quotation modules.
 * Replaces the main Sidebar in the layout shell for those sections.
 */
export default function DocsSidebar({ activeSection, activeView, onNavigate, onViewChange, onBack }) {
  const module = MODULES.find((m) => m.id === activeSection);

  return (
    <nav className="docs-sidebar" aria-label="Document module navigation">
      {/* Back to main app */}
      <button
        className="docs-sidebar-back"
        onClick={onBack}
        type="button"
        aria-label="Back to main navigation"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        Back
      </button>

      {/* Module tabs (PO / Quotations) */}
      <div className="docs-sidebar-modules">
        {MODULES.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`docs-sidebar-module-btn ${activeSection === id ? 'active' : ''}`}
            onClick={() => onNavigate(id)}
            type="button"
            aria-current={activeSection === id ? 'true' : undefined}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* Sub-views for the active module */}
      {module && (
        <ul className="docs-sidebar-views" role="menu">
          {module.views.map(({ id, label, Icon }) => (
            <li key={id} role="none">
              <button
                role="menuitem"
                className={`docs-sidebar-view-btn ${activeView === id ? 'active' : ''}`}
                onClick={() => onViewChange(id)}
                type="button"
                aria-current={activeView === id ? 'page' : undefined}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
