import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Bell, User } from 'lucide-react';

export const VendorHeader = () => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    user,
    logout
  } = useApp();

  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const unreadNotifs = notifications.filter((n) => !n.read);

  return (
    <header className="app-header">
      <div className="header-left">
        <div>
          <span className="header-page-label">Vendor Portal</span>
          <span className="header-page-hint">RFQ workspace</span>
        </div>
      </div>

      <div className="header-center"></div>

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
