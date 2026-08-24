import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowUpDown, Filter, Download, Plus } from 'lucide-react';

export const InventoryMovements = () => {
  const { movements, searchQuery } = useApp();
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filteredMovements = movements.filter(m => {
    const haystack = [m.id, m.itemCode, m.itemName, m.reference, m.location]
      .map((value) => String(value || '').toLowerCase())
      .join(' ');
    const matchesSearch = haystack.includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || m.movementType === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="inventory-movements-page">
      {/* Filter Control Bar */}
      <div className="filter-bar">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-bold uppercase">Movement Type:</span>
          <div className="flex gap-1 flex-wrap">
            {['ALL', 'Receiving', 'Releasing', 'Transfer', 'Return', 'Damaged', 'Lost', 'Disposed', 'Adjustment'].map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`btn btn-sm ${typeFilter === type ? 'btn-primary' : 'btn-outline'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => alert('Exporting Inventory Audit Logs to CSV...')} className="btn btn-outline btn-sm">
          <Download className="w-3.5 h-3.5" /> Export Audit Log
        </button>
      </div>

      {/* Movements Table */}
      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <ArrowUpDown className="w-5 h-5 text-blue-400" /> Inventory Movement Audit Trail ({filteredMovements.length} Logs)
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Movement ID</th>
                <th>Item & Code</th>
                <th>Movement Type</th>
                <th className="text-center">Quantity</th>
                <th>Date & Time</th>
                <th>Location</th>
                <th>Reference</th>
                <th>Remarks</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-xs text-secondary p-4">
                    No inventory movements recorded yet. Receiving, releasing, transfers, and adjustments will appear here.
                  </td>
                </tr>
              )}
              {filteredMovements.map(m => (
                <tr key={m.id}>
                  <td className="font-mono text-xs text-blue-400 font-bold">{m.id}</td>
                  <td>
                    <div className="font-bold text-xs text-white">{m.itemName}</div>
                    <div className="font-mono text-xs text-slate-400">{m.itemCode}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${m.movementType === 'Receiving' ? 'normal' :
                        m.movementType === 'Releasing' ? 'purple' :
                          ['Damaged', 'Disposed', 'Lost', 'Return'].includes(m.movementType) ? 'damaged' :
                            m.movementType === 'Adjustment' ? 'adjustment' : 'info'
                      }`}>
                      {m.movementType}
                    </span>
                  </td>
                  <td className="text-center font-bold text-base">
                    <span className={m.movementType === 'Receiving' ? 'text-emerald-400' : m.movementType === 'Releasing' ? 'text-purple-400' : 'text-rose-400'}>
                      {m.movementType === 'Receiving' ? `+${m.quantity}` : `-${m.quantity}`}
                    </span>
                  </td>
                  <td className="text-xs text-slate-300">{m.date}</td>
                  <td className="text-xs font-mono text-slate-300">{m.location}</td>
                  <td className="text-xs font-mono text-blue-400">{m.reference}</td>
                  <td className="text-xs text-slate-300 max-w-xs">{m.remarks}</td>
                  <td className="text-xs text-slate-400">{m.recordedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
