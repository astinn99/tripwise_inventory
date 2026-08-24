import React, { lazy, Suspense } from 'react';
import { useApp } from '../context/AppContext';
import {
  Package,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ClipboardList,
  ShoppingCart,
  FileSpreadsheet,
  DollarSign,
  Truck,
  CheckCircle2,
  Inbox,
  Send,
  ShieldAlert,
  FileText,
} from 'lucide-react';

const DashboardCharts = lazy(() => import('./DashboardCharts'));

export const Dashboard = () => {
  const {
    inventory,
    supplyRequests,
    procurementRequests,
    quotations,
    purchaseOrders,
    deliveries,
    movements,
    documents,
    suppliers,
    setActiveTab,
    setActiveModal,
    setModalData,
    movementTrend,
    lowStockTrend
  } = useApp();

  // Metrics
  const totalInventory = inventory.length;
  const availableStockCount = inventory.filter(i => i.quantity > i.minStockLevel).length;
  const lowStockCount = inventory.filter(i => i.status === 'LOW STOCK').length;
  const outOfStockCount = inventory.filter(i => i.status === 'OUT OF STOCK').length;

  const pendingSupplyRequests = supplyRequests.filter(r => r.status === 'Pending' || r.status === 'Received' || r.status === 'For Procurement').length;
  const itemsForProcurement = procurementRequests.filter(p => !p.selectedSupplier && !p.poNumber && p.status !== 'Completed').length;
  const pendingQuotations = quotations.filter(q => q.status === 'Submitted').length;
  const totalPOs = purchaseOrders.length;
  const pendingFinanceApprovals = purchaseOrders.filter(p => p.poStatus === 'Pending Finance Approval').length;
  const pendingDeliveries = deliveries.filter(d => d.status === 'Expected' || d.status === 'In Transit').length;
  const awaitingInspection = deliveries.filter(d =>
    d.status === 'Under Inspection'
    || d.status === 'In Transit'
    || String(d.inspectionResult || 'Pending') === 'Pending'
  ).length;

  const recentlyReceived = movements.filter(m => m.movementType === 'Receiving').slice(0, 5);
  const recentlyReleased = movements.filter(m => m.movementType === 'Releasing').slice(0, 5);
  const damagedItems = movements.filter(m => m.movementType === 'Damaged');
  const quarantinedSkus = inventory.filter(i => Number(i.damagedQuantity || 0) > 0).length;
  const quarantinedUnits = inventory.reduce((sum, i) => sum + Number(i.damagedQuantity || 0), 0);
  const expiringDocuments = documents.filter(d => d.status === 'Expiring Soon' || d.status === 'Expired').length;

  // Chart Data Preparation
  const inventoryOverviewData = [
    { name: 'Normal', count: availableStockCount, fill: '#059669' },
    { name: 'Low Stock', count: lowStockCount, fill: '#D97706' },
    { name: 'Out of Stock', count: outOfStockCount, fill: '#DC2626' }
  ];

  const movementTrendData = movementTrend.length ? movementTrend : [
    { day: 'Mon', receiving: 0, releasing: 0 },
  ];

  const procurementStatusData = [
    { name: 'Quotation', value: procurementRequests.filter(p => p.status === 'Quotation' || p.status === 'Quotation Comparison').length, color: '#1D4ED8' },
    { name: 'Finance Review', value: procurementRequests.filter(p => p.status === 'Pending Finance Approval').length, color: '#D97706' },
    { name: 'Approved', value: procurementRequests.filter(p => p.status === 'Finance Approved').length, color: '#059669' },
    { name: 'Completed', value: procurementRequests.filter(p => p.status === 'Completed').length, color: '#1D4ED8' }
  ];

  const poStatusData = [
    { status: 'Pending Finance', count: pendingFinanceApprovals },
    { status: 'Sent / Confirmed', count: purchaseOrders.filter(p => p.poStatus === 'Sent to Supplier' || p.poStatus === 'Confirmed').length },
    { status: 'Partial Delivery', count: purchaseOrders.filter(p => p.poStatus === 'Partially Delivered').length },
    { status: 'Fully Delivered', count: purchaseOrders.filter(p => p.poStatus === 'Fully Delivered').length }
  ];

  const financeQueue = purchaseOrders
    .filter((p) => p.poStatus === 'Pending Finance Approval')
    .slice(0, 8);

  const supplierPerfData = suppliers.map(s => ({
    name: s.companyName.split(' ')[0],
    rating: s.overallScore,
    quality: s.qualityScore,
    delivery: s.deliveryPerformance
  }));

  const lowStockTrendData = lowStockTrend.length ? lowStockTrend : [
    { week: 'Now', count: lowStockCount + outOfStockCount }
  ];

  return (
    <div className="dashboard-page">
      {/* Subsystem Banner */}
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">TNVS SUBSYSTEM</span>
          <div>
            <h2 className="subsystem-heading">Supply Chain & Inventory Management Subsystem</h2>
            <p className="subsystem-subtext">Automated stock monitoring, procurement sourcing, and warehouse operations portal.</p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card" onClick={() => setActiveTab('items')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Total Items</span>
            <div className="kpi-icon-box text-blue"><Package className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value">{totalInventory}</div>
          <div className="kpi-footer text-black"><CheckCircle className="w-3.5 h-3.5 text-success" /> Across 4 Categories</div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('stock_monitoring')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Available Stock</span>
            <div className="kpi-icon-box text-success"><CheckCircle className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-success">{availableStockCount}</div>
          <div className="kpi-footer text-black">Normal Operational Levels</div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('stock_monitoring')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Low Stock Alert</span>
            <div className="kpi-icon-box text-warning"><AlertTriangle className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-warning">{lowStockCount}</div>
          <div className="kpi-footer text-black">At or below reorder threshold</div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('stock_monitoring')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Out of Stock</span>
            <div className="kpi-icon-box text-danger"><XCircle className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-danger">{outOfStockCount}</div>
          <div className="kpi-footer text-black">Requires Urgent Restock</div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('supply_requests')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Pending Requests</span>
            <div className="kpi-icon-box text-blue"><ClipboardList className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-blue">{pendingSupplyRequests}</div>
          <div className="kpi-footer text-black">From Dept Subsystem</div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('procurement')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Items for Proc.</span>
            <div className="kpi-icon-box text-blue"><ShoppingCart className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-blue">{itemsForProcurement}</div>
          <div className="kpi-footer text-black">Active PSM Sourcing</div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('quotations')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Pending Quotes</span>
            <div className="kpi-icon-box text-blue"><FileSpreadsheet className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-blue">{pendingQuotations}</div>
          <div className="kpi-footer text-black">RFQs under evaluation</div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('purchase_orders')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Finance Approvals</span>
            <div className="kpi-icon-box text-warning"><DollarSign className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-warning">{pendingFinanceApprovals}</div>
          <div className="kpi-footer text-black">Checkpoint Required</div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('receiving')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Pending Deliveries</span>
            <div className="kpi-icon-box text-blue"><Truck className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value">{pendingDeliveries}</div>
          <div className="kpi-footer text-black">In Transit to Warehouse</div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('inspection')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Awaiting Inspect</span>
            <div className="kpi-icon-box text-blue"><CheckCircle2 className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-blue">{awaitingInspection}</div>
          <div className="kpi-footer text-black">SWS Checklist Active</div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('inventory_movements')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Recently Received</span>
            <div className="kpi-icon-box text-success"><Inbox className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-success">{recentlyReceived.length}</div>
          <div className="kpi-footer text-black">Items logged into stock</div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('releases')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Recently Released</span>
            <div className="kpi-icon-box text-blue"><Send className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-blue">{recentlyReleased.length}</div>
          <div className="kpi-footer text-black">Dispatched to Depts</div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('inventory_movements')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Damaged Items</span>
            <div className="kpi-icon-box text-danger"><ShieldAlert className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-danger">{quarantinedSkus}</div>
          <div className="kpi-footer text-black">{quarantinedUnits} units isolated · {damagedItems.length} logs</div>
        </div>

        <div className="kpi-card" onClick={() => setActiveTab('expiring_documents')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <span className="kpi-title">Expiring Docs</span>
            <div className="kpi-icon-box text-warning"><FileText className="w-5 h-5" /></div>
          </div>
          <div className="kpi-value text-warning">{expiringDocuments}</div>
          <div className="kpi-footer text-black">DTRS Warranty & Policies</div>
        </div>
      </div>

      <Suspense fallback={null}>
        <DashboardCharts
          inventoryOverviewData={inventoryOverviewData}
          movementTrendData={movementTrendData}
          procurementStatusData={procurementStatusData}
          poStatusData={poStatusData}
          lowStockTrendData={lowStockTrendData}
          supplierPerfData={supplierPerfData}
        />
      </Suspense>

      {/* Activity Summary Tables */}
      <div className="grid-2">
        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><Inbox className="w-5 h-5 text-success" /> Recent Receiving Logs</span>
            <button onClick={() => setActiveTab('inventory_movements')} className="btn btn-outline btn-sm">View All</button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Date</th>
                  <th>Ref</th>
                </tr>
              </thead>
              <tbody>
                {recentlyReceived.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div className="font-bold text-xs text-black">{m.itemName}</div>
                      <div className="font-mono text-xs text-black">{m.itemCode}</div>
                    </td>
                    <td className="font-bold text-success font-mono">+{m.quantity}</td>
                    <td className="text-xs text-black font-semibold">{m.date}</td>
                    <td className="text-xs font-mono text-blue font-bold">{m.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><DollarSign className="w-5 h-5 text-warning" /> Finance Integration Checkpoints</span>
            <button onClick={() => setActiveTab('purchase_orders')} className="btn btn-outline btn-sm">Manage POs</button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>Supplier</th>
                  <th>Cost</th>
                  <th>Finance Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {financeQueue.map(po => (
                  <tr key={po.poNumber}>
                    <td className="font-mono text-xs text-blue font-bold">{po.poNumber}</td>
                    <td className="font-bold text-xs text-black">{po.supplier}</td>
                    <td className="font-bold text-success font-mono">₱{Number(po.totalCost).toLocaleString()}</td>
                    <td>
                      <span className={`badge badge-${po.financeApprovalStatus.toLowerCase().replace(/ /g, '-')}`}>
                        {po.financeApprovalStatus}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          setModalData(po);
                          setActiveModal('finance_approval');
                        }}
                        className="btn btn-warning btn-sm"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
