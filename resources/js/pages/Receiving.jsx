import React from 'react';
import { useApp } from '../context/AppContext';
import { Truck } from 'lucide-react';

export const Receiving = () => {
  const { deliveries, searchQuery } = useApp();

  const filteredDeliveries = deliveries.filter(d =>
    d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.trackingNumber || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="receiving-page">
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">SMART WAREHOUSING SYSTEM (SWS)</span>
          <div>
            <h2 className="subsystem-heading">Warehouse Receiving Management</h2>
            <p className="subsystem-subtext">Monitors inbound deliveries from confirmed Purchase Orders and initiates physical quality inspection.</p>
          </div>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <Truck className="w-5 h-5 text-cyan-400" /> Inbound Deliveries Log ({filteredDeliveries.length} Deliveries)
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Delivery ID</th>
                <th>PO Number</th>
                <th>Supplier</th>
                <th>Delivery Date</th>
                <th className="text-center">Items Count</th>
                <th>Carrier & Tracking</th>
                <th>Status</th>
                <th>Inspection Result</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeliveries.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-xs text-secondary p-4">
                    No inbound deliveries yet. Confirmed purchase orders will appear here.
                  </td>
                </tr>
              )}
              {filteredDeliveries.map(del => (
                <tr key={del.id}>
                  <td className="font-mono text-xs text-blue-400 font-bold">{del.id}</td>
                  <td className="font-mono text-xs text-emerald-400 font-bold">{del.poNumber}</td>
                  <td className="font-bold text-xs text-white">{del.supplier}</td>
                  <td className="text-xs text-slate-300">{del.deliveryDate}</td>
                  <td className="text-center font-bold text-white">{del.itemsCount}</td>
                  <td className="text-xs text-slate-400">{del.carrier} ({del.trackingNumber})</td>
                  <td>
                    <span className={`badge badge-${del.status.toLowerCase().replace(/ /g, '-')}`}>
                      {del.status}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${String(del.inspectionResult || 'pending').toLowerCase().replace(/ /g, '-')}`}>
                      {del.inspectionResult || 'Pending'}
                    </span>
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
