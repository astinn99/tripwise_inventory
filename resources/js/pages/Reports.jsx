import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BarChart3, Download, Printer, Calendar, FileText, Package, ShoppingCart, Users, Truck } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const Reports = () => {
  const {
    inventory,
    purchaseOrders,
    suppliers,
    movements,
    documents
  } = useApp();

  const [activeReportTab, setActiveReportTab] = useState('inventory');
  const [dateRange, setDateRange] = useState('2026-08-01 to 2026-08-31');

  // Reports Summaries
  const invSummary = {
    totalValue: inventory.reduce((sum, i) => sum + (i.cost * (i.quantity + Number(i.damagedQuantity || 0))), 0),
    totalItems: inventory.length,
    lowStockCount: inventory.filter(i => i.status === 'LOW STOCK').length,
    damagedCount: movements.filter(m => m.movementType === 'Damaged').length,
    disposedCount: movements.filter(m => ['Disposed', 'Lost', 'Return'].includes(m.movementType)).length,
    quarantinedUnits: inventory.reduce((sum, i) => sum + Number(i.damagedQuantity || 0), 0),
  };

  const psmSummary = {
    totalSpend: purchaseOrders.reduce((sum, p) => sum + p.totalCost, 0),
    financeApprovedPOs: purchaseOrders.filter(p => p.financeApprovalStatus === 'Finance Approved').length,
    pendingFinancePOs: purchaseOrders.filter(p => p.financeApprovalStatus === 'Pending Finance Approval').length
  };

  const warehouseSummary = {
    totalLogs: movements.length,
    receivedUnits: movements.filter((m) => m.movementType === 'Receiving').reduce((sum, m) => sum + Number(m.quantity || 0), 0),
    releasedUnits: movements.filter((m) => m.movementType === 'Releasing').reduce((sum, m) => sum + Number(m.quantity || 0), 0),
  };

  const dtrsSummary = {
    total: documents.length,
    expiringSoon: documents.filter((d) => d.status === 'Expiring Soon').length,
    expired: documents.filter((d) => d.status === 'Expired').length,
  };

  const dtrsChartData = Object.values(documents.reduce((acc, doc) => {
    const type = doc.type || 'Other';
    acc[type] = acc[type] || { type, count: 0 };
    acc[type].count += 1;
    return acc;
  }, {}));

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
              <div className="kpi-footer font-mono">{invSummary.quarantinedUnits} units isolated · {invSummary.disposedCount} written off</div>
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
                    <th className="text-center">Available</th>
                    <th className="text-center">Quarantine</th>
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
                      <td className="text-center font-bold text-rose-400">{i.damagedQuantity || 0}</td>
                      <td className="text-right font-mono text-xs text-slate-300">₱{Number(i.cost).toLocaleString()}</td>
                      <td className="text-right font-mono text-xs text-emerald-400 font-bold">
                        ₱{(i.cost * (i.quantity + Number(i.damagedQuantity || 0))).toLocaleString()}
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
                      <td><span className={`badge badge-${String(po.financeApprovalStatus || '').toLowerCase().replace(/ /g, '-')}`}>{po.financeApprovalStatus}</span></td>
                      <td><span className={`badge badge-${String(po.poStatus || '').toLowerCase().replace(/ /g, '-')}`}>{po.poStatus}</span></td>
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

      {activeReportTab === 'warehouse' && (
        <div>
          <div className="grid-3 mb-4">
            <div className="kpi-card border-blue-500/40">
              <div className="kpi-header"><span className="kpi-title">MOVEMENT LOGS</span></div>
              <div className="kpi-value text-blue-400">{warehouseSummary.totalLogs}</div>
              <div className="kpi-footer">Receiving, releasing, and adjustments</div>
            </div>
            <div className="kpi-card border-emerald-500/40">
              <div className="kpi-header"><span className="kpi-title">UNITS RECEIVED</span></div>
              <div className="kpi-value text-emerald-400">{warehouseSummary.receivedUnits}</div>
              <div className="kpi-footer">Posted from receiving inspections</div>
            </div>
            <div className="kpi-card border-rose-500/40">
              <div className="kpi-header"><span className="kpi-title">UNITS RELEASED</span></div>
              <div className="kpi-value text-rose-400">{warehouseSummary.releasedUnits}</div>
              <div className="kpi-footer">Dispatched from warehouse</div>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <span className="panel-title"><Truck className="w-5 h-5 text-blue-400" /> Warehouse Movement Audit Report</span>
            </div>
            {movements.length === 0 ? (
              <div className="empty-state">
                <p>No warehouse movements recorded yet.</p>
                <p>Receiving, releasing, transfers, and adjustments will appear here.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Movement ID</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th className="text-center">Quantity</th>
                      <th>Date</th>
                      <th>Location</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td className="font-mono text-xs text-blue-400 font-bold">{m.id}</td>
                        <td>
                          <div className="font-bold text-xs text-white">{m.itemName || '—'}</div>
                          <div className="font-mono text-xs text-slate-400">{m.itemCode || '—'}</div>
                        </td>
                        <td><span className={`badge badge-${String(m.movementType || 'adjustment').toLowerCase().replace(/ /g, '-')}`}>{m.movementType}</span></td>
                        <td className="text-center font-bold">{m.quantity}</td>
                        <td className="text-xs text-slate-300">{m.date || '—'}</td>
                        <td className="text-xs text-slate-300">{m.location || '—'}</td>
                        <td className="font-mono text-xs text-purple-400">{m.reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeReportTab === 'documents' && (
        <div>
          <div className="grid-3 mb-4">
            <div className="kpi-card border-blue-500/40">
              <div className="kpi-header"><span className="kpi-title">DTRS DOCUMENTS</span></div>
              <div className="kpi-value text-blue-400">{dtrsSummary.total}</div>
              <div className="kpi-footer">Warranties, contracts, and archived files</div>
            </div>
            <div className="kpi-card border-amber-500/40">
              <div className="kpi-header"><span className="kpi-title">EXPIRING SOON</span></div>
              <div className="kpi-value text-amber-400">{dtrsSummary.expiringSoon}</div>
              <div className="kpi-footer">Within 30 days</div>
            </div>
            <div className="kpi-card border-rose-500/40">
              <div className="kpi-header"><span className="kpi-title">EXPIRED</span></div>
              <div className="kpi-value text-rose-400">{dtrsSummary.expired}</div>
              <div className="kpi-footer">Past expiration date</div>
            </div>
          </div>

          {dtrsChartData.length > 0 && (
            <div className="panel-card mb-4">
              <div className="panel-header">
                <span className="panel-title"><BarChart3 className="w-5 h-5 text-blue-400" /> Documents by Type</span>
              </div>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dtrsChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                    <XAxis dataKey="type" stroke="#000000" tick={{ fill: '#000000', fontWeight: 600, fontSize: 11 }} />
                    <YAxis allowDecimals={false} stroke="#000000" tick={{ fill: '#000000', fontWeight: 600 }} />
                    <Tooltip contentStyle={{ background: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: 6, color: '#000000', fontWeight: 700 }} />
                    <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="panel-card">
            <div className="panel-header">
              <span className="panel-title"><FileText className="w-5 h-5 text-blue-400" /> DTRS Document Expiration Report</span>
            </div>
            {documents.length === 0 ? (
              <div className="empty-state">
                <p>No DTRS documents to report yet.</p>
                <p>Archive a warranty, contract, or invoice, or receive a vendor warranty through inspection.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Document ID</th>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Supplier</th>
                      <th>Linked Item</th>
                      <th>Linked PO</th>
                      <th>Expiration Date</th>
                      <th>Days left</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className="font-mono text-xs text-blue-400 font-bold">{doc.id}</td>
                        <td className="font-bold text-xs text-white">{doc.title}</td>
                        <td><span className="badge badge-info">{doc.type}</span></td>
                        <td className="text-xs text-slate-300">{doc.supplier || '—'}</td>
                        <td className="font-mono text-xs text-blue-400">{doc.itemCode || '—'}</td>
                        <td className="font-mono text-xs text-purple-400">{doc.purchaseOrderNumber || '—'}</td>
                        <td className="text-xs font-bold text-amber-400">{doc.expirationDate || '—'}</td>
                        <td className="text-xs font-bold">
                          {doc.daysRemaining == null
                            ? '—'
                            : doc.daysRemaining < 0
                              ? `${Math.abs(doc.daysRemaining)} days overdue`
                              : `${doc.daysRemaining} days`}
                        </td>
                        <td>
                          <span className={`badge badge-${String(doc.status || 'active').toLowerCase().replace(/ /g, '-')}`}>
                            {doc.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
