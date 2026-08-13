import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ClipboardList, PackageCheck, Send, Filter } from 'lucide-react';

export const SupplyRequests = () => {
  const {
    supplyRequests,
    inventory,
    setActiveModal,
    setModalData,
    releaseSupplyRequest,
    searchQuery
  } = useApp();

  const [filterStatus, setFilterStatus] = useState('ALL');

  // Filter & Search logic
  const filteredRequests = supplyRequests.filter(req => {
    const matchesSearch =
      req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.requestingDepartment.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.itemCode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'ALL' || req.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="supply-requests-page">
      {/* 1. Page Header */}
      <div className="page-header">
        <div className="page-header-title-group">
          <div className="page-breadcrumb">Supply Chain <span className="page-breadcrumb-separator">/</span> Supply Requests</div>
          <h1 className="page-title">Approved Supply Requests Queue</h1>
          <p className="page-description">Receives approved requests forwarded from Department Subsystem to perform stock availability verification.</p>
        </div>
      </div>

      {/* 2. Control Bar: Filter Status Tabs */}
      <div className="filter-bar">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-secondary" />
          <span className="text-xs text-secondary font-bold uppercase tracking-wider">Filter Status:</span>
          <div className="flex gap-1.5 flex-wrap">
            {['ALL', 'Received', 'Stock Available', 'Insufficient Stock', 'For Procurement', 'Ready for Release', 'Released'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`btn btn-sm ${filterStatus === st ? 'btn-primary' : 'btn-outline'}`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-secondary font-medium">Showing {filteredRequests.length} of {supplyRequests.length} requests</span>
      </div>

      {/* 3. Requests Data Table */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">
            <ClipboardList className="w-4 h-4 text-blue" /> Supply Requests Inbox ({filteredRequests.length})
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Requesting Dept</th>
                <th>Item & Code</th>
                <th className="text-center">Qty</th>
                <th>Required Date</th>
                <th>Priority</th>
                <th>Stock Availability</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => {
                const invItem = inventory.find(i => i.itemCode === req.itemCode);
                const currentStock = invItem ? invItem.quantity : 0;
                const minStock = invItem ? invItem.minStockLevel : 0;

                return (
                  <tr key={req.id}>
                    <td className="font-mono text-xs text-blue font-bold">{req.id}</td>
                    <td className="font-bold text-xs text-primary">{req.requestingDepartment}</td>
                    <td>
                      <div className="font-bold text-xs text-primary">{req.itemName}</div>
                      <div className="font-mono text-xs text-secondary">
                        {req.itemCode} (Stock: {currentStock} | Min: {minStock})
                      </div>
                    </td>
                    <td className="text-center font-bold text-xs">{req.quantityRequested}</td>
                    <td className="text-xs text-secondary">{req.requiredDate}</td>
                    <td>
                      <span className={`badge ${req.priority === 'URGENT' ? 'badge-urgent' : req.priority === 'HIGH' ? 'badge-low-stock' : 'badge-info'}`}>
                        {req.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${req.stockAvailability.toLowerCase().replace(/ /g, '-')}`}>
                        {req.stockAvailability}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${req.status.toLowerCase().replace(/ /g, '-')}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {req.status === 'Received' && (
                          <button
                            onClick={() => {
                              setModalData(req);
                              setActiveModal('check_stock');
                            }}
                            className="btn btn-primary btn-sm"
                            title="Verify Stock Availability vs Min Stock"
                          >
                            <PackageCheck className="w-3.5 h-3.5" /> Check Stock
                          </button>
                        )}

                        {req.status === 'Ready for Release' && (
                          <button
                            onClick={() => releaseSupplyRequest(req.id, req.requestedBy)}
                            className="btn btn-success btn-sm"
                            title="Dispatch Stock & Update Inventory"
                          >
                            <Send className="w-3.5 h-3.5" /> Release Item
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
