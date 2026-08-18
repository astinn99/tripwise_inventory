import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ClipboardList, PackageCheck, Send, Filter } from 'lucide-react';
import { ItemIdentity, itemImageUrl } from '../components/ui/ItemThumb';

const normalizeSupplyStatus = (status) => {
  const value = String(status || '').trim();
  if (!value || value === 'Received') {
    return 'Pending';
  }
  return value;
};

export const SupplyRequests = () => {
  const {
    supplyRequests,
    inventory,
    setActiveModal,
    setModalData,
    releaseSupplyRequest,
    searchQuery
  } = useApp();

  const [filterStatus, setFilterStatus] = useState('Pending');
  const [filterDepartment, setFilterDepartment] = useState('ALL');

  const departments = [...new Set(supplyRequests.map(req => req.requestingDepartment).filter(Boolean))].sort();

  const filteredRequests = supplyRequests.filter(req => {
    const requestId = (req.id || '').toLowerCase();
    const department = (req.requestingDepartment || '').toLowerCase();
    const itemName = (req.itemName || '').toLowerCase();
    const itemCode = (req.itemCode || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const status = normalizeSupplyStatus(req.status);

    const matchesSearch =
      requestId.includes(query) ||
      department.includes(query) ||
      itemName.includes(query) ||
      itemCode.includes(query);

    const matchesStatus = filterStatus === 'ALL' || status === filterStatus;
    const matchesDepartment = filterDepartment === 'ALL' || req.requestingDepartment === filterDepartment;
    return matchesSearch && matchesStatus && matchesDepartment;
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
            {['ALL', 'Pending', 'Ready for Release', 'For Procurement', 'Released'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`btn btn-sm ${filterStatus === st ? 'btn-primary' : 'btn-outline'}`}
              >
                {st}
              </button>
            ))}
          </div>
          <span className="text-xs text-secondary font-bold uppercase tracking-wider ml-2">Department:</span>
          <select
            className="btn btn-sm btn-outline"
            value={filterDepartment}
            onChange={(event) => setFilterDepartment(event.target.value)}
          >
            <option value="ALL">All departments</option>
            {departments.map(department => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>
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
                <th className="table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => {
                const invItem = inventory.find(i => i.itemCode === req.itemCode);
                const currentStock = invItem ? invItem.quantity : 0;
                const minStock = invItem ? invItem.minStockLevel : 0;
                const stockAvailability = req.stockAvailability || 'Pending';
                const status = normalizeSupplyStatus(req.status);
                const priority = req.priority || 'MEDIUM';
                const canCheckStock = status === 'Pending';
                const canRelease = status === 'Ready for Release';

                return (
                  <tr key={req.id}>
                    <td className="font-mono text-xs text-blue font-bold">{req.id}</td>
                    <td className="font-bold text-xs text-primary">{req.requestingDepartment}</td>
                    <td>
                      <ItemIdentity
                        src={itemImageUrl(req, inventory)}
                        name={req.itemName}
                        code={req.itemCode}
                        extra={`(Stock: ${currentStock} | Min: ${minStock})`}
                      />
                    </td>
                    <td className="text-center font-bold text-xs">{req.quantityRequested}</td>
                    <td className="text-xs text-secondary">{req.requiredDate}</td>
                    <td>
                      <span className={`badge ${priority === 'URGENT' ? 'badge-urgent' : priority === 'HIGH' ? 'badge-low-stock' : 'badge-info'}`}>
                        {priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${stockAvailability.toLowerCase().replace(/ /g, '-')}`}>
                        {stockAvailability}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${status.toLowerCase().replace(/ /g, '-')}`}>
                        {status}
                      </span>
                    </td>
                    <td className="table-actions">
                      {canCheckStock && (
                        <button
                          type="button"
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

                      {canRelease && (
                        <button
                          type="button"
                          onClick={() => releaseSupplyRequest(req.id, req.requestedBy)}
                          className="btn btn-success btn-sm"
                          title="Dispatch Stock & Update Inventory"
                        >
                          <Send className="w-3.5 h-3.5" /> Release Item
                        </button>
                      )}
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
