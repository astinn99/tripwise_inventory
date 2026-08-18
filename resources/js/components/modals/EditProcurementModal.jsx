import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Edit3 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ItemThumb } from '../ui/ItemThumb';

export const EditProcurementModal = () => {
  const {
    activeModal,
    setActiveModal,
    modalData,
    updateProcurementRequest,
    actionLoading,
  } = useApp();

  const [quantity, setQuantity] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (activeModal !== 'edit_procurement' || !modalData) {
      return;
    }

    setQuantity(modalData.quantity ?? '');
    setPriority(modalData.priority || 'NORMAL');
    setReason(modalData.reason || '');
  }, [activeModal, modalData]);

  if (activeModal !== 'edit_procurement' || !modalData) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty < 1) {
      return;
    }

    updateProcurementRequest(modalData.id, {
      quantity: qty,
      priority,
      reason: reason.trim(),
    });
    setActiveModal(null);
  };

  return (
    <Modal
      asForm
      onSubmit={handleSubmit}
      onClose={() => setActiveModal(null)}
      icon={Edit3}
      tone="blue"
      size="sm"
      title="Edit Procurement Request"
      subtitle="You can edit this request until it is sent to vendors."
      footer={(
        <>
          <button type="button" onClick={() => setActiveModal(null)} className="btn btn-outline btn-sm">Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading}>
            Save Changes
          </button>
        </>
      )}
    >
      <div className="modal-hero">
        <ItemThumb src={modalData.imageUrl} alt={modalData.itemName} size="md" />
        <div className="modal-hero-main">
          <div className="modal-kicker">{modalData.id}</div>
          <h4>{modalData.itemName}</h4>
          <div className="modal-hero-meta">{modalData.itemCode} · {modalData.department}</div>
        </div>
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
        />
      </div>
    </Modal>
  );
};
