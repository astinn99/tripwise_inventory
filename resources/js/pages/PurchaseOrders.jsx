import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FileCheck, DollarSign, X } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { normalizePriority, priorityBadgeClass, sortByPriority } from '../services/priority';

export const PurchaseOrders = () => {
  const {
    purchaseOrders,
    setActiveModal,
    setModalData,
    searchQuery,
    cancelProcurementRequest,
    actionLoading,
  } = useApp();
  const [pendingCancel, setPendingCancel] = useState(null);

  const query = searchQuery.toLowerCase();
  const filteredPOs = sortByPriority(purchaseOrders.filter((po) => {
    const haystack = [po.poNumber, po.supplier, po.budgetReference, po.poStatus, po.priority]
      .map((value) => String(value || '').toLowerCase());
    return haystack.some((value) => value.includes(query));
  }), 'confirmBy');

  return (
    <div className="purchase-orders-page">
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">FINANCE INTEGRATION CHECKPOINT</span>
          <div>
            <h2 className="subsystem-heading">Purchase Order Management</h2>
            <p className="subsystem-subtext">
              Review purchase orders and current status.
            </p>
          </div>
        </div>
      </div>

      <div className="panel-card mb-6">
        <div className="panel-header">
          <span className="panel-title">
            <FileCheck className="w-5 h-5 text-blue" /> Purchase Orders Master List ({filteredPOs.length} POs)
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Priority</th>
                <th>Supplier</th>
                <th>Items Ordered</th>
                <th>Total Cost</th>
                <th>Budget Ref</th>
                <th>Delivery Date</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.map(po => (
                <tr key={po.poNumber}>
                  <td className="font-mono text-xs text-blue font-bold">{po.poNumber}</td>
                  <td>
                    <span className={`badge ${priorityBadgeClass(po.priority)}`}>{normalizePriority(po.priority)}</span>
                  </td>
                  <td>
                    <div className="font-bold text-xs text-primary">{po.supplier}</div>
                    <div className="text-xs text-secondary">{po.contactPerson}</div>
                  </td>
                  <td>
                    {(po.items || []).map((item, idx) => (
                      <div key={idx} className="text-xs">
                        <span className="text-primary font-medium">{item.description}</span>
                        <span className="font-bold text-success ml-1 font-mono">
                          (x{item.quantity} | Del: {item.deliveredQty || 0})
                        </span>
                      </div>
                    ))}
                  </td>
                  <td className="font-mono text-xs text-success font-bold">
                    ₱{Number(po.totalCost).toLocaleString()}
                  </td>
                  <td className="font-mono text-xs text-blue font-bold">{po.budgetReference}</td>
                  <td className="text-xs text-secondary">{po.deliveryDate}</td>
                  <td>
                    <span className={`badge badge-${String(po.poStatus || '').toLowerCase().replace(/ /g, '-')}`}>
                      {po.poStatus}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      {(po.financeApprovalStatus === 'Pending Finance Approval' || po.poStatus === 'Pending Finance Approval') && (
                        <button
                          onClick={() => {
                            setModalData(po);
                            setActiveModal('finance_approval');
                          }}
                          className="btn btn-warning btn-sm"
                          title="Open Finance Approval Checkpoint"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> Finance Checkpoint
                        </button>
                      )}
                      {po.procurementId && po.poStatus !== 'Fully Delivered' && po.poStatus !== 'Cancelled' && (
                        <button
                          type="button"
                          onClick={() => setPendingCancel(po)}
                          className="btn btn-outline btn-sm"
                          title="Cancel this purchase order and its PR"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pendingCancel && (
        <Modal
          onClose={() => setPendingCancel(null)}
          icon={X}
          tone="rose"
          size="sm"
          title="Cancel purchase order"
          subtitle={`${pendingCancel.poNumber} and ${pendingCancel.procurementId} will close.`}
          footer={(
            <>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPendingCancel(null)}>
                Keep order
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={actionLoading}
                onClick={async () => {
                  try {
                    await cancelProcurementRequest(pendingCancel.procurementId);
                    setPendingCancel(null);
                  } catch {
                    // actionError banner
                  }
                }}
              >
                Cancel order
              </button>
            </>
          )}
        >
          <p className="text-sm">This cancels the procurement request and hides the RFQ from vendor portals.</p>
        </Modal>
      )}
    </div>
  );
};
