import React, { useEffect, useState } from 'react';
import { Package, X } from 'lucide-react';

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
  const [open, setOpen] = useState(false);

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
        className={`item-thumb is-clickable size-${size}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        title="View photo"
      >
        <img src={src} alt={alt} />
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
          <img src={src} alt={alt} />
        </div>
      ) : null}
    </>
  );
}

export function ItemIdentity({ src, name, code, extra }) {
  return (
    <div className="item-name-cell">
      <ItemThumb src={src} alt={name} />
      <div>
        <div className="font-bold text-xs text-black">{name}</div>
        {code || extra ? (
          <div className="font-mono text-xs text-secondary">
            {code}
            {extra ? ` ${extra}` : ''}
          </div>
        ) : null}
      </div>
    </div>
  );
}
