import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, Truck } from 'lucide-react';
import { Modal, displayValue } from '../ui/Modal';

export const ReceiveInspectionModal = () => {
  const { activeModal, setActiveModal, modalData, processDeliveryInspection } = useApp();
  const [items, setItems] = useState([]);
  const [overallResult, setOverallResult] = useState('Passed');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    const lines = modalData.itemsDelivered || modalData.itemsDelivered || [];
    if (modalData && lines.length) {
      setItems(lines.map(i => ({
        ...i,
        deliveredQuantity: (i.deliveredQuantity ?? i.deliveredQuantity) > 0
          ? (i.deliveredQuantity ?? i.deliveredQuantity)
          : (i.poQuantity ?? i.poQuantity),
        condition: i.condition === 'Pending' ? 'New' : i.condition,
        result: i.result === 'Pending' ? 'Passed' : i.result,
        remarks: i.remarks || ''
      })));
    }
  }, [modalData]);

  if (activeModal !== 'receive_delivery' || !modalData) return null;

  const del = modalData;

  const handleQtyChange = (idx, qty) => {
    const val = Number(qty);
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, deliveredQuantity: val } : item));
  };

  const handleConditionChange = (idx, condition) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, condition } : item));
  };

  const handleResultChange = (idx, result) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, result } : item));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    processDeliveryInspection(del.id, items, overallResult, remarks);
    setActiveModal(null);
  };

  return (
    <Modal
      asForm
      onSubmit={handleSubmit}
      onClose={() => setActiveModal(null)}
      icon={Truck}
      tone="emerald"
      size="xl"
      title={`Receiving & Inspection — ${del.id}`}
      subtitle="Check delivered quantities and condition against the purchase order."
      footer={(
        <>
          <button type="button" onClick={() => setActiveModal(null)} className="btn btn-outline btn-sm">Cancel</button>
          <button type="submit" className="btn btn-success btn-sm">
            <CheckCircle2 className="w-4 h-4" /> Save Inspection & Update Inventory
          </button>
        </>
      )}
    >
      <div className="modal-hero">
        <div className="modal-hero-main">
          <div className="modal-kicker">Purchase order {displayValue(del.poNumber)}</div>
          <h4>{displayValue(del.supplier)}</h4>
          <div className="modal-hero-meta">
            Carrier: {displayValue(del.carrier)} · Tracking #{displayValue(del.trackingNumber)}
          </div>
        </div>
        <div className="modal-hero-aside">
          <span className="modal-stat-label">Delivery date</span>
          <span className="modal-stat-value is-sm">{displayValue(del.deliveryDate)}</span>
          <div className="modal-chip-row" style={{ justifyContent: 'flex-end' }}>
            <span className="badge badge-under-inspection">SWS Inspection</span>
          </div>
        </div>
      </div>

      <div className="modal-section">
        <div className="modal-section-title">Items against PO & delivery receipt</div>
        <div className="modal-table-wrap">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Item Description</th>
                <th className="text-center">PO Qty</th>
                <th className="text-center" style={{ width: '110px' }}>Delivered Qty</th>
                <th>Condition</th>
                <th>Inspection Result</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="modal-empty"><p>No delivery lines to inspect.</p></div>
                  </td>
                </tr>
              ) : items.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <div className="font-bold text-xs">{item.description}</div>
                    <div className="font-mono text-xs">{item.itemCode}</div>
                  </td>
                  <td className="text-center font-bold">{item.poQuantity}</td>
                  <td className="text-center">
                    <input
                      type="number"
                      min="0"
                      className="form-control text-center p-1 font-bold"
                      value={item.deliveredQuantity}
                      onChange={(e) => handleQtyChange(idx, e.target.value)}
                    />
                  </td>
                  <td>
                    <select className="form-select text-xs p-1" value={item.condition} onChange={(e) => handleConditionChange(idx, e.target.value)}>
                      <option value="New">New / Sealed</option>
                      <option value="Good">Good Condition</option>
                      <option value="Fair">Fair Condition</option>
                      <option value="Damaged">Damaged / Defective</option>
                    </select>
                  </td>
                  <td>
                    <select className="form-select text-xs p-1 font-bold" value={item.result} onChange={(e) => handleResultChange(idx, e.target.value)}>
                      <option value="Passed">Passed</option>
                      <option value="Partial">Partial Acceptance</option>
                      <option value="Failed">Failed / Rejected</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="form-group mb-0">
          <label className="form-label">Overall inspection status</label>
          <select className="form-select" value={overallResult} onChange={(e) => setOverallResult(e.target.value)}>
            <option value="Passed">Passed (Accepted to Inventory)</option>
            <option value="Partial">Partial (Partially Accepted)</option>
            <option value="Failed">Failed (Rejected Delivery)</option>
          </select>
        </div>
        <div className="form-group mb-0">
          <label className="form-label">Inspector remarks</label>
          <input
            type="text"
            className="form-control"
            placeholder="Enter inspector notes (e.g. Package intact)."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
};
