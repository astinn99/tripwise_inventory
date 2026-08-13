import React from 'react';
import { useApp } from '../context/AppContext';
import { Activity, AlertTriangle, XCircle, CheckCircle2, ShoppingCart } from 'lucide-react';
import { Modal } from '../components/ui/Modal';

export const StockMonitoring = () => {
  const {
    inventory,
    movements,
    setActiveTab,
    searchQuery,
    createManualProcurementRequest,
    activeModal,
    setActiveModal,
    modalData,
    setModalData
  } = useApp();

  const [restockQty, setRestockQty] = React.useState('');
  const [restockReason, setRestockReason] = React.useState('');
  const [restockPriority, setRestockPriority] = React.useState('NORMAL');

  const normalItems = inventory.filter(i => i.status === 'NORMAL');
  const lowStockItems = inventory.filter(i => i.status === 'LOW STOCK');
  const outOfStockItems = inventory.filter(i => i.status === 'OUT OF STOCK');

  const filteredItems = inventory.filter(item =>
    item.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="stock-monitoring-page">
      {/* Overview KPI Cards */}
      <div className="grid-3 mb-4">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">NORMAL STOCK LEVEL</span>
            <div className="kpi-icon-box text-success"><CheckCircle2 className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-success">{normalItems.length}</div>
          <div className="kpi-footer text-success">Stock above threshold</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">LOW STOCK ALERT</span>
            <div className="kpi-icon-box text-warning"><AlertTriangle className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-warning">{lowStockItems.length}</div>
          <div className="kpi-footer text-warning">Requires Procurement Reorder</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">OUT OF STOCK CRITICAL</span>
            <div className="kpi-icon-box text-danger"><XCircle className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-danger">{outOfStockItems.length}</div>
          <div className="kpi-footer text-danger">Immediate Restocking Mandatory</div>
        </div>
      </div>

      {/* Low & Out of Stock Priority Alert Banner */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <div className="panel-card bg-amber-50 border-amber-300 mb-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0" />
              <div>
                <h4 className="text-sm font-extrabold text-black">Automated Threshold Warning</h4>
                <p className="text-xs text-black font-semibold mt-0.5">
                  {lowStockItems.length + outOfStockItems.length} item(s) are currently below their minimum safety stock level.
                </p>
              </div>
            </div>
            <button onClick={() => setActiveTab('procurement')} className="btn btn-warning btn-sm">
              <ShoppingCart className="w-4 h-4" /> Go to PSM Procurement Sourcing
            </button>
          </div>
        </div>
      )}

      {/* Main Stock Threshold Table */}
      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <Activity className="w-5 h-5 text-success" /> Dedicated Stock Monitoring Table
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>Category</th>
                <th className="text-center">Current Stock</th>
                <th className="text-center">Min Safety Level</th>
                <th>Stock Status</th>
                <th>Location</th>
                <th>Last Movement</th>
                <th>Supplier</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const lastMov = movements.find(m => m.itemCode === item.itemCode);

                return (
                  <tr key={item.id}>
                    <td className="font-mono text-xs text-blue font-bold">{item.itemCode}</td>
                    <td className="font-bold text-xs text-black">{item.description}</td>
                    <td className="text-xs text-black font-semibold">{item.category}</td>
                    <td className="text-center font-extrabold text-lg">
                      <span className={item.status === 'OUT OF STOCK' ? 'text-danger' : item.status === 'LOW STOCK' ? 'text-warning' : 'text-success'}>
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    <td className="text-center font-bold text-warning text-sm">{item.minStockLevel}</td>
                    <td>
                      <span className={`badge badge-${item.status.toLowerCase().replace(/ /g, '-')}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="text-xs font-mono text-black font-semibold">{item.location}</td>
                    <td className="text-xs text-black font-semibold">
                      {lastMov ? `${lastMov.date} (${lastMov.movementType})` : 'No recent movement'}
                    </td>
                    <td className="text-xs text-black font-semibold">{item.supplier}</td>
                    <td className="text-right">
                      {item.status !== 'NORMAL' ? (
                        <button
                          onClick={() => {
                            setModalData(item);
                            setRestockQty(Math.max(0, item.minStockLevel - item.quantity) || 10);
                            setRestockReason('');
                            setRestockPriority(item.status === 'OUT OF STOCK' ? 'URGENT' : 'HIGH');
                            setActiveModal('manual_restock');
                          }}
                          className="btn btn-warning btn-sm"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" /> Manual Restock
                        </button>
                      ) : (
                        <span className="text-xs text-black font-semibold">Normal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {activeModal === 'manual_restock' && modalData && (
        <Modal
          onClose={() => setActiveModal(null)}
          icon={ShoppingCart}
          tone="rose"
          size="sm"
          title="Manual Restock Request"
          subtitle="Create a procurement request for a low or missing SKU."
          footer={(
            <>
              <button onClick={() => setActiveModal(null)} className="btn btn-outline btn-sm">Cancel</button>
              <button
                onClick={() => {
                  createManualProcurementRequest(modalData.itemCode, restockQty, restockReason, restockPriority);
                  setActiveModal(null);
                }}
                className="btn btn-primary btn-sm"
              >
                Submit Request
              </button>
            </>
          )}
        >
          <div className="modal-hero">
            <div className="modal-hero-main">
              <div className="modal-kicker">{modalData.itemCode}</div>
              <h4>{modalData.description}</h4>
              <div className="modal-hero-meta">Manual procurement will be queued for sourcing.</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Quantity requested</label>
            <input type="number" className="form-control" value={restockQty} onChange={e => setRestockQty(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-select" value={restockPriority} onChange={e => setRestockPriority(e.target.value)}>
              <option value="NORMAL">NORMAL</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Reason / justification</label>
            <textarea
              className="form-control"
              rows="3"
              value={restockReason}
              onChange={e => setRestockReason(e.target.value)}
              placeholder="E.g., Stock level critically low, buffer needed for upcoming maintenance."
            />
          </div>
        </Modal>
      )}
    </div>
  );
};
