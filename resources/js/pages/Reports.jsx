import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BarChart3, Download, Printer, Filter, Calendar, FileText, Package, ShoppingCart, Users, Truck } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const Reports = () => {
  const {
    inventory,
    procurementRequests,
    purchaseOrders,
    suppliers,
    deliveries,
    movements,
    documents
  } = useApp();

  const [activeReportTab, setActiveReportTab] = useState('inventory');
  const [dateRange, setDateRange] = useState('2026-08-01 to 2026-08-31');

  // Reports Summaries
  const invSummary = {
    totalValue: inventory.reduce((sum, i) => sum + (i.cost * i.quantity), 0),
    totalItems: inventory.length,
    lowStockCount: inventory.filter(i => i.status === 'LOW STOCK').length,
    damagedCount: movements.filter(m => m.movementType === 'Damaged').length
  };

  const psmSummary = {
    totalSpend: purchaseOrders.reduce((sum, p) => sum + p.totalCost, 0),
    financeApprovedPOs: purchaseOrders.filter(p => p.financeApprovalStatus === 'Finance Approved').length,
    pendingFinancePOs: purchaseOrders.filter(p => p.financeApprovalStatus === 'Pending Finance Approval').length
  };

  return (
    <div className="reports-page">
      {/* Subsystem Banner */}
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">REPORTS & ANALYTICS</span>
          <div>
            <h2 className="subsystem-heading">Supply Chain Subsystem Reports & Analytics</h2>
            <p className="subsystem-subtext">Comprehensive operational reports covering inventory valuation, PSM procurement spend, vendor scorecards, and warehousing audit trails.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn btn-outline btn-sm">
            <Printer className="w-4 h-4" /> Print Report
          </button>
          <button onClick={() => alert('Exporting full analytics data...')} className="btn btn-primary btn-sm">
            <Download className="w-4 h-4" /> Export Report (PDF/Excel)
          </button>
        </div>
      </div>

      {/* Report Categories Tabs & Filters */}
      <div className="filter-bar">
        <div className="flex gap-1 flex-wrap">
          {[
            { id: 'inventory', label: 'Inventory Reports', icon: Package },
            { id: 'procurement', label: 'Procurement & PO Reports', icon: ShoppingCart },
            { id: 'supplier', label: 'Supplier Performance Reports', icon: Users },
            { id: 'warehouse', label: 'Warehouse & SWS Reports', icon: Truck },
            { id: 'documents', label: 'DTRS Document Reports', icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveReportTab(tab.id)}
                className={`btn btn-sm ${activeReportTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
              >
                <Icon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-bold uppercase">Date Range:</span>
          <input
            type="text"
            className="form-control text-xs p-1 font-mono text-center"
            style={{ width: '210px' }}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          />
        </div>
      </div>

      {/* 1. Inventory Reports */}
      {activeReportTab === 'inventory' && (
        <div>
          <div className="grid-3 mb-4">
            <div className="kpi-card border-blue-500/40">
              <div className="kpi-header"><span className="kpi-title">TOTAL INVENTORY VALUE</span></div>
              <div className="kpi-value text-emerald-400">₱{invSummary.totalValue.toLocaleString()}</div>
              <div className="kpi-footer">Across all warehouse storage locations</div>
            </div>
            <div className="kpi-card border-amber-500/40">
              <div className="kpi-header"><span className="kpi-title">LOW STOCK ITEMS</span></div>
              <div className="kpi-value text-amber-400">{invSummary.lowStockCount}</div>
              <div className="kpi-footer">Under safety threshold</div>
            </div>
            <div className="kpi-card border-rose-500/40">
              <div className="kpi-header"><span className="kpi-title">DAMAGED ITEMS LOGGED</span></div>
              <div className="kpi-value text-rose-400">{invSummary.damagedCount}</div>
              <div className="kpi-footer font-mono">Isolated for disposal</div>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <span className="panel-title"><Package className="w-5 h-5 text-blue-400" /> Inventory Valuation Report</span>
            </div>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th className="text-center">Stock Qty</th>
                    <th className="text-right">Unit Cost</th>
                    <th className="text-right">Total Valuation</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(i => (
                    <tr key={i.id}>
                      <td className="font-mono text-xs text-blue-400 font-bold">{i.itemCode}</td>
                      <td className="font-bold text-xs text-white">{i.description}</td>
                      <td className="text-xs text-slate-300">{i.category}</td>
                      <td className="text-center font-bold">{i.quantity} {i.unit}</td>
                      <td className="text-right font-mono text-xs text-slate-300">₱{Number(i.cost).toLocaleString()}</td>
                      <td className="text-right font-mono text-xs text-emerald-400 font-bold">
                        ₱{(i.cost * i.quantity).toLocaleString()}
                      </td>
                      <td><span className={`badge badge-${i.status.toLowerCase().replace(/ /g, '-')}`}>{i.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. Procurement Reports */}
      {activeReportTab === 'procurement' && (
        <div>
          <div className="grid-3 mb-4">
            <div className="kpi-card border-purple-500/40">
              <div className="kpi-header"><span className="kpi-title">TOTAL COMMITTED PO SPEND</span></div>
              <div className="kpi-value text-emerald-400">₱{psmSummary.totalSpend.toLocaleString()}</div>
              <div className="kpi-footer">Across all active purchase orders</div>
            </div>
            <div className="kpi-card border-emerald-500/40">
              <div className="kpi-header"><span className="kpi-title">FINANCE APPROVED POs</span></div>
              <div className="kpi-value text-emerald-400">{psmSummary.financeApprovedPOs}</div>
              <div className="kpi-footer">Proceeded to vendor execution</div>
            </div>
            <div className="kpi-card border-amber-500/40">
              <div className="kpi-header"><span className="kpi-title">PENDING FINANCE REVIEW</span></div>
              <div className="kpi-value text-amber-400">{psmSummary.pendingFinancePOs}</div>
              <div className="kpi-footer">Forwarded to Finance Subsystem</div>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <span className="panel-title"><ShoppingCart className="w-5 h-5 text-purple-400" /> PSM Procurement & Finance Approval Status Report</span>
            </div>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Budget Reference</th>
                    <th>Procurement Reason</th>
                    <th className="text-right">Total Cost</th>
                    <th>Finance Approval Status</th>
                    <th>PO Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map(po => (
                    <tr key={po.poNumber}>
                      <td className="font-mono text-xs text-blue-400 font-bold">{po.poNumber}</td>
                      <td className="font-bold text-xs text-white">{po.supplier}</td>
                      <td className="font-mono text-xs text-purple-400">{po.budgetReference}</td>
                      <td className="text-xs text-slate-300">{po.procurementReason}</td>
                      <td className="text-right font-mono text-xs text-emerald-400 font-bold">₱{Number(po.totalCost).toLocaleString()}</td>
                      <td><span className={`badge badge-${po.financeApprovalStatus.toLowerCase().replace(/ /g, '-')}`}>{po.financeApprovalStatus}</span></td>
                      <td><span className={`badge badge-${po.poStatus.toLowerCase().replace(/ /g, '-')}`}>{po.poStatus}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Supplier Performance Reports */}
      {activeReportTab === 'supplier' && (
        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><Users className="w-5 h-5 text-cyan-400" /> Vendor Ratings & Performance Report</span>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Supplier ID</th>
                  <th>Company Name</th>
                  <th>Contact Person</th>
                  <th>Quality Score</th>
                  <th>On-Time Delivery %</th>
                  <th>Responsiveness</th>
                  <th>Overall Score</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs text-blue-400 font-bold">{s.id}</td>
                    <td className="font-bold text-xs text-white">{s.companyName}</td>
                    <td className="text-xs text-slate-300">{s.contactPerson}</td>
                    <td className="font-bold text-emerald-400 text-xs">{s.qualityScore}%</td>
                    <td className="font-bold text-blue-400 text-xs">{s.deliveryPerformance}%</td>
                    <td className="font-bold text-purple-400 text-xs">{s.responsivenessScore}%</td>
                    <td><span className="badge badge-normal font-bold">★ {s.overallScore}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4 & 5 Warehouse & Document Reports */}
      {(activeReportTab === 'warehouse' || activeReportTab === 'documents') && (
        <div className="panel-card p-6 text-center text-slate-300">
          <BarChart3 className="w-12 h-12 text-blue-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-white capitalize">{activeReportTab} Operations Audit Report</h3>
          <p className="text-xs text-slate-400 mt-1">Detailed transaction history, receiving/release audits, and DTRS contract expiration reports generated for date range: {dateRange}.</p>
        </div>
      )}
    </div>
  );
};
