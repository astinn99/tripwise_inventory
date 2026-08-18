import React from 'react';
import { useApp } from '../../context/AppContext';
import { PackageCheck, AlertTriangle, CheckCircle2, ShoppingBag, MapPin } from 'lucide-react';
import { Modal, displayValue } from '../ui/Modal';
import { ItemThumb, itemImageUrl } from '../ui/ItemThumb';

export const CheckStockModal = () => {
  const { activeModal, setActiveModal, modalData, inventory, processSupplyRequestStock } = useApp();

  if (activeModal !== 'check_stock' || !modalData) return null;

  const req = modalData;
  const invItem = inventory.find(i => i.itemCode === req.itemCode);

  const currentStock = invItem ? invItem.quantity : 0;
  const minStock = invItem ? invItem.minStockLevel : 0;
  const requestedQty = req.quantityRequested;
  const isAvailable = currentStock >= requestedQty;

  const handleProcess = () => {
    processSupplyRequestStock(req.id);
    setActiveModal(null);
  };

  return (
    <Modal
      onClose={() => setActiveModal(null)}
      icon={PackageCheck}
      tone={isAvailable ? 'emerald' : 'amber'}
      size="md"
      title={`Stock Verification — ${req.id}`}
      subtitle="Compare requested quantity against live warehouse availability."
      footer={(
        <>
          <button onClick={() => setActiveModal(null)} className="btn btn-outline btn-sm">Cancel</button>
          <button onClick={handleProcess} className={`btn ${isAvailable ? 'btn-success' : 'btn-warning'} btn-sm`}>
            {isAvailable ? (
              <><CheckCircle2 className="w-4 h-4" /> Reserve Stock & Approve</>
            ) : (
              <><ShoppingBag className="w-4 h-4" /> Trigger Procurement Request</>
            )}
          </button>
        </>
      )}
    >
      <div className="modal-hero">
        <ItemThumb src={itemImageUrl(req, inventory)} alt={req.itemName} size="md" />
        <div className="modal-hero-main">
          <div className="modal-kicker">{req.requestingDepartment}</div>
          <h4>{req.itemName}</h4>
          <div className="modal-hero-meta">Code: {req.itemCode}</div>
          <div className="modal-chip-row">
            <span className="modal-chip">Priority: {req.priority}</span>
            <span className="modal-chip">Required: {displayValue(req.requiredDate)}</span>
          </div>
        </div>
      </div>

      <div className="modal-stat-grid cols-4 mb-4">
        <div className="modal-stat">
          <span className="modal-stat-label">Requested</span>
          <span className="modal-stat-value">{requestedQty}</span>
        </div>
        <div className="modal-stat">
          <span className="modal-stat-label">Current stock</span>
          <span className={`modal-stat-value ${isAvailable ? 'is-emerald' : 'is-rose'}`}>{currentStock}</span>
        </div>
        <div className="modal-stat">
          <span className="modal-stat-label">Min threshold</span>
          <span className="modal-stat-value is-amber">{minStock}</span>
        </div>
        <div className="modal-stat">
          <span className="modal-stat-label">Location</span>
          <span className="modal-stat-value is-sm">
            <MapPin className="w-3.5 h-3.5" /> {invItem ? invItem.location : 'Unassigned'}
          </span>
        </div>
      </div>

      <div className={`modal-alert ${isAvailable ? 'is-success' : 'is-danger'} mb-0`}>
        {isAvailable ? <CheckCircle2 className="w-5 h-5 text-success" /> : <AlertTriangle className="w-5 h-5 text-danger" />}
        <div>
          <h4>{isAvailable ? 'Stock available for immediate release' : 'Insufficient stock in warehouse'}</h4>
          <p>
            {isAvailable
              ? `Current stock (${currentStock}) satisfies the requested ${requestedQty} units. Proceeding will reserve items for release.`
              : `Current stock (${currentStock}) is less than requested (${requestedQty}). Proceeding will trigger a procurement request.`}
          </p>
        </div>
      </div>
    </Modal>
  );
};
