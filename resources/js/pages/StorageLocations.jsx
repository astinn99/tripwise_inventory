import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Boxes, Layers, Grid, Archive, Search } from 'lucide-react';

export const StorageLocations = () => {
  const { storageLocations, searchQuery } = useApp();
  const [selectedRack, setSelectedRack] = useState('ALL');

  const racks = ['ALL', 'Rack A', 'Rack B', 'Rack C', 'Rack D'];

  const filteredLocations = storageLocations.filter(loc => {
    const matchesSearch =
      loc.rack.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.shelf.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.bin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.itemName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRack = selectedRack === 'ALL' || loc.rack === selectedRack;
    return matchesSearch && matchesRack;
  });

  return (
    <div className="storage-locations-page">
      {/* SWS Banner */}
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">SMART WAREHOUSING SYSTEM (SWS)</span>
          <div>
            <h2 className="subsystem-heading">Warehouse Racks & Storage Location Hierarchy</h2>
            <p className="subsystem-subtext">Maps exact physical storage coordinates (Rack → Shelf → Bin) and tracks storage capacity utilization.</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-bar">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold uppercase">Select Rack Zone:</span>
          <div className="flex gap-1">
            {racks.map(r => (
              <button
                key={r}
                onClick={() => setSelectedRack(r)}
                className={`btn btn-sm ${selectedRack === r ? 'btn-primary' : 'btn-outline'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-slate-400">Total Bins Mapped: {filteredLocations.length}</span>
      </div>

      {/* Visual Bins Grid Cards */}
      <div className="grid-3 mb-6">
        {filteredLocations.map((loc, idx) => {
          const utilPct = Math.round((loc.quantity / loc.maxCapacity) * 100);

          return (
            <div key={idx} className="panel-card p-4 border border-slate-700 hover:border-blue-500/50 transition">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-mono font-bold text-blue-400">
                  {loc.rack} → {loc.shelf} → {loc.bin}
                </span>
                <span className="badge badge-normal">{loc.category}</span>
              </div>

              <h4 className="text-sm font-bold text-white mb-1">{loc.itemName}</h4>
              <div className="text-xs text-slate-400 mb-3 font-mono">Code: {loc.itemCode}</div>

              {/* Progress Bar for Bin Capacity */}
              <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Bin Occupancy</span>
                  <span className="font-bold text-white">{loc.quantity} / {loc.maxCapacity} ({utilPct}%)</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className={`h-full ${utilPct > 85 ? 'bg-amber-400' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, utilPct)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
