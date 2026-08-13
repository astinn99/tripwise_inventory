import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Bell, CheckCircle2, AlertTriangle, XCircle, Info, Filter, Trash2 } from 'lucide-react';

export const Notifications = () => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    searchQuery
  } = useApp();

  const [severityFilter, setSeverityFilter] = useState('ALL');

  const filteredNotifs = notifications.filter(n => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSev = severityFilter === 'ALL' || n.severity === severityFilter;
    return matchesSearch && matchesSev;
  });

  return (
    <div className="notifications-page">
      {/* Subsystem Banner */}
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">ALERTS & NOTIFICATIONS</span>
          <div>
            <h2 className="subsystem-heading">Supply Chain Notifications Center</h2>
            <p className="subsystem-subtext">Real-time subsystem notifications regarding inventory stock levels, finance approval decisions, deliveries, and document expirations.</p>
          </div>
        </div>
        <button onClick={markAllNotificationsRead} className="btn btn-outline btn-sm">
          <CheckCircle2 className="w-4 h-4" /> Mark All Read
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-bold uppercase">Severity Filter:</span>
          <div className="flex gap-1">
            {['ALL', 'danger', 'warning', 'success', 'info'].map(sev => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`btn btn-sm ${severityFilter === sev ? 'btn-primary' : 'btn-outline'} capitalize`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <Bell className="w-5 h-5 text-rose-400" /> System Alerts Feed ({filteredNotifs.length})
          </span>
        </div>

        <div className="space-y-3">
          {filteredNotifs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No notifications match the filter.</div>
          ) : (
            filteredNotifs.map(n => (
              <div
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
                className={`p-4 rounded-lg border flex items-start justify-between cursor-pointer transition ${!n.read ? 'bg-slate-900/90 border-blue-500/50 shadow-md' : 'bg-slate-950/40 border-slate-800'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {n.severity === 'danger' && <XCircle className="w-5 h-5 text-rose-400" />}
                    {n.severity === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                    {n.severity === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    {n.severity === 'info' && <Info className="w-5 h-5 text-blue-400" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">{n.title}</span>
                      {!n.read && <span className="badge badge-normal text-xs p-0.5 px-2">UNREAD</span>}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                    <span className="text-xs text-slate-500 block mt-1.5 font-mono">{n.timestamp}</span>
                  </div>
                </div>

                {!n.read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markNotificationRead(n.id);
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
