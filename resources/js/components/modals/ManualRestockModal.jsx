import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShoppingCart } from 'lucide-react';
import { Modal } from '../ui/Modal';

const suggestedQty = (item) => {
  if (!item) {
    return 10;
  }

  if (item.status === 'NORMAL') {
    return Number(item.minStockLevel) || 10;
  }

  return Math.max(1, Number(item.minStockLevel) - Number(item.quantity) || 10);
};

const suggestedPriority = (item) => {
  if (item?.status === 'OUT OF STOCK') {
    return 'URGENT';
  }
  if (item?.status === 'LOW STOCK') {
    return 'HIGH';
  }
  return 'NORMAL';
};

const suggestedReason = (item) => {
  if (item?.status === 'NORMAL') {
    return 'Proactive restock while stock is still above minimum.';
  }
  if (item?.status === 'OUT OF STOCK') {
    return 'Item is out of stock and needs immediate replenishment.';
  }
  return 'Stock is at or below the minimum safety level.';
};

export const ManualRestockModal = () => {
  const {
    activeModal,
    setActiveModal,
    modalData,
    createManualProcurementRequest,
    actionLoading,
  } = useApp();

  const [quantity, setQuantity] = useState(10);
  const [priority, setPriority] = useState('NORMAL');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (activeModal !== 'manual_restock' || !modalData) {
      return;
    }

    setQuantity(suggestedQty(modalData));
    setPriority(suggestedPriority(modalData));
    setReason(suggestedReason(modalData));
  }, [activeModal, modalData]);

  if (activeModal !== 'manual_restock' || !modalData) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty < 1) {
      return;
    }

    createManualProcurementRequest(
      modalData.itemCode,
      qty,
      reason.trim() || suggestedReason(modalData),
      priority
    );
    setActiveModal(null);
  };

  return (
    <Modal
      asForm
      onSubmit={handleSubmit}
      onClose={() => setActiveModal(null)}
      icon={ShoppingCart}
      tone="rose"
      size="sm"
      title="Manual Restock Request"
      subtitle="Create a procurement request for any SKU, including items that are still above the minimum."
      footer={(
        <>
          <button type="button" onClick={() => setActiveModal(null)} className="btn btn-outline btn-sm">Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading}>
            Submit Request
          </button>
        </>
      )}
    >
      <div className="modal-hero">
        <div className="modal-hero-main">
          <div className="modal-kicker">{modalData.itemCode}</div>
          <h4>{modalData.description || modalData.itemName}</h4>
          <div className="modal-hero-meta">
            Current stock: {modalData.quantity} {modalData.unit || 'Units'} · Min: {modalData.minStockLevel} · {modalData.status}
          </div>
        </div>
        <span className={`badge badge-${String(modalData.status || '').toLowerCase().replace(/ /g, '-')}`}>
          {modalData.status}
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">Quantity requested</label>
        <input
          type="number"
          min="1"
          required
          className="form-control"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Priority</label>
        <select className="form-select" value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="NORMAL">NORMAL</option>
          <option value="HIGH">HIGH</option>
          <option value="URGENT">URGENT</option>
        </select>
      </div>
      <div className="form-group mb-0">
        <label className="form-label">Reason / justification</label>
        <textarea
          className="form-control"
          rows="3"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="E.g., Build buffer for upcoming trips, even though stock is still normal."
        />
      </div>
    </Modal>
  );
};
