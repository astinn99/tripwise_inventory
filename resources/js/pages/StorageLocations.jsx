import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Archive, ArrowRightLeft, Boxes, Layers, Plus, Search } from 'lucide-react';

const EMPTY_BIN = {
  rack: 'Rack A',
  shelf: 'Shelf 01',
  bin: 'Bin 01',
  category: 'Office Supplies',
  maxCapacity: 50,
};

const matchesQuery = (value, query) => String(value || '').toLowerCase().includes(query);

export const StorageLocations = () => {
  const {
    storageLocations,
    inventory,
    searchQuery,
    actionLoading,
    createStorageLocation,
    bootstrapWarehouseLayout,
    moveInventoryItem,
  } = useApp();

  const [selectedRack, setSelectedRack] = useState('ALL');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [showAddBin, setShowAddBin] = useState(false);
  const [binForm, setBinForm] = useState(EMPTY_BIN);

  const query = searchQuery.toLowerCase();

  const unassignedItems = useMemo(() => (
    inventory.filter((item) => !item.storageLocationId && (
      !query
      || matchesQuery(item.itemCode, query)
      || matchesQuery(item.itemName || item.description, query)
      || matchesQuery(item.category, query)
    ))
  ), [inventory, query]);

  const filteredLocations = useMemo(() => (
    storageLocations.filter((loc) => {
      const items = loc.items || [];
      const matchesSearch = !query
        || matchesQuery(loc.rack, query)
        || matchesQuery(loc.shelf, query)
        || matchesQuery(loc.bin, query)
        || matchesQuery(loc.category, query)
        || matchesQuery(loc.label, query)
        || items.some((item) => matchesQuery(item.itemCode, query) || matchesQuery(item.itemName, query));

      const matchesRack = selectedRack === 'ALL' || loc.rack === selectedRack;
      return matchesSearch && matchesRack;
    })
  ), [storageLocations, query, selectedRack]);

  const racks = useMemo(() => {
    const unique = [...new Set(storageLocations.map((loc) => loc.rack).filter(Boolean))];
    return ['ALL', ...(unique.length ? unique : ['Rack A', 'Rack B', 'Rack C', 'Rack D'])];
  }, [storageLocations]);

  const groupedRacks = useMemo(() => {
    const racksMap = new Map();

    filteredLocations.forEach((loc) => {
      if (!racksMap.has(loc.rack)) {
        racksMap.set(loc.rack, new Map());
      }
      const shelves = racksMap.get(loc.rack);
      if (!shelves.has(loc.shelf)) {
        shelves.set(loc.shelf, []);
      }
      shelves.get(loc.shelf).push(loc);
    });

    return [...racksMap.entries()].map(([rack, shelves]) => ({
      rack,
      shelves: [...shelves.entries()].map(([shelf, bins]) => ({ shelf, bins })),
    }));
  }, [filteredLocations]);

  const selectedItem = inventory.find((item) => item.id === selectedItemId) || null;

  const handleMove = async (itemId, storageLocationId = null) => {
    if (!itemId) {
      return;
    }

    setSelectedItemId(null);
    await moveInventoryItem(itemId, storageLocationId);
  };

  const handleBinActivate = (locationId) => {
    if (selectedItemId) {
      handleMove(selectedItemId, locationId);
    }
  };

  const handleDrop = (event, locationId) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData('text/plain');
    if (itemId) {
      handleMove(itemId, locationId);
    }
  };

  const handleAddBin = async (event) => {
    event.preventDefault();
    await createStorageLocation({
      ...binForm,
      maxCapacity: Number(binForm.maxCapacity) || 0,
    });
    setBinForm(EMPTY_BIN);
    setShowAddBin(false);
  };

  return (
    <div className="storage-locations-page">
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">SMART WAREHOUSING SYSTEM (SWS)</span>
          <div>
            <h2 className="subsystem-heading">Warehouse Racks & Storage Location Hierarchy</h2>
            <p className="subsystem-subtext">
              Map Rack → Shelf → Bin coordinates, then click or drag items into a bin to relocate them.
            </p>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase">Select Rack Zone:</span>
          <div className="flex gap-1 flex-wrap">
            {racks.map((rack) => (
              <button
                key={rack}
                type="button"
                onClick={() => setSelectedRack(rack)}
                className={`btn btn-sm ${selectedRack === rack ? 'btn-primary' : 'btn-outline'}`}
              >
                {rack}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs">Bins mapped: {filteredLocations.length}</span>
          <span className="text-xs">Unassigned: {unassignedItems.length}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddBin((open) => !open)}>
            <Plus className="w-3.5 h-3.5" /> Add Bin
          </button>
          {storageLocations.length === 0 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={bootstrapWarehouseLayout} disabled={actionLoading}>
              <Boxes className="w-3.5 h-3.5" /> Set Up Warehouse
            </button>
          )}
        </div>
      </div>

      {selectedItem && (
        <div className="warehouse-move-banner">
          <ArrowRightLeft className="w-4 h-4" />
          <span>
            Moving <strong>{selectedItem.itemCode}</strong> — {selectedItem.itemName || selectedItem.description}. Click a bin, drag it, or pick a destination.
          </span>
          <select
            className="form-select warehouse-move-select"
            value=""
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                return;
              }
              handleMove(selectedItem.id, value === 'unassigned' ? null : Number(value));
            }}
          >
            <option value="" disabled>Move to…</option>
            <option value="unassigned">Unassigned</option>
            {storageLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.label}</option>
            ))}
          </select>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedItemId(null)}>Cancel</button>
        </div>
      )}

      {showAddBin && (
        <form className="panel-card warehouse-add-bin" onSubmit={handleAddBin}>
          <div className="panel-header">
            <span className="panel-title">Add storage bin</span>
          </div>
          <div className="grid-4">
            <div className="form-group mb-0">
              <label className="form-label">Rack</label>
              <input className="form-control" value={binForm.rack} onChange={(e) => setBinForm((prev) => ({ ...prev, rack: e.target.value }))} required />
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Shelf</label>
              <input className="form-control" value={binForm.shelf} onChange={(e) => setBinForm((prev) => ({ ...prev, shelf: e.target.value }))} required />
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Bin</label>
              <input className="form-control" value={binForm.bin} onChange={(e) => setBinForm((prev) => ({ ...prev, bin: e.target.value }))} required />
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Max capacity</label>
              <input type="number" min="0" className="form-control" value={binForm.maxCapacity} onChange={(e) => setBinForm((prev) => ({ ...prev, maxCapacity: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddBin(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading}>Create bin</button>
          </div>
        </form>
      )}

      {storageLocations.length === 0 ? (
        <div className="warehouse-layout">
          <div className="panel-card empty-state warehouse-empty">
            <Boxes className="w-8 h-8 mx-auto mb-3" />
            <p>No warehouse bins are mapped yet.</p>
            <p>Use Set Up Warehouse to create Rack A–D, or add bins one at a time.</p>
            <button type="button" className="btn btn-primary btn-sm mt-3" onClick={bootstrapWarehouseLayout} disabled={actionLoading}>
              <Boxes className="w-3.5 h-3.5" /> Set Up Warehouse
            </button>
          </div>
          <aside className="warehouse-unassigned panel-card">
            <div className="panel-header">
              <span className="panel-title">
                <Archive className="w-5 h-5" /> Inventory items
              </span>
              <span className="text-xs">{unassignedItems.length}</span>
            </div>
            <p className="warehouse-hint">These items are waiting for a bin. Set up the warehouse, then click an item and a bin to place it.</p>
            {unassignedItems.length === 0 ? (
              <div className="warehouse-bin-empty">No inventory items found.</div>
            ) : (
              <div className="warehouse-unassigned-list">
                {unassignedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`warehouse-item ${selectedItemId === item.id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedItemId((current) => current === item.id ? null : item.id)}
                  >
                    <span className="warehouse-item-code">{item.itemCode}</span>
                    <span className="warehouse-item-name">{item.itemName || item.description}</span>
                    <span className="warehouse-item-qty">{item.quantity} {item.unit}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="warehouse-layout">
          <div className="warehouse-map">
            {groupedRacks.length === 0 && (
              <div className="panel-card empty-state">
                <Search className="w-6 h-6 mx-auto mb-2" />
                <p>No bins match the current rack or search filter.</p>
              </div>
            )}

            {groupedRacks.map(({ rack, shelves }) => (
              <section key={rack} className="warehouse-rack panel-card">
                <div className="panel-header">
                  <span className="panel-title">
                    <Layers className="w-5 h-5" /> {rack}
                  </span>
                  <span className="text-xs">{shelves.reduce((count, shelf) => count + shelf.bins.length, 0)} bins</span>
                </div>

                {shelves.map(({ shelf, bins }) => (
                  <div key={`${rack}-${shelf}`} className="warehouse-shelf">
                    <div className="warehouse-shelf-label">{shelf}</div>
                    <div className="warehouse-bin-grid">
                      {bins.map((loc) => {
                        const occupancy = loc.maxCapacity > 0 ? Math.round((loc.quantity / loc.maxCapacity) * 100) : 0;
                        const isTarget = Boolean(selectedItemId);

                        return (
                          <div
                            key={loc.id}
                            className={`warehouse-bin ${isTarget ? 'is-droppable' : ''} ${selectedItemId ? 'is-ready' : ''}`}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleDrop(event, loc.id)}
                            onClick={() => handleBinActivate(loc.id)}
                          >
                            <div className="warehouse-bin-head">
                              <strong>{loc.bin}</strong>
                              {loc.category ? <span className="badge badge-info">{loc.category}</span> : null}
                            </div>
                            <div className="warehouse-bin-meta">
                              {loc.quantity} / {loc.maxCapacity || '∞'} units · {loc.itemCount || (loc.items || []).length} SKUs
                            </div>
                            <div className="warehouse-occupancy">
                              <div
                                className={`warehouse-occupancy-bar ${occupancy > 85 ? 'is-high' : ''}`}
                                style={{ width: `${Math.min(100, occupancy)}%` }}
                              />
                            </div>
                            <div className="warehouse-bin-items">
                              {(loc.items || []).length === 0 ? (
                                <div className="warehouse-bin-empty">Drop or click to place an item</div>
                              ) : (loc.items || []).map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={`warehouse-item ${selectedItemId === item.id ? 'is-selected' : ''}`}
                                  draggable
                                  onDragStart={(event) => {
                                    event.dataTransfer.setData('text/plain', item.id);
                                    setSelectedItemId(item.id);
                                  }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedItemId((current) => current === item.id ? null : item.id);
                                  }}
                                >
                                  <span className="warehouse-item-code">{item.itemCode}</span>
                                  <span className="warehouse-item-name">{item.itemName}</span>
                                  <span className="warehouse-item-qty">{item.quantity} {item.unit}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>

          <aside
            className="warehouse-unassigned panel-card"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, null)}
          >
            <div className="panel-header">
              <span className="panel-title">
                <Archive className="w-5 h-5" /> Unassigned items
              </span>
              <span className="text-xs">{unassignedItems.length}</span>
            </div>
            <p className="warehouse-hint">Select an item, then click a bin. You can also drag items between bins.</p>
            {unassignedItems.length === 0 ? (
              <div className="warehouse-bin-empty">All catalog items have a bin.</div>
            ) : (
              <div className="warehouse-unassigned-list">
                {unassignedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`warehouse-item ${selectedItemId === item.id ? 'is-selected' : ''}`}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', item.id);
                      setSelectedItemId(item.id);
                    }}
                    onClick={() => setSelectedItemId((current) => current === item.id ? null : item.id)}
                  >
                    <span className="warehouse-item-code">{item.itemCode}</span>
                    <span className="warehouse-item-name">{item.itemName || item.description}</span>
                    <span className="warehouse-item-qty">{item.quantity} {item.unit}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedItemId && (
              <button
                type="button"
                className="btn btn-outline btn-sm warehouse-unassign-btn"
                onClick={() => handleMove(selectedItemId, null)}
                disabled={actionLoading}
              >
                Move selected to Unassigned
              </button>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
