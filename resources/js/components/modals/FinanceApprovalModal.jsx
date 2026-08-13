import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DollarSign, CheckCircle, XCircle, RotateCcw, AlertCircle, FileText } from 'lucide-react';
import { Modal, displayValue } from '../ui/Modal';

export const FinanceApprovalModal = () => {
  const { activeModal, setActiveModal, modalData, updateFinanceApproval } = useApp();
  const [remarks, setRemarks] = useState('');

  if (activeModal !== 'finance_approval' || !modalData) return null;

  const po = modalData;

  const handleAction = (status) => {
    updateFinanceApproval(po.poNumber, status, remarks);
    setActiveModal(null);
  };

  return (
    <Modal
      onClose={() => setActiveModal(null)}
      icon={DollarSign}
      tone="amber"
      size="lg"
      title="Finance Approval Checkpoint"
      subtitle={`Review and decide on purchase order ${po.poNumber} before supplier dispatch.`}
      footer={(
        <>
          <button onClick={() => handleAction('Returned for Revision')} className="btn btn-warning btn-sm">
            <RotateCcw className="w-3.5 h-3.5" /> Return for Revision
          </button>
          <button onClick={() => handleAction('Finance Rejected')} className="btn btn-danger btn-sm">
            <XCircle className="w-3.5 h-3.5" /> Reject PO
          </button>
          <button onClick={() => handleAction('Finance Approved')} className="btn btn-success btn-sm">
            <CheckCircle className="w-3.5 h-3.5" /> Approve PO
          </button>
        </>
      )}
    >
      <div className="checkpoint-card">
        <div className="checkpoint-header">
          <AlertCircle className="w-4 h-4" />
          <span>External subsystem workflow</span>
        </div>
        <p className="text-xs leading-relaxed">
          Finance approval is required before this purchase order can be dispatched. Review the purchase details forwarded by Supply Chain.
        </p>
      </div>

      <div className="modal-stat-grid cols-4 mb-4">
        <div className="modal-stat">
          <span className="modal-stat-label">PO number</span>
          <span className="modal-stat-value is-sm">{po.poNumber}</span>
        </div>
        <div className="modal-stat">
          <span className="modal-stat-label">Supplier</span>
          <span className="modal-stat-value is-sm is-blue">{displayValue(po.supplier)}</span>
        </div>
        <div className="modal-stat">
          <span className="modal-stat-label">Budget ref</span>
          <span className="modal-stat-value is-sm">{displayValue(po.budgetReference)}</span>
        </div>
        <div className="modal-stat">
          <span className="modal-stat-label">Payment terms</span>
          <span className="modal-stat-value is-sm">{displayValue(po.paymentTerms)}</span>
        </div>
      </div>

      <div className="modal-section">
        <div className="modal-section-title"><FileText className="w-3.5 h-3.5" /> Purchase items</div>
        <div className="modal-table-wrap">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Description</th>
                <th className="text-center">Qty</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(po.items || []).length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="modal-empty"><p>No line items on this purchase order.</p></div>
                  </td>
                </tr>
              ) : po.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="font-mono text-xs font-bold">{item.itemCode}</td>
                  <td className="font-semibold text-xs">{item.description}</td>
                  <td className="text-center font-bold text-xs">{item.quantity}</td>
                  <td className="text-right font-mono text-xs">₱{Number(item.unitPrice).toLocaleString()}</td>
                  <td className="text-right font-bold font-mono text-xs">₱{Number(item.total).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="modal-total mb-4">
        <div>
          <span>Procurement reason</span>
          <p className="text-xs mt-1">{displayValue(po.procurementReason)}</p>
        </div>
        <strong>₱{Number(po.totalCost || 0).toLocaleString()}</strong>
      </div>

      <div className="form-group mb-0">
        <label className="form-label">Finance officer remarks</label>
        <textarea
          className="form-control text-xs"
          rows="2"
          placeholder="Enter approval or revision notes (e.g. Verified against budget line FLT-08)."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>
    </Modal>
  );
};
