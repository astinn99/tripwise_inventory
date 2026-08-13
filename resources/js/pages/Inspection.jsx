import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, ShieldCheck, Truck } from 'lucide-react';

export const Inspection = () => {
  const { deliveries, setActiveModal, setModalData } = useApp();

  return (
    <div className="inspection-page">
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">SMART WAREHOUSING SYSTEM (SWS)</span>
          <div>
            <h2 className="subsystem-heading">Quality Inspection Checklists</h2>
            <p className="subsystem-subtext">Verifies incoming goods against Purchase Orders and Delivery Receipts before updating inventory.</p>
          </div>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Active & Past Quality Inspections
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Delivery ID</th>
                <th>PO Number</th>
                <th>Supplier</th>
                <th>Items Verified</th>
                <th>Inspection Result</th>
                <th>Notes / Remarks</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-xs text-secondary p-4">
                    No deliveries ready for inspection. Confirmed purchase orders will appear here.
                  </td>
                </tr>
              )}
              {deliveries.map(del => (
                <tr key={del.id}>
                  <td className="font-mono text-xs text-blue-400 font-bold">{del.id}</td>
                  <td className="font-mono text-xs text-emerald-400">{del.poNumber}</td>
                  <td className="font-bold text-xs text-white">{del.supplier}</td>
                  <td>
                    {(del.itemsDelivered || []).length === 0 && (
                      <div className="text-xs text-slate-400">Awaiting item details</div>
                    )}
                    {(del.itemsDelivered || []).map((i, idx) => (
                      <div key={idx} className="text-xs">
                        <strong className="text-white">{i.description}</strong>: Delivered {i.deliveredQuantity}/{i.poQuantity} ({i.condition})
                      </div>
                    ))}
                  </td>
                  <td>
                    <span className={`badge badge-${del.inspectionResult.toLowerCase().replace(/ /g, '-')}`}>
                      {del.inspectionResult}
                    </span>
                  </td>
                  <td className="text-xs text-slate-300 max-w-xs">{del.inspectionNotes}</td>
                  <td className="text-right">
                    {del.inspectionResult === 'Passed' || del.status === 'Accepted' ? (
                      <button type="button" disabled className="btn btn-outline btn-sm" title="Inventory already updated from this inspection">
                        INVENTORY UPDATED
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setModalData(del);
                          setActiveModal('receive_delivery');
                        }}
                        className="btn btn-outline btn-sm"
                      >
                        Inspect / Update
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
