import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { api } from '../../services/api';
import { formatDisplayDate } from '../../services/dates';

const threadCache = new Map();

export const clearVendorThreadCache = () => {
  threadCache.clear();
};

const cachedThread = (key) => threadCache.get(key) || { messages: [], unreadCount: 0 };

const formatMessageTime = (value) => {
  if (!value) {
    return '';
  }
  const [date, time] = String(value).split(' ');
  const pretty = formatDisplayDate(date) || date;
  return time ? `${pretty} ${time}` : pretty;
};

export const VendorThread = ({
  title,
  supplierId = '',
  isVendor = false,
  revision = 0,
  emptyTitle = 'No messages yet',
  emptyDescription = 'Ask the supply chain team a question.',
  onUnreadChange,
}) => {
  const canLoad = isVendor || Boolean(supplierId);
  const threadKey = isVendor ? 'vendor' : supplierId;
  const remembered = threadCache.has(threadKey) ? cachedThread(threadKey) : null;

  const [messages, setMessages] = useState(() => remembered?.messages || []);
  const [unreadCount, setUnreadCount] = useState(() => remembered?.unreadCount || 0);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(() => !remembered);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const fieldRef = useRef(null);
  const loadedThreadRef = useRef(remembered ? threadKey : '');

  const applyThread = (data) => {
    const nextMessages = Array.isArray(data?.messages) ? data.messages : [];
    const nextUnread = Number(data?.unreadCount) || 0;
    threadCache.set(threadKey, { messages: nextMessages, unreadCount: nextUnread });
    setMessages(nextMessages);
    setUnreadCount(nextUnread);
    onUnreadChange?.(nextUnread);
    return nextUnread;
  };

  const loadThread = async ({ silent = false } = {}) => {
    if (!canLoad) {
      setLoading(false);
      setMessages([]);
      setUnreadCount(0);
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      const path = isVendor || !supplierId
        ? '/api/messages'
        : `/api/messages?supplier=${encodeURIComponent(supplierId)}`;
      const data = await api.get(path);
      const nextUnread = applyThread(data);
      if (nextUnread > 0) {
        await api.post('/api/messages/read', isVendor ? {} : { supplier: supplierId });
        applyThread({ ...data, unreadCount: 0 });
      }
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const switching = Boolean(loadedThreadRef.current) && loadedThreadRef.current !== threadKey;
    setError('');

    if (!canLoad) {
      loadedThreadRef.current = '';
      setLoading(false);
      setMessages([]);
      setUnreadCount(0);
      return undefined;
    }

    if (switching) {
      const cached = threadCache.get(threadKey);
      if (cached) {
        setMessages(cached.messages);
        setUnreadCount(cached.unreadCount);
        setLoading(false);
      } else {
        setLoading(true);
        setMessages([]);
        setUnreadCount(0);
      }
    }

    loadedThreadRef.current = threadKey;

    const path = isVendor || !supplierId
      ? '/api/messages'
      : `/api/messages?supplier=${encodeURIComponent(supplierId)}`;

    api.get(path)
      .then(async (data) => {
        if (cancelled) {
          return;
        }
        const nextUnread = applyThread(data);
        if (nextUnread > 0) {
          await api.post('/api/messages/read', isVendor ? {} : { supplier: supplierId });
          if (!cancelled) {
            applyThread({ ...data, unreadCount: 0 });
          }
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError?.message || 'Unable to load messages.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canLoad, isVendor, supplierId, threadKey, revision]);

  useEffect(() => {
    const node = listRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages.length, loading]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending || !canLoad) {
      return;
    }

    setSending(true);
    setError('');
    try {
      const created = await api.post('/api/messages', isVendor ? { body } : { supplier: supplierId, body });
      setDraft('');
      setMessages((current) => [...current, created]);
    } catch (sendError) {
      setError(sendError?.message || 'Unable to send the message.');
    } finally {
      setSending(false);
      fieldRef.current?.focus();
    }
  };

  const onComposeKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      fieldRef.current?.blur();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div className="panel-card vendor-thread">
      <div className="panel-header">
        <span className="panel-title">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          {title}
        </span>
        {unreadCount > 0 ? (
          <span className="badge badge-info">{unreadCount} unread</span>
        ) : null}
      </div>

      <div className="vendor-thread-list" ref={listRef}>
        {loading && messages.length === 0 ? (
          <div className="empty-state">
            <p>Loading conversation...</p>
          </div>
        ) : error && messages.length === 0 ? (
          <div className="empty-state">
            <p>{error}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => loadThread()}>
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="vendor-placeholder">
            <MessageSquare className="w-10 h-10" />
            <h3>{emptyTitle}</h3>
            <p>{emptyDescription}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`vendor-msg${message.system ? ' is-system' : message.mine ? ' is-mine' : ' is-theirs'}`}
            >
              {!message.system ? (
                <div className="vendor-msg-meta">
                  <span>{message.mine ? 'You' : message.authorName}</span>
                  <span>{formatMessageTime(message.createdAt)}</span>
                </div>
              ) : (
                <div className="vendor-msg-meta">
                  <span>{message.authorName}</span>
                  <span>{formatMessageTime(message.createdAt)}</span>
                </div>
              )}
              <p>{message.body}</p>
            </div>
          ))
        )}
      </div>

      {error && messages.length > 0 ? (
        <div className="login-error action-banner vendor-thread-error">
          <p className="text-xs font-bold">{error}</p>
        </div>
      ) : null}

      <div className="vendor-thread-compose">
        <div className="form-group">
          <label className="form-label" htmlFor="vendor-thread-draft">Write a message</label>
          <textarea
            id="vendor-thread-draft"
            ref={fieldRef}
            className="form-control"
            rows={3}
            value={draft}
            disabled={!canLoad || sending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onComposeKeyDown}
            maxLength={2000}
            placeholder="Write a message"
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canLoad || sending || !draft.trim()}
          onClick={() => void send()}
        >
          <Send className="w-4 h-4" />
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};
