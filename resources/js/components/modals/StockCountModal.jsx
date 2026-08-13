import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Calculator, CheckCircle2, ClipboardList } from 'lucide-react';
import { Modal, displayValue } from '../ui/Modal';

export const StockCountModal = () => {
  const { activeModal, setActiveModal, modalData, submitPhysicalCount } = useApp();
  const [auditItems, setAuditItems] = useState([]);

  useEffect(() => {
    if (modalData && modalData.items) {
      setAuditItems(modalData.items.map(item => ({
        ...item,
        actualQty: item.actualQty !== undefined ? item.actualQty : item.systemQty,
        notes: item.notes || ''
      })));
    }
  }, [modalData]);

  if (activeModal !== 'stock_count' || !modalData) return null;

  const count = modalData;

  const handleActualChange = (idx, val) => {
    const qty = Number(val);
    setAuditItems(prev => prev.map((item, i) => {
      if (i === idx) {
        const variance = qty - item.systemQty;
        return { ...item, actualQty: qty, variance };
      }
      return item;
    }));
  };

  const handleNotesChange = (idx, text) => {
    setAuditItems(prev => prev.map((item, i) => i === idx ? { ...item, notes: text } : item));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitPhysicalCount(count.id, auditItems);
    setActiveModal(null);
  };

  const varianceClass = (variance) => {
    if (variance === 0) return 'modal-variance is-zero';
    if (variance > 0) return 'modal-variance is-plus';
    return 'modal-variance is-minus';
  };

  return (
    <Modal
      asForm
      onSubmit={handleSubmit}
      onClose={() => setActiveModal(null)}
      icon={Calculator}
      tone="amber"
      size="xl"
      title={`Physical Stock Audit — ${count.id}`}
      subtitle="Count actual warehouse quantities and record any variance against system stock."
      footer={(
        <>
          <button type="button" onClick={() => setActiveModal(null)} className="btn btn-outline btn-sm">Cancel</button>
          <button type="submit" className="btn btn-warning btn-sm">
            <CheckCircle2 className="w-4 h-4" /> Calculate Variance & Complete Audit
          </button>
        </>
      )}
    >
      <div className="modal-hero">
        <div className="modal-hero-main">
          <h4>{displayValue(count.title, 'Physical inventory audit')}</h4>
          <div className="modal-chip-row">
            <span className="modal-chip">Location: {displayValue(count.location)}</span>
            <span className="modal-chip">Audit date: {displayValue(count.date)}</span>
            <span className="modal-chip">{auditItems.length} line{auditItems.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="modal-hero-aside">
          <span className="badge badge-pending">Physical Audit Mode</span>
        </div>
      </div>

      <div className="modal-table-wrap">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Item Name</th>
              <th className="text-center">System Qty</th>
              <th className="text-center" style={{ width: '110px' }}>Actual Qty</th>
              <th className="text-center">Variance</th>
              <th>Auditor Notes</th>
            </tr>
          </thead>
          <tbody>
            {auditItems.length === 0 ? (
              <tr>
                <td colSpan="6">
                  <div className="modal-empty">
                    <ClipboardList className="w-5 h-5" />
                    <p>No items assigned to this audit yet.</p>
                  </div>
                </td>
              </tr>
            ) : auditItems.map((item, idx) => {
              const variance = Number(item.actualQty) - Number(item.systemQty);
              return (
                <tr key={idx}>
                  <td className="font-mono text-xs font-bold">{item.itemCode}</td>
                  <td className="font-bold text-xs">{item.itemName}</td>
                  <td className="text-center font-bold text-xs">{item.systemQty}</td>
                  <td className="text-center">
                    <input
                      type="number"
                      min="0"
                      className="form-control text-center p-1 font-bold text-xs"
                      value={item.actualQty}
                      onChange={(e) => handleActualChange(idx, e.target.value)}
                    />
                  </td>
                  <td className="text-center">
                    <span className={varianceClass(variance)}>
                      {variance > 0 ? `+${variance}` : variance}
                    </span>
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-control text-xs p-1"
                      placeholder="Discrepancy remarks..."
                      value={item.notes}
                      onChange={(e) => handleNotesChange(idx, e.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};
