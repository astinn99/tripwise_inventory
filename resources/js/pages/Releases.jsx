import React from 'react';
import { useApp } from '../context/AppContext';
import { Send, CheckCircle2 } from 'lucide-react';

export const Releases = () => {
  const { releases, supplyRequests, releaseSupplyRequest, searchQuery, setActiveModal, setModalData } = useApp();

  const pendingReleases = supplyRequests.filter(r => r.status === 'Ready for Release');

  const filteredHistory = releases.filter(r =>
    r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.requestId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.requestingDepartment.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="releases-page">
      {/* SWS Subsystem Banner */}
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">SMART WAREHOUSING SYSTEM (SWS)</span>
          <div>
            <h2 className="subsystem-heading">Stock Release & Dispatch Management</h2>
            <p className="subsystem-subtext">Handles physical item release for approved department supply requests, walk-in manual issues, and records inventory deduction.</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setModalData({ type: 'ManualRelease' });
            setActiveModal('adjust_stock');
          }}
        >
          <Send className="w-3.5 h-3.5" /> Manual Release
        </button>
      </div>

      {/* Ready for Release Dispatch Queue */}
      <div className="panel-card mb-6 border-emerald-500/30">
        <div className="panel-header">
          <span className="panel-title text-emerald-400">
            <Send className="w-5 h-5 text-emerald-400" /> Pending Stock Releases Queue ({pendingReleases.length})
          </span>
        </div>

        {pendingReleases.length === 0 ? (
          <div className="p-6 text-center text-slate-400">
            No pending stock releases awaiting dispatch.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Requesting Dept</th>
                  <th>Item & Code</th>
                  <th className="text-center">Qty</th>
                  <th>Requested By</th>
                  <th>Approval Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingReleases.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs text-blue-400 font-bold">{r.id}</td>
                    <td className="font-bold text-xs text-white">{r.requestingDepartment}</td>
                    <td>
                      <div className="font-bold text-xs text-white">{r.itemName}</div>
                      <div className="font-mono text-xs text-slate-400">{r.itemCode}</div>
                    </td>
                    <td className="text-center font-bold text-lg text-emerald-400">{r.quantityRequested}</td>
                    <td className="text-xs text-slate-300">{r.requestedBy}</td>
                    <td><span className="badge badge-ready-for-release">Stock Reserved</span></td>
                    <td className="text-right">
                      <button
                        onClick={() => releaseSupplyRequest(r.id, r.requestedBy)}
                        className="btn btn-success btn-sm"
                      >
                        <Send className="w-3.5 h-3.5" /> Dispatch & Deduct Stock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Release Audit History */}
      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <CheckCircle2 className="w-5 h-5 text-purple-400" /> Released Stock Log History
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Release ID</th>
                <th>Request ID</th>
                <th>Department</th>
                <th>Item</th>
                <th className="text-center">Qty Released</th>
                <th>Release Date</th>
                <th>Released To</th>
                <th>Dispatched By</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map(rel => (
                <tr key={rel.id}>
                  <td className="font-mono text-xs text-purple-400 font-bold">{rel.id}</td>
                  <td className="font-mono text-xs text-blue-400">
                    {rel.requestId}
                    {rel.requestId === 'MANUAL' && <div className="text-xs text-slate-400">Walk-in issue</div>}
                  </td>
                  <td className="font-bold text-xs text-white">{rel.requestingDepartment}</td>
                  <td className="text-xs text-slate-200">{rel.itemName} ({rel.itemCode})</td>
                  <td className="text-center font-bold text-purple-400">-{rel.quantityReleased}</td>
                  <td className="text-xs text-slate-300">{rel.releaseDate}</td>
                  <td className="text-xs text-slate-300">{rel.releasedTo}</td>
                  <td className="text-xs text-slate-400">{rel.dispatchedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
