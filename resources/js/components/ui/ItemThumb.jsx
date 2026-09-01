import React, { useEffect, useState } from 'react';
import { Package, X } from 'lucide-react';

const IMAGE_CACHE_NAME = 'tripwise-item-images-v1';
const blobUrls = new Map();
const inflight = new Map();
const readyUrls = new Set();

function cacheApiAvailable() {
  return typeof caches !== 'undefined' && typeof caches.open === 'function';
}

async function readCachedResponse(src) {
  if (!cacheApiAvailable()) {
    return null;
  }

  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    return await cache.match(src);
  } catch {
    return null;
  }
}

async function storeCachedResponse(src, response) {
  if (!cacheApiAvailable() || !response?.ok) {
    return;
  }

  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    await cache.put(src, response.clone());
  } catch {
    // Private mode / quota — HTTP cache still helps after Cache-Control is set.
  }
}

async function blobUrlFromResponse(src, response) {
  const blob = await response.blob();
  if (!blob || blob.size === 0 || (blob.type && !blob.type.startsWith('image/'))) {
    return src;
  }

  const previous = blobUrls.get(src);
  if (previous && previous !== src) {
    URL.revokeObjectURL(previous);
  }

  const blobUrl = URL.createObjectURL(blob);
  blobUrls.set(src, blobUrl);
  return blobUrl;
}

export async function cachedItemImage(src) {
  if (!src) {
    return null;
  }

  if (blobUrls.has(src)) {
    return blobUrls.get(src);
  }

  if (inflight.has(src)) {
    return inflight.get(src);
  }

  const pending = (async () => {
    const cached = await readCachedResponse(src);
    if (cached?.ok) {
      return blobUrlFromResponse(src, cached);
    }

    const response = await fetch(src, {
      cache: 'force-cache',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      blobUrls.set(src, src);
      return src;
    }

    await storeCachedResponse(src, response);
    return blobUrlFromResponse(src, response);
  })()
    .catch(() => src)
    .finally(() => inflight.delete(src));

  inflight.set(src, pending);
  return pending;
}

export function prefetchItemImages(urls = []) {
  const unique = [...new Set(urls.filter(Boolean))];

  unique.forEach((url) => {
    if (blobUrls.has(url) || readyUrls.has(url)) {
      return;
    }
    const probe = new Image();
    probe.decoding = 'async';
    probe.src = url;
  });

  const warmCache = () => {
    unique.forEach((url) => {
      void cachedItemImage(url);
    });
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(warmCache, { timeout: 2500 });
  } else {
    window.setTimeout(warmCache, 400);
  }
}

export function itemImageUrl(record, inventory = []) {
  if (record?.imageUrl) {
    return record.imageUrl;
  }

  const code = record?.itemCode;
  if (!code) {
    return null;
  }

  return inventory.find((item) => item.itemCode === code)?.imageUrl || null;
}

export function ItemThumb({ src, alt = '', size = 'sm' }) {
  const remembered = src ? blobUrls.get(src) : null;
  const [open, setOpen] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState(remembered || src || null);
  const [loaded, setLoaded] = useState(() => Boolean(remembered) || readyUrls.has(src));

  useEffect(() => {
    if (!src) {
      setResolvedSrc(null);
      setLoaded(false);
      return undefined;
    }

    const cached = blobUrls.get(src);
    setResolvedSrc(cached || src);
    setLoaded(Boolean(cached) || readyUrls.has(src));
    return undefined;
  }, [src]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!src) {
    return (
      <span className={`item-thumb is-empty size-${size}`} aria-hidden="true">
        <Package className="w-4 h-4" />
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`item-thumb is-clickable size-${size}${loaded ? ' is-ready' : ' is-loading'}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        title="View photo"
      >
        {!loaded ? <Package className="w-4 h-4 item-thumb-fallback" /> : null}
        <img
          src={resolvedSrc || src}
          alt={alt}
          loading={size === 'card' ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={size === 'card' ? 'high' : 'auto'}
          onLoad={() => {
            readyUrls.add(src);
            setLoaded(true);
          }}
          onError={() => setLoaded(false)}
        />
      </button>
      {open ? (
        <div
          className="item-lightbox"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <button type="button" className="item-lightbox-close" onClick={() => setOpen(false)} aria-label="Close photo">
            <X className="w-5 h-5" />
          </button>
          <img src={resolvedSrc || src} alt={alt} />
        </div>
      ) : null}
    </>
  );
}

export function ItemIdentity({ src, name, extra, code }) {
  return (
    <div className="item-name-cell">
      <ItemThumb src={src} alt={name} />
      <div>
        <div className="font-bold text-xs text-black">{name}</div>
        {code ? <div className="font-mono text-xs text-secondary">{code}</div> : null}
        {extra ? <div className="font-mono text-xs text-secondary">{extra}</div> : null}
      </div>
    </div>
  );
}
