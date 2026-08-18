import React from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingCart, FileSpreadsheet, Send, Edit3 } from 'lucide-react';
import { ItemIdentity, itemImageUrl } from '../components/ui/ItemThumb';

export const Procurement = () => {
  const {
    procurementRequests,
    inventory,
    setActiveModal,
    setModalData,
    searchQuery,
    sendProcurementToVendors,
  } = useApp();

  const filteredPRs = procurementRequests.filter(pr => {
    if (pr.selectedSupplier || pr.poNumber) {
      return false;
    }

    return (
      pr.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.sourceRequest.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.itemName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

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

      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <ShoppingCart className="w-5 h-5 text-blue" /> Active Procurement Requests ({filteredPRs.length})
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Procurement ID</th>
                <th>Source Request</th>
                <th>Department</th>
                <th>Item & Code</th>
                <th className="text-center">Qty</th>
                <th>Estimated Cost</th>
                <th>Priority</th>
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
                    <td className="font-mono text-xs text-blue font-bold">{pr.id}</td>
                    <td className="font-mono text-xs text-black font-bold">{pr.sourceRequest}</td>
                    <td className="font-bold text-xs text-black">{pr.department}</td>
                    <td>
                      <ItemIdentity
                        src={itemImageUrl(pr, inventory)}
                        name={pr.itemName}
                        code={pr.itemCode}
                      />
                    </td>
                    <td className="text-center font-bold text-black text-sm">{pr.quantity}</td>
                    <td className="font-mono text-xs text-success font-bold">
                      ₱{Number(pr.estimatedCost).toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${pr.priority === 'URGENT' ? 'badge-urgent' : pr.priority === 'HIGH' ? 'badge-low-stock' : 'badge-info'}`}>
                        {pr.priority}
                      </span>
                    </td>
                    <td className="text-xs font-bold text-black">
                      {pr.selectedSupplier || 'TBD (Sourcing)'}
                    </td>
                    <td>
                      <span className={`badge badge-${pr.status.toLowerCase().replace(/ /g, '-')}`}>
                        {pr.status}
                      </span>
                    </td>
                    <td className="text-right">
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
