import React from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from './BrandLogo';
import {
  LayoutDashboard,
  ShoppingBag,
  FileText,
  FileCheck,
  MessageSquare,
  Building
} from 'lucide-react';

const menuSections = [
  {
    title: 'VENDOR PORTAL',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'opportunities', label: 'Opportunities', icon: ShoppingBag },
      { id: 'my_quotes', label: 'My Quotes', icon: FileText },
      { id: 'purchase_orders', label: 'Purchase Orders', icon: FileCheck },
    ]
  },
  {
    title: 'ACCOUNT',
    items: [
      { id: 'messages', label: 'Messages', icon: MessageSquare },
      { id: 'profile', label: 'Profile', icon: Building },
    ]
  }
];

export const VendorSidebar = ({ activeTab, setActiveTab }) => {
  const { opportunities, quotations, purchaseOrders, sidebarOpen, setSidebarOpen, vendorMessageUnread } = useApp();

  const badges = {
    opportunities: opportunities.length,
    my_quotes: quotations.filter((quote) => !String(quote.id || '').startsWith('tmp-')).length,
    purchase_orders: purchaseOrders.filter((po) => po.poStatus === 'Sent to Supplier').length,
    messages: vendorMessageUnread,
  };

  return (
    <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`} id="app-sidebar">
      <div className="sidebar-brand">
        <BrandLogo subtitle="Vendor Portal" />
      </div>

      <nav className="sidebar-nav">
        {menuSections.map((section, idx) => (
          <div key={idx} className="nav-section">
            <div className="nav-section-title">{section.title}</div>
            <ul className="nav-list">
              {section.items.map((item) => {
                const Icon = item.icon;
                const badge = badges[item.id] || 0;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        setActiveTab(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
                    >
                      <Icon className="nav-icon" />
                      <span className="nav-label">{item.label}</span>
                      {badge > 0 && (
                        <span className="nav-badge bg-blue" title={`${badge} items`}>
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="system-version">
          <span className="status-online">Online</span>
        </div>
      </div>
    </aside>
  );
};
