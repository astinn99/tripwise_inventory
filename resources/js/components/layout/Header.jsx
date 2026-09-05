import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  Bell,
  User,
  X,
  Menu
} from 'lucide-react';

const pageMeta = {
  dashboard: { title: 'Dashboard', hint: 'Overview' },
  supply_requests: { title: 'Supply Requests', hint: 'Supply Chain' },
  procurement: { title: 'Procurement', hint: 'Supply Chain' },
  quotations: { title: 'Quotations', hint: 'Supply Chain' },
  purchase_orders: { title: 'Purchase Orders', hint: 'Supply Chain' },
  suppliers: { title: 'Suppliers', hint: 'Supply Chain' },
  vendor_messages: { title: 'Vendor Messages', hint: 'Supply Chain' },
  items: { title: 'Items', hint: 'Inventory' },
  stock_monitoring: { title: 'Stock Monitoring', hint: 'Inventory' },
  inventory_movements: { title: 'Inventory Movements', hint: 'Inventory' },
  stock_count: { title: 'Stock Count', hint: 'Inventory' },
  receiving: { title: 'Receiving', hint: 'Warehouse' },
  inspection: { title: 'Inspection', hint: 'Warehouse' },
  storage_locations: { title: 'Storage Locations', hint: 'Warehouse' },
  releases: { title: 'Releases', hint: 'Warehouse' },
  documents: { title: 'Documents', hint: 'DTRS' },
  expiring_documents: { title: 'Expiring Documents', hint: 'DTRS' },
  reports: { title: 'Reports', hint: 'Analytics' },
  forecasts: { title: 'AI Forecasting', hint: 'Analytics' },
  notifications: { title: 'Notifications', hint: 'Alerts' },
};

export const Header = () => {
  const {
    activeTab,
    searchQuery,
    setSearchQuery,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    setActiveTab,
    sidebarOpen,
    setSidebarOpen,
    user,
    logout
  } = useApp();

  const roleLabel = {
    supply_chain: 'Supply Chain Lead',
    supplier: user?.supplierName || 'Vendor',
  }[user?.role] || user?.role;

  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const unreadNotifs = notifications.filter(n => !n.read);
  const currentPage = pageMeta[activeTab] || { title: 'Dashboard', hint: 'Overview' };

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <span className="header-page-label">{currentPage.title}</span>
          <span className="header-page-hint">{currentPage.hint}</span>
        </div>
      </div>

      <div className="header-center">
        <div className="header-search-box">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search items, POs, suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="header-search-input"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="search-clear-btn">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="header-right">
        <div className="notif-dropdown-wrapper">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="header-icon-btn"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifs.length > 0 && (
              <span className="notif-count-badge">{unreadNotifs.length}</span>
            )}
          </button>

          {showNotifMenu && (
            <div className="notif-dropdown-menu">
              <div className="notif-header">
                <span className="notif-title">Alerts</span>
                {unreadNotifs.length > 0 && (
                  <button onClick={markAllNotificationsRead} className="notif-clear-btn">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="empty-state">
                    <p>No notifications</p>
                  </div>
                ) : (
                  notifications.slice(0, 5).map(n => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={`notif-item ${!n.read ? 'unread' : ''}`}
                    >
                      <div className="notif-item-header">
                        <span className={`notif-type-tag ${n.severity}`}>{n.title}</span>
                        <span className="notif-time">{n.timestamp}</span>
                      </div>
                      <p className="notif-msg">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="notif-footer">
                <button
                  onClick={() => {
                    setActiveTab('notifications');
                    setShowNotifMenu(false);
                  }}
                  className="view-all-notifs-btn"
                >
                  View all
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="user-profile-badge">
          <div className="user-avatar">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name || 'User'}</span>
            <span className="user-role">{roleLabel}</span>
          </div>
          <button onClick={logout} className="btn btn-outline btn-sm">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};
