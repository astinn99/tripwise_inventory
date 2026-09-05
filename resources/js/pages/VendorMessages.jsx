import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Filter, MessageSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VendorThread } from '../components/ui/VendorThread';
import { api } from '../services/api';
import { formatDisplayDate } from '../services/dates';

const formatMessageTime = (value) => {
  if (!value) {
    return '';
  }
  const [date, time] = String(value).split(' ');
  const pretty = formatDisplayDate(date) || date;
  return time ? `${pretty} ${time}` : pretty;
};

export const VendorMessages = () => {
  const {
    searchQuery,
    vendorMessageRevision,
    vendorMessageFocus,
    setVendorMessageFocus,
    setVendorMessageUnread,
  } = useApp();
  const [inbox, setInbox] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [threadOpen, setThreadOpen] = useState(false);

  const loadInbox = async ({ silent = false } = {}) => {
    if (!silent) {
      setListLoading(true);
    }
    setListError('');
    try {
      const rows = await api.get('/api/messages');
      const next = Array.isArray(rows) ? rows : [];
      setInbox(next);
      setVendorMessageUnread(next.reduce((sum, row) => sum + (Number(row.unreadCount) || 0), 0));
    } catch (error) {
      setListError(error?.message || 'Unable to load vendor messages.');
    } finally {
      setListLoading(false);
    }
  };

  const inboxReadyRef = useRef(false);

  useEffect(() => {
    const silent = inboxReadyRef.current;
    void loadInbox({ silent }).then(() => {
      inboxReadyRef.current = true;
    });
  }, [vendorMessageRevision]);

  useEffect(() => {
    if (!vendorMessageFocus) {
      return;
    }
    setSelectedId(vendorMessageFocus);
    setThreadOpen(true);
    setVendorMessageFocus(null);
  }, [vendorMessageFocus, setVendorMessageFocus]);

  const selected = inbox.find((row) => row.supplierId === selectedId);
  const query = (searchQuery || '').toLowerCase();
  const visible = inbox.filter((row) => {
    const matchesFilter = filter === 'ALL' || Number(row.unreadCount) > 0;
    const matchesSearch = !query
      || String(row.companyName || '').toLowerCase().includes(query)
      || String(row.lastBody || '').toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="vendor-messages-page">
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">VENDOR MESSAGES</span>
          <div>
            <h2 className="subsystem-heading">Vendor Conversations</h2>
            <p className="subsystem-subtext">One shared thread per vendor company. Replies go to every user on that account.</p>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-bold uppercase">Filter:</span>
          {['ALL', 'UNREAD'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`btn btn-sm ${filter === option ? 'btn-primary' : 'btn-outline'}`}
            >
              {option === 'ALL' ? 'All' : 'Unread'}
            </button>
          ))}
        </div>
      </div>

      <div className={`vendor-inbox${threadOpen && selectedId ? ' is-thread-open' : ''}`}>
        <div className="panel-card vendor-inbox-list">
          <div className="panel-header">
            <span className="panel-title">
              <MessageSquare className="w-5 h-5 text-blue-400" /> Vendors ({visible.length})
            </span>
          </div>
          {listLoading ? (
            <div className="empty-state"><p>Loading conversations...</p></div>
          ) : listError ? (
            <div className="empty-state">
              <p>{listError}</p>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => loadInbox()}>Retry</button>
            </div>
          ) : visible.length === 0 ? (
            <div className="empty-state">
              <p>{filter === 'UNREAD' ? 'No unread vendor messages.' : 'No vendor conversations yet.'}</p>
            </div>
          ) : (
            <ul className="vendor-inbox-rows">
              {visible.map((row) => (
                <li key={row.supplierId}>
                  <button
                    type="button"
                    className={`vendor-inbox-row${selectedId === row.supplierId ? ' is-active' : ''}`}
                    onClick={() => {
                      setSelectedId(row.supplierId);
                      setThreadOpen(true);
                    }}
                  >
                    <span className="vendor-inbox-row-top">
                      <strong>{row.companyName}</strong>
                      <span>{formatMessageTime(row.lastAt)}</span>
                    </span>
                    <span className="vendor-inbox-preview">{row.lastBody}</span>
                    {Number(row.unreadCount) > 0 ? (
                      <span className="badge badge-info">{row.unreadCount}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="vendor-inbox-thread">
          {selectedId ? (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm vendor-inbox-back"
                onClick={() => setThreadOpen(false)}
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <VendorThread
                title={selected?.companyName || selectedId}
                supplierId={selectedId}
                revision={vendorMessageRevision}
                emptyTitle="No messages yet"
                emptyDescription="Send the first message to this vendor."
                onUnreadChange={() => void loadInbox({ silent: true })}
              />
            </>
          ) : (
            <div className="panel-card">
              <div className="empty-state">
                <MessageSquare className="w-10 h-10" />
                <p>Select a vendor to open the conversation.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
