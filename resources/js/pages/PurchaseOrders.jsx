import React from 'react';
import { useApp } from '../context/AppContext';
import { FileCheck, DollarSign } from 'lucide-react';

export const PurchaseOrders = () => {
  const {
    purchaseOrders,
    setActiveModal,
    setModalData,
    searchQuery
  } = useApp();

  const query = searchQuery.toLowerCase();
  const filteredPOs = purchaseOrders.filter((po) => {
    const haystack = [po.poNumber, po.supplier, po.budgetReference, po.poStatus]
      .map((value) => String(value || '').toLowerCase());
    return haystack.some((value) => value.includes(query));
  });

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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
