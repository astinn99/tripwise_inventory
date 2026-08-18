import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Send, ShieldAlert, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';

const TYPE_META = {
  Damaged: {
    title: 'Report Damaged Item',
    subtitle: 'Move unusable units out of available stock and hold them in quarantine until they are disposed or returned.',
    icon: ShieldAlert,
    tone: 'amber',
    submit: 'Move to Quarantine',
  },
  Disposed: {
    title: 'Clear Quarantine / Write Off',
    subtitle: 'Remove quarantined units by disposing them or returning them to the vendor. Release is only for issuing good stock to a department.',
    icon: Trash2,
    tone: 'rose',
    submit: 'Remove from Stock',
  },
  ManualRelease: {
    title: 'Manual Stock Release',
    subtitle: 'Issue available stock without a department supply request. This deducts inventory and writes a release log.',
    icon: Send,
    tone: 'blue',
    submit: 'Release & Deduct Stock',
  },
};

const DEPARTMENTS = [
  'Fleet Operations',
  'Dispatch',
  'Administration',
  'Maintenance',
  'Finance',
];

export const AdjustInventoryModal = () => {
  const {
    activeModal,
    setActiveModal,
    modalData,
    inventory,
    supplyRequests,
    adjustInventoryItem,
    actionLoading,
  } = useApp();

  const presetType = modalData?.type || 'Damaged';
  const presetItem = modalData?.item || null;

  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [source, setSource] = useState('available');
  const [writeOffType, setWriteOffType] = useState('Disposed');
  const [releasedTo, setReleasedTo] = useState('');
  const [department, setDepartment] = useState('');

  const item = useMemo(
    () => inventory.find((entry) => entry.id === itemId) || presetItem,
    [inventory, itemId, presetItem]
  );

  const departments = useMemo(() => {
    const fromRequests = supplyRequests.map((req) => req.requestingDepartment).filter(Boolean);
    return [...new Set([...DEPARTMENTS, ...fromRequests])].sort();
  }, [supplyRequests]);

  useEffect(() => {
    if (activeModal !== 'adjust_stock') {
      return;
    }

    setItemId(presetItem?.id || '');
    setReason('');
    setReleasedTo('');
    setDepartment('');
    setWriteOffType('Disposed');
    setSource((presetItem?.damagedQuantity || 0) > 0 && presetType === 'Disposed' ? 'damaged' : 'available');
    setQuantity((presetItem?.damagedQuantity || 0) > 0 && presetType === 'Disposed' ? Number(presetItem.damagedQuantity) : 1);
  }, [activeModal, presetItem, presetType]);

  if (activeModal !== 'adjust_stock') {
    return null;
  }

  const meta = TYPE_META[presetType] || TYPE_META.Damaged;
  const Icon = meta.icon;
  const damagedQty = Number(item?.damagedQuantity || 0);
  const availableQty = Number(item?.quantity || 0);
  const effectiveType = presetType === 'Disposed' ? writeOffType : presetType;
  const usesStockPool = ['Disposed', 'Return'].includes(effectiveType);
  const effectiveSource = usesStockPool ? source : 'available';
  const maxQty = effectiveSource === 'damaged' ? damagedQty : availableQty;
  const submitLabel = effectiveSource === 'damaged'
    ? (effectiveType === 'Return' ? 'Return from Quarantine' : 'Dispose from Quarantine')
    : (meta.submit);
  const selectableItems = inventory.filter((entry) => {
    if (presetType === 'Disposed') {
      return Number(entry.quantity || 0) > 0 || Number(entry.damagedQuantity || 0) > 0;
    }
    return Number(entry.quantity || 0) > 0;
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!item || !maxQty) {
      return;
    }

    const qty = Number(quantity);
    if (!qty || qty < 1 || qty > maxQty) {
      return;
    }

    const payload = {
      type: effectiveType,
      quantity: qty,
      reason: reason.trim(),
    };

    if (usesStockPool) {
      payload.source = source;
    }

    if (effectiveType === 'ManualRelease') {
      payload.releasedTo = releasedTo.trim();
      payload.department = department.trim();
    }

    try {
      await adjustInventoryItem(item.id, payload);
      setActiveModal(null);
    } catch {
      // Action error is shown by AppContext.
    }
  };

  return (
    <Modal
      asForm
      onSubmit={handleSubmit}
      onClose={() => setActiveModal(null)}
      icon={Icon}
      tone={meta.tone}
      size="sm"
      title={meta.title}
      subtitle={meta.subtitle}
      footer={(
        <>
          <button type="button" onClick={() => setActiveModal(null)} className="btn btn-outline btn-sm">Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading || !item || maxQty < 1}>
            {submitLabel}
          </button>
        </>
      )}
    >
      {presetItem ? (
        <div className="modal-hero">
          <div className="modal-hero-main">
            <div className="modal-kicker">{item.itemCode}</div>
            <h4>{item.description || item.itemName}</h4>
            <div className="modal-hero-meta">
              Available: {availableQty} {item.unit || 'Units'}
              {damagedQty > 0 ? ` · Quarantine: ${damagedQty}` : ''}
              {item.status ? ` · ${item.status}` : ''}
            </div>
          </div>
        </div>
      ) : (
        <div className="form-group">
          <label className="form-label">Inventory item</label>
          <select
            className="form-select"
            required
            value={itemId}
            onChange={(event) => {
              setItemId(event.target.value);
              setQuantity(1);
            }}
          >
            <option value="">Select an item</option>
            {selectableItems.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.itemCode} — {entry.description} (avail. {entry.quantity}
                {Number(entry.damagedQuantity || 0) > 0 ? `, quarantine ${entry.damagedQuantity}` : ''})
              </option>
            ))}
          </select>
        </div>
      )}

      {presetType === 'Disposed' && (
        <>
          <div className="form-group">
            <label className="form-label">Write-off type</label>
            <select
              className="form-select"
              value={writeOffType}
              onChange={(event) => {
                const next = event.target.value;
                setWriteOffType(next);
                if (next === 'Lost') {
                  setSource('available');
                } else if (damagedQty > 0) {
                  setSource('damaged');
                  setQuantity(damagedQty);
                }
              }}
            >
              <option value="Disposed">Dispose (scrap / dump)</option>
              <option value="Return">Return to vendor</option>
              <option value="Lost">Lost (cannot locate)</option>
            </select>
          </div>
          {usesStockPool && (
            <div className="form-group">
              <label className="form-label">Take from</label>
              <select className="form-select" value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="damaged" disabled={damagedQty < 1}>Quarantine ({damagedQty})</option>
                <option value="available" disabled={availableQty < 1}>Available stock ({availableQty})</option>
              </select>
            </div>
          )}
        </>
      )}

      {presetType === 'ManualRelease' && (
        <>
          <div className="form-group">
            <label className="form-label">Released to</label>
            <input
              type="text"
              className="form-control"
              required
              value={releasedTo}
              onChange={(event) => setReleasedTo(event.target.value)}
              placeholder="Recipient name"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <input
              type="text"
              className="form-control"
              list="manual-release-departments"
              required
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="Requesting department"
            />
            <datalist id="manual-release-departments">
              {departments.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </>
      )}

      <div className="form-group">
        <label className="form-label">Quantity</label>
        <input
          type="number"
          min="1"
          max={Math.max(1, maxQty)}
          required
          className="form-control"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
        <p className="text-xs text-slate-400 mt-1">
          {item ? `${maxQty} unit(s) available in ${effectiveSource === 'damaged' ? 'quarantine' : 'available stock'}.` : 'Select an item first.'}
        </p>
      </div>

      <div className="form-group mb-0">
        <label className="form-label">Reason</label>
        <textarea
          className="form-control"
          rows="3"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={
            presetType === 'ManualRelease'
              ? 'E.g., Emergency issue for tonight dispatch, no supply request filed.'
              : effectiveType === 'Return'
                ? 'E.g., Defective unit returned to supplier under warranty.'
                : 'E.g., Beyond repair. Approved for scrap.'
          }
        />
      </div>
    </Modal>
  );
};
