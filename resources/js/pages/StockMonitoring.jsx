import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Activity, AlertTriangle, XCircle, CheckCircle2, ShoppingCart } from 'lucide-react';
import { ItemIdentity } from '../components/ui/ItemThumb';
import { getForecasts, peekForecasts } from '../services/api';
import { formatFriendlyDate } from '../services/dates';

const forecastBadgeClass = (badge) => {
  if (badge === 'At risk') return 'badge-low-stock';
  if (badge === 'Covered') return 'badge-normal';
  return 'badge-draft';
};

export const StockMonitoring = () => {
  const {
    inventory,
    movements,
    setActiveTab,
    searchQuery,
    setActiveModal,
    setModalData
  } = useApp();
  const [forecasts, setForecasts] = useState(() => peekForecasts() ?? []);
  const [forecastError, setForecastError] = useState('');
  const [forecastLoading, setForecastLoading] = useState(() => peekForecasts() === null);

  useEffect(() => {
    let cancelled = false;
    getForecasts()
      .then((data) => {
        if (!cancelled) {
          setForecasts(Array.isArray(data) ? data : []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setForecastError(error?.message || 'Unable to load forecasts.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setForecastLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const forecastByCode = Object.fromEntries(forecasts.map((run) => [run.itemCode, run]));
  const forecastAtRiskNormal = inventory.filter((item) => (
    item.status === 'NORMAL'
    && forecastByCode[item.itemCode]?.stockoutOn
  )).length;

  const normalItems = inventory.filter(i => i.status === 'NORMAL');
  const lowStockItems = inventory.filter(i => i.status === 'LOW STOCK');
  const outOfStockItems = inventory.filter(i => i.status === 'OUT OF STOCK');

  const filteredItems = inventory.filter(item =>
    item.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openRestock = (item) => {
    setModalData({ ...item, forecast: forecastByCode[item.itemCode] || null });
    setActiveModal('manual_restock');
  };

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
                  {forecastAtRiskNormal > 0 ? ` ${forecastAtRiskNormal} NORMAL item(s) are still forecasted to stock out within the current horizon.` : ''}
                </p>
              </div>
            </div>
            <button onClick={() => setActiveTab('procurement')} className="btn btn-warning btn-sm">
              <ShoppingCart className="w-4 h-4" /> Go to PSM Procurement Sourcing
            </button>
          </div>
        </div>
      )}

      {forecastAtRiskNormal > 0 && lowStockItems.length === 0 && outOfStockItems.length === 0 ? (
        <div className="panel-card bg-amber-50 border-amber-300 mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0" />
            <p className="text-xs text-black font-semibold">
              {forecastAtRiskNormal} NORMAL item(s) are forecasted to stock out within the current horizon.
            </p>
          </div>
        </div>
      ) : null}

      {forecastLoading ? (
        <div className="empty-state mb-4">
          <p>Loading forecasts…</p>
        </div>
      ) : null}

      {forecastError ? (
        <div className="empty-state mb-4">
          <p>{forecastError}</p>
        </div>
      ) : null}

      {/* Main Stock Threshold Table */}
      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <Activity className="w-5 h-5 text-success" /> Dedicated Stock Monitoring Table
          </span>
        </div>

        <div className="stock-monitoring-table">
          <table className="custom-table table-stack">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-center">Stock</th>
                <th>Status</th>
                <th>Forecast</th>
                <th>Placement</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const lastMov = movements.find(m => m.itemCode === item.itemCode);
                const forecast = forecastByCode[item.itemCode];
                const badge = forecast?.forecastBadge || (forecastError ? 'No forecast' : 'No forecast');

                return (
                  <tr key={item.id}>
                    <td data-label="Item">
                      <ItemIdentity
                        src={item.imageUrl}
                        name={item.description}
                        code={item.itemCode}
                        extra={item.category}
                      />
                    </td>
                    <td data-label="Stock" className="text-center">
                      <div className={`font-extrabold text-lg ${item.status === 'OUT OF STOCK' ? 'text-danger' : item.status === 'LOW STOCK' ? 'text-warning' : 'text-success'}`}>
                        {item.quantity} {item.unit}
                      </div>
                      <div className="text-xs text-warning font-bold">Min {item.minStockLevel}</div>
                      {Number(item.damagedQuantity || 0) > 0 && (
                        <div className="text-xs text-danger font-bold">{item.damagedQuantity} quarantined</div>
                      )}
                    </td>
                    <td data-label="Status">
                      <span className={`badge badge-${item.status.toLowerCase().replace(/ /g, '-')}`}>
                        {item.status}
                      </span>
                    </td>
                    <td data-label="Forecast">
                      <div className="stock-monitoring-meta">
                        <span className={`badge ${forecastBadgeClass(badge)}`}>{badge}</span>
                        <span className="text-xs font-bold">Suggested {forecast ? forecast.reorderQty : '—'}</span>
                        <span className="text-xs font-semibold">
                          {forecast?.stockoutOn ? formatFriendlyDate(forecast.stockoutOn, { relative: true }) : 'No predicted stockout'}
                        </span>
                      </div>
                    </td>
                    <td data-label="Placement">
                      <div className="stock-monitoring-meta">
                        <span className="text-xs font-mono font-semibold">{item.location}</span>
                        <span className="text-xs font-semibold">
                          {lastMov ? `${lastMov.date} (${lastMov.movementType})` : 'No recent movement'}
                        </span>
                        <span className="text-xs font-semibold">{item.supplier}</span>
                      </div>
                    </td>
                    <td data-label="Action" className="text-right table-stack-actions">
                      <button
                        onClick={() => openRestock(item)}
                        className={`btn btn-sm ${item.status === 'NORMAL' ? 'btn-outline' : 'btn-warning'}`}
                        title={item.status === 'NORMAL' ? 'Create a proactive restock request' : 'Create a restock procurement request'}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" /> Manual Restock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
