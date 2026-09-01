import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Bell, Menu, User } from 'lucide-react';

const pageMeta = {
  dashboard: { title: 'Dashboard', hint: 'Overview' },
  opportunities: { title: 'Opportunities', hint: 'Open RFQs' },
  my_quotes: { title: 'My Quotes', hint: 'Submitted bids' },
  purchase_orders: { title: 'Purchase Orders', hint: 'Awards' },
  messages: { title: 'Messages', hint: 'Account' },
  profile: { title: 'Profile', hint: 'Account' },
};

export const VendorHeader = ({ activeTab = 'dashboard' }) => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    user,
    logout,
    sidebarOpen,
    setSidebarOpen,
  } = useApp();

  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const unreadNotifs = notifications.filter((n) => !n.read);
  const meta = pageMeta[activeTab] || pageMeta.dashboard;

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
          <span className="header-page-label">{meta.title}</span>
          <span className="header-page-hint">{meta.hint}</span>
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
                <span className="notif-title">Vendor Alerts</span>
                {unreadNotifs.length > 0 && (
                  <button onClick={markAllNotificationsRead} className="notif-clear-btn">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-secondary">No notifications</div>
                ) : (
                  notifications.slice(0, 5).map((n) => (
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
            </div>
          )}
        </div>

        <div className="user-profile-badge">
          <div className="user-avatar">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name || 'Vendor'}</span>
            <span className="user-role">{user?.supplierName || 'Vendor'}</span>
          </div>
          <button onClick={logout} className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};
