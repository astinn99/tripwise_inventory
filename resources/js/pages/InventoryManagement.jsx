import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Package, Plus, Edit3, Eye, Search, Filter, ArrowUpDown, Shield, AlertTriangle } from 'lucide-react';
import { Modal, displayValue } from '../components/ui/Modal';

export const InventoryManagement = () => {
  const {
    inventory,
    setActiveModal,
    setModalData,
    searchQuery
  } = useApp();

  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('itemCode');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);

  // Filter & Search logic
  let items = inventory.filter(item => {
    const matchesSearch =
      item.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Sorting logic
  items.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="inventory-management-page">
      {/* Header Actions */}
      <div className="filter-bar">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 font-bold uppercase">Category:</span>
            <select
              className="form-select text-xs p-1"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="Office Supplies">Office Supplies</option>
              <option value="Communication Devices">Communication Devices</option>
              <option value="Maintenance Tools">Maintenance Tools</option>
              <option value="Fleet Consumables">Fleet Consumables</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold uppercase">Stock Status:</span>
            <select
              className="form-select text-xs p-1"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="NORMAL">NORMAL</option>
              <option value="LOW STOCK">LOW STOCK</option>
              <option value="OUT OF STOCK">OUT OF STOCK</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => {
            setModalData(null);
            setActiveModal('add_item');
          }}
          className="btn btn-primary btn-sm"
        >
          <Plus className="w-4 h-4" /> Add Inventory Item
        </button>
      </div>

      {/* Main Inventory Items Table */}
      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <Package className="w-5 h-5 text-blue-400" /> Inventory Catalog ({items.length} Items)
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('itemCode')} style={{ cursor: 'pointer' }}>
                  Item Code <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th onClick={() => toggleSort('description')} style={{ cursor: 'pointer' }}>
                  Item Name <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th>Category</th>
                <th onClick={() => toggleSort('quantity')} className="text-center" style={{ cursor: 'pointer' }}>
                  Quantity <ArrowUpDown className="w-3 h-3 inline ml-1" />
                </th>
                <th className="text-center">Min Level</th>
                <th className="text-right">Unit Cost</th>
                <th>Supplier</th>
                <th>Location</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td className="font-mono text-xs text-blue-400 font-bold">{item.itemCode}</td>
                  <td>
                    <div className="font-bold text-xs text-white">{item.description}</div>
                    <div className="text-xs text-slate-400">SN: {item.serialNumber}</div>
                  </td>
                  <td className="text-xs text-slate-300">{item.category}</td>
                  <td className="text-center font-bold text-lg">
                    <span className={item.quantity === 0 ? 'text-rose-400' : item.quantity <= item.minStockLevel ? 'text-amber-400' : 'text-emerald-400'}>
                      {item.quantity} {item.unit}
                    </span>
                  </td>
                  <td className="text-center text-xs font-bold text-slate-400">{item.minStockLevel}</td>
                  <td className="text-right font-mono text-xs text-emerald-400">₱{Number(item.cost).toLocaleString()}</td>
                  <td className="text-xs text-slate-300">{item.supplier}</td>
                  <td className="text-xs font-mono text-slate-300">{item.location}</td>
                  <td>
                    <span className={`badge badge-${item.status.toLowerCase().replace(/ /g, '-')}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setSelectedItemDetails(item)}
                        className="btn btn-outline btn-sm p-1"
                        title="View Full Item Profile"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setModalData(item);
                          setActiveModal('edit_item');
                        }}
                        className="btn btn-outline btn-sm p-1"
                        title="Edit Item Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedItemDetails && (
        <Modal
          onClose={() => setSelectedItemDetails(null)}
          icon={Package}
          tone="blue"
          size="md"
          title="Item Specification Profile"
          subtitle="Current stock, costing, and warehouse placement for this SKU."
          footer={(
            <button onClick={() => setSelectedItemDetails(null)} className="btn btn-outline btn-sm">Close</button>
          )}
        >
          <div className="modal-hero">
            <div className="modal-hero-main">
              <div className="modal-kicker">{selectedItemDetails.itemCode}</div>
              <h4>{selectedItemDetails.description}</h4>
              <div className="modal-chip-row">
                <span className="badge badge-normal">{selectedItemDetails.category}</span>
              </div>
            </div>
            <span className={`badge badge-${String(selectedItemDetails.status || '').toLowerCase().replace(/ /g, '-')}`}>
              {selectedItemDetails.status}
            </span>
          </div>

          <div className="modal-stat-grid cols-4 mb-4">
            <div className="modal-stat">
              <span className="modal-stat-label">Current qty</span>
              <span className="modal-stat-value">{selectedItemDetails.quantity} <span className="is-sm">{selectedItemDetails.unit}</span></span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-label">Min threshold</span>
              <span className="modal-stat-value is-amber">{selectedItemDetails.minStockLevel}</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-label">Unit cost</span>
              <span className="modal-stat-value is-emerald">₱{Number(selectedItemDetails.cost || 0).toLocaleString()}</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-label">Condition</span>
              <span className="modal-stat-value is-sm">{displayValue(selectedItemDetails.condition)}</span>
            </div>
          </div>

          <div className="modal-panel">
            <div className="modal-dl">
              <div className="modal-dl-row"><span>Primary supplier</span><strong>{displayValue(selectedItemDetails.supplier)}</strong></div>
              <div className="modal-dl-row"><span>Warehouse location</span><strong>{displayValue(selectedItemDetails.location)}</strong></div>
              <div className="modal-dl-row"><span>Serial number</span><strong>{displayValue(selectedItemDetails.serialNumber)}</strong></div>
              <div className="modal-dl-row"><span>Warranty expiration</span><strong>{displayValue(selectedItemDetails.warranty)}</strong></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
