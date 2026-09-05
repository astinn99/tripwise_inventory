import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getForecast, getForecasts, refreshForecast } from '../services/api';
import { formatChartTick, formatFriendlyDate, formatFriendlyDateTime } from '../services/dates';
import { Activity, AlertTriangle, ShoppingCart, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const chartTip = {
  background: '#FFFFFF',
  borderColor: '#A7A9AC',
  borderRadius: 6,
  color: '#000000',
  fontWeight: 700,
};

const badgeClass = (badge) => {
  if (badge === 'At risk') return 'badge-low-stock';
  if (badge === 'Covered') return 'badge-normal';
  return 'badge-draft';
};

const statusLabel = (badge) => {
  if (badge === 'At risk') return 'May run out';
  if (badge === 'Covered') return 'Stock looks fine';
  return 'No forecast yet';
};

const modelLabel = (model) => {
  if (model === 'prophet') return 'AI forecast';
  if (model === 'mean') return 'Recent average';
  return model || '—';
};

const pageCache = {
  horizon: 30,
  itemCode: '',
  runs: null,
  detail: null,
};

const restockPriority = (item, forecast) => {
  if (item?.status === 'OUT OF STOCK') {
    return 'URGENT';
  }
  if (forecast?.stockoutOn) {
    return 'HIGH';
  }
  return 'NORMAL';
};

const restockReason = (forecast) => {
  const qty = Number(forecast?.reorderQty) || 0;
  if (forecast?.stockoutOn) {
    return `Forecast restock: stock may run out ${formatFriendlyDate(forecast.stockoutOn, { relative: true })}. Suggested qty ${qty}.`;
  }
  return `Forecast restock for the current look-ahead. Suggested qty ${qty}.`;
};

export const Forecasts = () => {
  const {
    inventory,
    activeTab,
    movements,
    createManualProcurementRequest,
    actionLoading,
    actionError,
  } = useApp();
  const movementTick = movements.map((row) => row.id).join('|');
  const [horizon, setHorizon] = useState(pageCache.horizon);
  const [itemCode, setItemCode] = useState(pageCache.itemCode);
  const [runs, setRuns] = useState(pageCache.runs ?? []);
  const [detail, setDetail] = useState(pageCache.detail);
  const [loading, setLoading] = useState(pageCache.runs === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [creatingCode, setCreatingCode] = useState('');

  const selectedItem = inventory.find((item) => item.itemCode === itemCode);

  const loadList = async (nextHorizon = horizon) => {
    const data = await getForecasts({ horizon: nextHorizon });
    const list = Array.isArray(data) ? data : [];
    setRuns(list);
    pageCache.runs = list;
    pageCache.horizon = nextHorizon;
    return list;
  };

  const applyDetail = (data, code) => {
    setDetail(data);
    pageCache.detail = data;
    pageCache.itemCode = code;
  };

  const showForecast = async (code, nextHorizon) => {
    if (!code) {
      setDetail(null);
      pageCache.detail = null;
      pageCache.itemCode = '';
      return;
    }

    const cached = pageCache.detail;
    if (cached?.run?.itemCode === code && cached?.run?.horizonDays === nextHorizon) {
      applyDetail(cached, code);
      setLoading(false);
    }

    setError('');
    try {
      const data = await getForecast(code, { horizon: nextHorizon });
      applyDetail(data, code);
    } catch (err) {
      if (err?.status !== 422) {
        setError(err?.message || 'Unable to load this forecast.');
        return;
      }
      setRefreshing(true);
      try {
        const data = await refreshForecast(code, nextHorizon);
        applyDetail(data, code);
      } catch (buildErr) {
        setError(buildErr?.message || 'Unable to update this forecast.');
      } finally {
        setRefreshing(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!itemCode && inventory[0]?.itemCode) {
      setItemCode(inventory[0].itemCode);
    }
  }, [inventory, itemCode]);

  useEffect(() => {
    if (activeTab && activeTab !== 'forecasts') {
      return undefined;
    }
    if (!itemCode) {
      return undefined;
    }

    let cancelled = false;
    showForecast(itemCode, horizon).then(() => {
      if (!cancelled) {
        return loadList(horizon);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [itemCode, horizon, activeTab, movementTick]);

  const handleSelect = (code) => {
    setItemCode(code);
    setError('');
  };

  const handleCreatePr = async (forecast) => {
    const qty = Number(forecast?.reorderQty);
    if (!forecast?.itemCode || qty < 1 || forecast.procurementPrNumber || actionLoading) {
      return;
    }

    const item = inventory.find((row) => row.itemCode === forecast.itemCode);
    setCreatingCode(forecast.itemCode);
    setError('');
    try {
      await createManualProcurementRequest(
        forecast.itemCode,
        qty,
        restockReason(forecast),
        restockPriority(item, forecast),
      );
      await showForecast(itemCode || forecast.itemCode, horizon);
      await loadList(horizon);
    } catch (err) {
      setError(err?.message || 'Unable to create the restock request.');
    } finally {
      setCreatingCode('');
    }
  };

  const run = detail?.run;
  const points = detail?.points || [];
  const demandChart = useMemo(
    () => points.map((point) => ({
      ds: point.ds,
      actualDemand: point.actualDemand,
      yhat: point.yhat,
      yhatLower: point.yhatLower,
      yhatUpper: point.yhatUpper,
    })),
    [points],
  );
  const stockChart = useMemo(
    () => points.map((point) => ({
      ds: point.ds,
      onHandActual: point.onHandActual,
      onHandProjected: point.onHandProjected,
      minStock: run?.minStockLevel ?? selectedItem?.minStockLevel ?? 0,
    })),
    [points, run, selectedItem],
  );

  const selectedName = selectedItem?.description || run?.itemName || itemCode;
  const stockoutLabel = run?.stockoutOn
    ? formatFriendlyDate(run.stockoutOn, { relative: true })
    : 'Not expected';

  return (
    <div className="forecasts-page">
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">AI FORECASTING</span>
        </div>
      </div>

      <div className="filter-bar mb-4">
        <div className="flex gap-2 flex-wrap items-end">
          <div className="form-group mb-0">
            <label className="form-label" htmlFor="forecast-item">Item</label>
            <select
              id="forecast-item"
              className="form-select"
              value={itemCode}
              onChange={(event) => handleSelect(event.target.value)}
            >
              <option value="">Choose an item</option>
              {inventory.map((item) => (
                <option key={item.itemCode} value={item.itemCode}>
                  {item.description} ({item.itemCode})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="form-label" htmlFor="forecast-horizon">Look ahead</label>
            <select
              id="forecast-horizon"
              className="form-select"
              value={horizon}
              onChange={(event) => setHorizon(Number(event.target.value))}
            >
              <option value={14}>Next 2 weeks</option>
              <option value={30}>Next 30 days</option>
              <option value={60}>Next 60 days</option>
            </select>
          </div>
          <p className="text-xs text-secondary">
            {refreshing
              ? 'Updating…'
              : run?.generatedAt
                ? `Last updated ${formatFriendlyDateTime(run.generatedAt)}`
                : 'Updates automatically'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state mb-4">
          <p>Loading forecasts…</p>
        </div>
      ) : null}

      {error || actionError ? (
        <div className="empty-state mb-4">
          <p>{error || actionError}</p>
        </div>
      ) : null}

      {run?.status === 'error' ? (
        <div className="empty-state mb-4">
          <p>{run.error || 'The AI forecast tool is not available. Items with little history still use a recent average.'}</p>
        </div>
      ) : null}

      <div className="panel-card mb-4">
        <div className="panel-header">
          <span className="panel-title">
            <AlertTriangle className="w-5 h-5 text-warning" /> Items that may need restocking
          </span>
        </div>
        {runs.length === 0 && !loading ? (
          <div className="empty-state">
            <p>No forecasts yet. Choose an item above and one will be created automatically.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table table-stack">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Method</th>
                  <th>May run out</th>
                  <th className="text-center">Order this many</th>
                  <th>Procurement</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((row) => (
                  <tr
                    key={`${row.itemCode}-${row.horizonDays}`}
                    className={row.itemCode === itemCode ? 'bg-amber-50' : undefined}
                  >
                    <td data-label="Item">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => handleSelect(row.itemCode)}>
                        {row.itemName || row.itemCode}
                      </button>
                      <div className="text-xs text-secondary">{row.itemCode}</div>
                    </td>
                    <td data-label="Method">{modelLabel(row.model)}</td>
                    <td data-label="May run out">
                      {row.stockoutOn ? formatFriendlyDate(row.stockoutOn, { relative: true }) : 'Not expected'}
                    </td>
                    <td data-label="Order this many" className="text-center">{row.reorderQty}</td>
                    <td data-label="Procurement">
                      {row.procurementPrNumber ? (
                        row.procurementPrNumber
                      ) : row.reorderQty > 0 ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={actionLoading}
                          onClick={() => handleCreatePr(row)}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          {creatingCode === row.itemCode ? 'Creating…' : 'Create PR'}
                        </button>
                      ) : (
                        'None yet'
                      )}
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${badgeClass(row.forecastBadge)}`}>{statusLabel(row.forecastBadge)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {run ? (
        <>
          <p className="text-sm font-bold mb-2">
            Selected: {selectedName} {itemCode ? `(${itemCode})` : ''}
          </p>
          <div className="grid-3 mb-4">
            <div className="kpi-card">
              <div className="kpi-header"><span className="kpi-title">SUPPLIER LEAD TIME</span></div>
              <div className="kpi-value">{run.leadTimeDays} days</div>
              <div className="kpi-footer">Typical wait after we place an order</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-header"><span className="kpi-title">UNITS TO ORDER</span></div>
              <div className="kpi-value">{run.reorderQty}</div>
              <div className="kpi-footer">
                {run.procurementPrNumber
                  ? `Already requested as ${run.procurementPrNumber}`
                  : run.reorderQty > 0
                    ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={actionLoading}
                        onClick={() => handleCreatePr(run)}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {creatingCode === run.itemCode ? 'Creating…' : 'Create restock request'}
                      </button>
                    )
                    : 'No extra order needed right now'}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-header"><span className="kpi-title">MAY RUN OUT</span></div>
              <div className="kpi-value">{run.stockoutOn ? formatChartTick(run.stockoutOn) : 'None'}</div>
              <div className="kpi-footer">{run.stockoutOn ? stockoutLabel : 'Stock is projected to stay above zero'}</div>
            </div>
          </div>
        </>
      ) : !loading && itemCode ? (
        <div className="empty-state mb-4">
          <p>Building this item’s forecast…</p>
        </div>
      ) : null}

      {demandChart.length > 0 ? (
        <div className="grid-2 mb-4">
          <div className="panel-card">
            <div className="panel-header">
              <span className="panel-title">
                <TrendingUp className="w-5 h-5 text-success" /> Units going out vs forecast
              </span>
            </div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={demandChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#A7A9AC" />
                  <XAxis
                    dataKey="ds"
                    stroke="#000000"
                    minTickGap={28}
                    tickFormatter={formatChartTick}
                    tick={{ fill: '#000000', fontWeight: 600, fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} stroke="#000000" tick={{ fill: '#000000', fontWeight: 600 }} />
                  <Tooltip
                    contentStyle={chartTip}
                    labelFormatter={(value) => formatFriendlyDate(value)}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="yhatLower" name="Low estimate" stroke="#A7A9AC" strokeDasharray="3 3" dot={false} />
                  <Line type="monotone" dataKey="yhatUpper" name="High estimate" stroke="#A7A9AC" strokeDasharray="3 3" dot={false} />
                  <Line type="monotone" dataKey="yhat" name="Forecast" stroke="#F58700" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="actualDemand" name="Actually released" stroke="#0F766E" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="panel-card">
            <div className="panel-header">
              <span className="panel-title">
                <Activity className="w-5 h-5 text-blue" /> Stock on hand over time
              </span>
            </div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stockChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#A7A9AC" />
                  <XAxis
                    dataKey="ds"
                    stroke="#000000"
                    minTickGap={28}
                    tickFormatter={formatChartTick}
                    tick={{ fill: '#000000', fontWeight: 600, fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} stroke="#000000" tick={{ fill: '#000000', fontWeight: 600 }} />
                  <Tooltip
                    contentStyle={chartTip}
                    labelFormatter={(value) => formatFriendlyDate(value)}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="onHandActual" name="On hand so far" stroke="#0F766E" strokeWidth={2} />
                  <Line type="monotone" dataKey="onHandProjected" name="Projected" stroke="#F58700" strokeWidth={2} />
                  <Line type="monotone" dataKey="minStock" name="Minimum" stroke="#D97706" strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
