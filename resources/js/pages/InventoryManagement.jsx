import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Package, Plus, Edit3, Eye, Filter, ArrowUpDown, ShoppingCart, ShieldAlert, Trash2, Send, MapPin } from 'lucide-react';
import { Modal, displayValue } from '../components/ui/Modal';
import { ItemThumb } from '../components/ui/ItemThumb';

export const InventoryManagement = () => {
  const {
    inventory,
    setActiveModal,
    setModalData,
    searchQuery,
    removeInventoryItem,
    actionLoading,
  } = useApp();

  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [stockPoolFilter, setStockPoolFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('itemCode');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);

  let items = inventory.filter(item => {
    const matchesSearch =
      item.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesPool = stockPoolFilter === 'ALL'
      || (stockPoolFilter === 'QUARANTINE' && Number(item.damagedQuantity || 0) > 0);

    return matchesSearch && matchesCategory && matchesStatus && matchesPool;
  });

  const openAdjust = (item, type) => {
    setSelectedItemDetails(null);
    setModalData({ item, type });
    setActiveModal('adjust_stock');
  };

  items.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="inventory-management-page">
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

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold uppercase">Pool:</span>
            <select
              className="form-select text-xs p-1"
              value={stockPoolFilter}
              onChange={(e) => setStockPoolFilter(e.target.value)}
            >
              <option value="ALL">All stock</option>
              <option value="QUARANTINE">Quarantine only</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold uppercase">Sort:</span>
            <select
              className="form-select text-xs p-1"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="itemCode">Item code</option>
              <option value="description">Item name</option>
              <option value="quantity">Quantity</option>
              <option value="status">Status</option>
            </select>
            <button
              type="button"
              className="btn btn-outline btn-sm p-1"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
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

      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <Package className="w-5 h-5 text-blue-400" /> Inventory Catalog ({items.length} Items)
          </span>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">
            <p>No inventory items match the current filters.</p>
          </div>
        ) : (
          <div className="inventory-catalog-grid">
            {items.map(item => (
              <article key={item.id} className="inventory-item-card">
                <div className="inventory-item-photo-wrap">
                  <ItemThumb src={item.imageUrl} alt={item.description} size="card" />
                  <span className={`badge badge-${item.status.toLowerCase().replace(/ /g, '-')}`}>
                    {item.status}
                  </span>
                </div>

                <div className="inventory-item-body">
                  <div className="modal-kicker">{item.itemCode}</div>
                  <h3 className="inventory-item-name">{item.description}</h3>
                  <div className="inventory-item-meta">{item.category} · SN: {item.serialNumber}</div>

                  <div className="inventory-item-facts">
                    <div>
                      <span>Qty</span>
                      <strong className={item.quantity === 0 ? 'is-out' : item.quantity <= item.minStockLevel ? 'is-low' : 'is-ok'}>
                        {item.quantity}
                      </strong>
                    </div>
                    <div>
                      <span>Min</span>
                      <strong>{item.minStockLevel}</strong>
                    </div>
                    <div>
                      <span>Cost</span>
                      <strong>₱{Number(item.cost).toLocaleString()}</strong>
                    </div>
                  </div>
                  <div className="inventory-item-location">
                    <MapPin className="w-3 h-3" />
                    <span>{item.location}</span>
                  </div>
                  {Number(item.damagedQuantity || 0) > 0 && (
                    <div className="inventory-item-quarantine">
                      <ShieldAlert className="w-3 h-3" />
                      {item.damagedQuantity} in quarantine
                    </div>
                  )}

                  <div className="inventory-item-footer">
                    <div className="inventory-item-actions">
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
                      <button
                        onClick={() => {
                          setModalData(item);
                          setActiveModal('manual_restock');
                        }}
                        className="btn btn-outline btn-sm p-1"
                        title="Manual Restock"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingRemove(item)}
                        className="btn btn-outline btn-sm p-1"
                        title="Remove item from catalog"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="inventory-item-stock-actions">
                      <button
                        type="button"
                        onClick={() => openAdjust(item, 'Damaged')}
                        className="btn btn-sm stock-btn-damaged"
                        title="Report Damaged"
                        disabled={item.quantity < 1}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> Damaged
                      </button>
                      <button
                        type="button"
                        onClick={() => openAdjust(item, 'Disposed')}
                        className="btn btn-sm stock-btn-dispose"
                        title="Dispose / Write Off"
                        disabled={item.quantity < 1 && Number(item.damagedQuantity || 0) < 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Dispose
                      </button>
                      <button
                        type="button"
                        onClick={() => openAdjust(item, 'ManualRelease')}
                        className="btn btn-sm stock-btn-release"
                        title="Manual Release"
                        disabled={item.quantity < 1}
                      >
                        <Send className="w-3.5 h-3.5" /> Release
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {pendingRemove && (
        <Modal
          onClose={() => setPendingRemove(null)}
          icon={Trash2}
          tone="rose"
          size="sm"
          title="Remove inventory item"
          subtitle={`${pendingRemove.itemCode} will disappear from the catalog.`}
          footer={(
            <>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPendingRemove(null)}>
                Keep item
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={actionLoading}
                onClick={async () => {
                  try {
                    await removeInventoryItem(pendingRemove.id);
                    setPendingRemove(null);
                    if (selectedItemDetails?.id === pendingRemove.id) {
                      setSelectedItemDetails(null);
                    }
                  } catch {
                    // actionError banner
                  }
                }}
              >
                Remove item
              </button>
            </>
          )}
        >
          <p className="text-sm">This removes {pendingRemove.description} from the inventory item list, including items that still have stock.</p>
        </Modal>
      )}

      {selectedItemDetails && (
        <Modal
          onClose={() => setSelectedItemDetails(null)}
          icon={Package}
          tone="blue"
          size="md"
          title="Item Specification Profile"
          subtitle="Current stock, costing, and warehouse placement for this SKU."
          footer={(
            <div className="item-profile-footer">
              <button onClick={() => setSelectedItemDetails(null)} className="btn btn-outline btn-sm">Close</button>
              <div className="item-profile-stock-actions">
                <button type="button" className="btn btn-sm stock-btn-damaged" onClick={() => openAdjust(selectedItemDetails, 'Damaged')} disabled={selectedItemDetails.quantity < 1}>
                  <ShieldAlert className="w-3.5 h-3.5" /> Damaged
                </button>
                <button type="button" className="btn btn-sm stock-btn-dispose" onClick={() => openAdjust(selectedItemDetails, 'Disposed')} disabled={selectedItemDetails.quantity < 1 && Number(selectedItemDetails.damagedQuantity || 0) < 1}>
                  <Trash2 className="w-3.5 h-3.5" /> Dispose
                </button>
                <button type="button" className="btn btn-sm stock-btn-release" onClick={() => openAdjust(selectedItemDetails, 'ManualRelease')} disabled={selectedItemDetails.quantity < 1}>
                  <Send className="w-3.5 h-3.5" /> Release
                </button>
              </div>
            </div>
          )}
        >
          <div className="modal-hero">
            <ItemThumb src={selectedItemDetails.imageUrl} alt={selectedItemDetails.description} size="md" />
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
              <span className="modal-stat-label">Quarantine</span>
              <span className="modal-stat-value is-amber">{selectedItemDetails.damagedQuantity || 0}</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-label">Min threshold</span>
              <span className="modal-stat-value is-amber">{selectedItemDetails.minStockLevel}</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-label">Unit cost</span>
              <span className="modal-stat-value is-emerald">₱{Number(selectedItemDetails.cost || 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="modal-panel">
            <div className="modal-dl">
              <div className="modal-dl-row"><span>Primary supplier</span><strong>{displayValue(selectedItemDetails.supplier)}</strong></div>
              <div className="modal-dl-row"><span>Warehouse location</span><strong>{displayValue(selectedItemDetails.location)}</strong></div>
              <div className="modal-dl-row"><span>Serial number</span><strong>{displayValue(selectedItemDetails.serialNumber)}</strong></div>
              <div className="modal-dl-row"><span>Warranty terms</span><strong>{displayValue(selectedItemDetails.warranty)}</strong></div>
              <div className="modal-dl-row"><span>Warranty expiration</span><strong>{displayValue(selectedItemDetails.warrantyExpiresOn)}</strong></div>
              <div className="modal-dl-row"><span>Condition</span><strong>{displayValue(selectedItemDetails.condition)}</strong></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
