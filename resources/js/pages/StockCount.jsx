import React from 'react';
import { useApp } from '../context/AppContext';
import { Calculator, Play, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const StockCount = () => {
  const {
    stockCounts,
    setActiveModal,
    setModalData,
    searchQuery,
    startStockCount
  } = useApp();

  const handleStartNewAudit = () => {
    startStockCount(
      `Ad-Hoc Inventory Physical Audit (${new Date().toISOString().slice(0, 10)})`,
      'Main Warehouse - Pasig Depot'
    );
  };

  const query = searchQuery.toLowerCase();
  const filteredCounts = stockCounts.filter((sc) => {
    const haystack = [sc.id, sc.title, sc.location].map((value) => String(value || '').toLowerCase());
    return haystack.some((value) => value.includes(query));
  });

  return (
    <div className="stock-count-page">
      {/* Header Banner */}
      <div className="panel-card p-3.5 mb-4 flex justify-between items-center flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-white mb-0.5">Physical Inventory Count & Audit System</h3>
          <p className="text-xs text-slate-400">Monthly and quarterly physical stock counts to reconcile system vs actual stock quantities.</p>
        </div>
        <button onClick={handleStartNewAudit} className="btn btn-warning btn-sm">
          <Play className="w-4 h-4" /> Start Physical Stock Count Audit
        </button>
      </div>

      {/* Stock Counts Records Table */}
      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <Calculator className="w-5 h-5 text-amber-400" /> Physical Audit Logs & Discrepancy Records
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Stock Count ID</th>
                <th>Audit Title</th>
                <th>Date</th>
                <th>Warehouse Location</th>
                <th className="text-center">Items Audited</th>
                <th className="text-center">Discrepancies</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCounts.map(sc => (
                <tr key={sc.id}>
                  <td className="font-mono text-xs text-blue-400 font-bold">{sc.id}</td>
                  <td className="font-bold text-xs text-white">{sc.title}</td>
                  <td className="text-xs text-slate-300">{sc.date}</td>
                  <td className="text-xs text-slate-300">{sc.location}</td>
                  <td className="text-center font-bold text-white">{sc.totalItemsAudited}</td>
                  <td className="text-center font-bold">
                    <span className={sc.discrepancyCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                      {sc.discrepancyCount} items
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${sc.status === 'Completed' ? 'completed' : 'pending'}`}>
                      {sc.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => {
                        setModalData(sc);
                        setActiveModal('stock_count');
                      }}
                      className="btn btn-primary btn-sm"
                    >
                      <Eye className="w-3.5 h-3.5" /> {sc.status === 'Completed' ? 'View / Edit' : 'Enter Audit Qty'}
                    </button>
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
