import React from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from './BrandLogo';
import {
  LayoutDashboard,
  ClipboardList,
  ShoppingCart,
  FileSpreadsheet,
  FileCheck,
  Users,
  Package,
  Activity,
  ArrowUpDown,
  Calculator,
  Truck,
  CheckCircle2,
  Boxes,
  Send,
  FileText,
  AlertTriangle,
  BarChart3,
  Bell,
  MessageSquare,
  TrendingUp
} from 'lucide-react';

export const Sidebar = () => {
  const {
    activeTab,
    setActiveTab,
    sidebarOpen,
    setSidebarOpen,
    supplyRequests,
    procurementRequests,
    purchaseOrders,
    inventory,
    deliveries,
    documents,
    notifications,
    vendorMessageUnread
  } = useApp();

  // Badges calculation
  const pendingRequestsCount = supplyRequests.filter(r => r.status === 'Pending' || r.status === 'Received' || r.status === 'For Procurement').length;
  const activePRCount = procurementRequests.filter(p => !p.selectedSupplier && !p.poNumber && p.status !== 'Completed' && p.status !== 'Cancelled').length;
  const pendingFinanceCount = purchaseOrders.filter(p => p.poStatus === 'Pending Finance Approval').length;
  const lowStockCount = inventory.filter(i => i.status === 'LOW STOCK' || i.status === 'OUT OF STOCK').length;
  const expectedDeliveriesCount = deliveries.filter(d => d.status === 'Expected' || d.status === 'In Transit' || d.status === 'Under Inspection').length;
  const readyReleaseCount = supplyRequests.filter(r => r.status === 'Ready for Release').length;
  const expiringDocsCount = documents.filter(d => d.status === 'Expiring Soon' || d.status === 'Expired').length;
  const unreadNotifCount = notifications.filter(n => !n.read).length;

  const menuSections = [
    {
      title: 'DASHBOARD',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'SUPPLY CHAIN',
      items: [
        { id: 'supply_requests', label: 'Supply Requests', icon: ClipboardList, badge: pendingRequestsCount, badgeColor: 'bg-amber', badgeHint: 'pending requests' },
        { id: 'procurement', label: 'Procurement', icon: ShoppingCart, badge: activePRCount, badgeColor: 'bg-blue', badgeHint: 'active requests' },
        { id: 'quotations', label: 'Quotations', icon: FileSpreadsheet },
        { id: 'purchase_orders', label: 'Purchase Orders', icon: FileCheck, badge: pendingFinanceCount, badgeColor: 'bg-purple', badgeHint: 'awaiting approval' },
        { id: 'suppliers', label: 'Suppliers', icon: Users },
        { id: 'vendor_messages', label: 'Vendor Messages', icon: MessageSquare, badge: vendorMessageUnread, badgeColor: 'bg-blue', badgeHint: 'unread vendor messages' }
      ]
    },
    {
      title: 'INVENTORY',
      items: [
        { id: 'items', label: 'Items', icon: Package },
        { id: 'stock_monitoring', label: 'Stock Monitoring', icon: Activity, badge: lowStockCount, badgeColor: 'bg-rose', badgeHint: 'low or out of stock' },
        { id: 'inventory_movements', label: 'Inventory Movements', icon: ArrowUpDown },
        { id: 'stock_count', label: 'Stock Count', icon: Calculator }
      ]
    },
    {
      title: 'WAREHOUSE (SWS)',
      items: [
        { id: 'receiving', label: 'Receiving', icon: Truck, badge: expectedDeliveriesCount, badgeColor: 'bg-cyan', badgeHint: 'expected deliveries' },
        { id: 'inspection', label: 'Inspection', icon: CheckCircle2 },
        { id: 'storage_locations', label: 'Storage Locations', icon: Boxes },
        { id: 'releases', label: 'Releases', icon: Send, badge: readyReleaseCount, badgeColor: 'bg-emerald', badgeHint: 'ready for release' }
      ]
    },
    {
      title: 'DOCUMENTS (DTRS)',
      items: [
        { id: 'documents', label: 'Documents', icon: FileText },
        { id: 'expiring_documents', label: 'Expiring Documents', icon: AlertTriangle, badge: expiringDocsCount, badgeColor: 'bg-amber', badgeHint: 'expiring soon' }
      ]
    },
    {
      title: 'ANALYTICS & ALERTS',
      items: [
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
        { id: 'forecasts', label: 'AI Forecasting', icon: TrendingUp },
        { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifCount, badgeColor: 'bg-rose', badgeHint: 'unread' }
      ]
    }
  ];

  return (
    <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`} id="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <BrandLogo subtitle="Supply Chain & Inventory" />
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav">
        {menuSections.map((section, idx) => (
          <div key={idx} className="nav-section">
            <div className="nav-section-title">{section.title}</div>
            <ul className="nav-list">
              {section.items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        setActiveTab(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`nav-btn ${isActive ? 'active' : ''}`}
                    >
                      <Icon className="nav-icon" />
                      <span className="nav-label">{item.label}</span>
                      {item.badge > 0 && (
                        <span
                          className={`nav-badge ${item.badgeColor || 'bg-blue'}`}
                          title={`${item.badge} ${item.badgeHint || 'items'}`}
                        >
                          {item.badge > 99 ? '99+' : item.badge}
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

      {/* Footer Info */}
      <div className="sidebar-footer">
        <div className="system-version">
          <span className="status-online">Online</span>
        </div>
      </div>
    </aside>
  );
};
