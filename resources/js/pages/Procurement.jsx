import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingCart, FileSpreadsheet, Send, Edit3, AlertTriangle, X } from 'lucide-react';
import { ItemIdentity, itemImageUrl } from '../components/ui/ItemThumb';
import { Modal } from '../components/ui/Modal';
import { normalizePriority, priorityBadgeClass, quoteWindowDays } from '../services/priority';
import { formatDisplayDate } from '../services/dates';

export const Procurement = () => {
  const {
    procurementRequests,
    inventory,
    setActiveModal,
    setModalData,
    searchQuery,
    sendProcurementToVendors,
    cancelProcurementRequest,
    actionLoading,
  } = useApp();
  const [pendingCancel, setPendingCancel] = useState(null);

  const filteredPRs = procurementRequests.filter(pr => {
    if (pr.status === 'Cancelled' || pr.selectedSupplier || pr.poNumber) {
      return false;
    }

    return (
      pr.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.sourceRequest.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.itemName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const overdueRfqs = filteredPRs.filter((pr) => pr.rfqOverdue);

  return (
    <div className="procurement-page">
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">PSM SUBSYSTEM</span>
          <div>
            <h2 className="subsystem-heading">Procurement & Sourcing Management (PSM)</h2>
            <p className="subsystem-subtext text-black font-semibold">
              Workflow: Insufficient Stock → Procurement Request → Supplier Sourcing → Quotation Comparison → Supplier Selection → PO Creation → Supplier Confirmation.
            </p>
          </div>
        </div>
      </div>

      {overdueRfqs.length > 0 ? (
        <div className="vendor-alert-banner is-urgent" style={{ margin: '0 0 1rem' }}>
          <AlertTriangle className="w-5 h-5" />
          <div>
            <strong>{overdueRfqs.length} RFQ{overdueRfqs.length === 1 ? '' : 's'} past quote deadline with no quotations</strong>
            <p>The request stays open so a late vendor quote can still be submitted. Follow up or compare quotes if any arrive.</p>
          </div>
        </div>
      ) : null}

      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <ShoppingCart className="w-5 h-5 text-blue" /> Active Procurement Requests ({filteredPRs.length})
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table table-stack">
            <thead>
              <tr>
                <th>Procurement ID</th>
                <th>Source Request</th>
                <th>Department</th>
                <th>Item & Code</th>
                <th className="text-center">Qty</th>
                <th>Estimated Cost</th>
                <th>Priority</th>
                <th>Need in</th>
                <th>Selected Supplier</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPRs.map(pr => {
                const canEdit = Boolean(pr.canEdit);

                return (
                  <tr key={pr.id}>
                    <td data-label="Procurement ID" className="font-mono text-xs text-blue font-bold">{pr.id}</td>
                    <td data-label="Source Request" className="font-mono text-xs text-black font-bold">{pr.sourceRequest}</td>
                    <td data-label="Department" className="font-bold text-xs text-black">{pr.department}</td>
                    <td data-label="Item & Code">
                      <ItemIdentity
                        src={itemImageUrl(pr, inventory)}
                        name={pr.itemName}
                        code={pr.itemCode}
                      />
                    </td>
                    <td data-label="Qty" className="text-center font-bold text-black text-sm">{pr.quantity}</td>
                    <td data-label="Estimated Cost" className="font-mono text-xs text-success font-bold">
                      ₱{Number(pr.estimatedCost).toLocaleString()}
                    </td>
                    <td data-label="Priority">
                      <span className={`badge ${priorityBadgeClass(pr.priority)}`}>
                        {normalizePriority(pr.priority)}
                      </span>
                    </td>
                    <td data-label="Need in" className="text-xs text-black">
                      {pr.neededInDays || quoteWindowDays(pr.priority)} day{(pr.neededInDays || quoteWindowDays(pr.priority)) === 1 ? '' : 's'}
                      <div className="text-secondary">Quote window {pr.quoteWindowDays || quoteWindowDays(pr.priority)}d</div>
                    </td>
                    <td data-label="Selected Supplier" className="text-xs font-bold text-black">
                      {pr.selectedSupplier || 'TBD (Sourcing)'}
                    </td>
                    <td data-label="Status">
                      <span className={`badge badge-${pr.status.toLowerCase().replace(/ /g, '-')}`}>
                        {pr.status}
                      </span>
                      {pr.rfqOverdue ? (
                        <div className="mt-1">
                          <span className="badge badge-urgent">No quotes · overdue {formatDisplayDate(pr.quoteDeadline)}</span>
                        </div>
                      ) : null}
                    </td>
                    <td data-label="Action" className="text-right table-stack-actions">
                      <div className="flex justify-end gap-1">
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setModalData(pr);
                                setActiveModal('edit_procurement');
                              }}
                              className="btn btn-outline btn-sm"
                              title="Edit this request before sending to vendors"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => sendProcurementToVendors(pr.id)}
                              className="btn btn-primary btn-sm"
                              title="Send this RFQ to vendor portals"
                            >
                              <Send className="w-3.5 h-3.5" /> Send to Vendor
                            </button>
                          </>
                        )}
                        {!canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalData(pr);
                              setActiveModal('compare_quotes');
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Compare Quotes
                          </button>
                        )}
                        {pr.canCancel !== false && (
                          <button
                            type="button"
                            onClick={() => setPendingCancel(pr)}
                            className="btn btn-outline btn-sm"
                            title="Cancel this procurement request"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
          title="Cancel procurement request"
          subtitle={`${pendingCancel.id} will close on both portals.`}
          footer={(
            <>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPendingCancel(null)}>
                Keep request
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={actionLoading}
                onClick={async () => {
                  try {
                    await cancelProcurementRequest(pendingCancel.id);
                    setPendingCancel(null);
                  } catch {
                    // actionError banner
                  }
                }}
              >
                Cancel request
              </button>
            </>
          )}
        >
          <p className="text-sm">Vendors will no longer see this RFQ. This cannot be used after the supply is fully delivered.</p>
        </Modal>
      )}
    </div>
  );
};
