import React from 'react';
import { Package, TrendingUp, ShoppingCart, FileCheck, AlertTriangle, Award } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function DashboardCharts({
  inventoryOverviewData,
  movementTrendData,
  procurementStatusData,
  poStatusData,
  lowStockTrendData,
  supplierPerfData,
}) {
  return (
    <>
      <div className="grid-2 mb-6">
        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><Package className="w-5 h-5 text-blue" /> Inventory Stock Distribution</span>
          </div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryOverviewData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#A7A9AC" />
                <XAxis dataKey="name" stroke="#000000" tick={{ fill: '#000000', fontWeight: 600 }} />
                <YAxis allowDecimals={false} stroke="#000000" tick={{ fill: '#000000', fontWeight: 600 }} />
                <Tooltip contentStyle={{ background: '#FFFFFF', borderColor: '#A7A9AC', borderRadius: 6, color: '#000000', fontWeight: 700 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {inventoryOverviewData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><TrendingUp className="w-5 h-5 text-success" /> Receiving vs Releasing Activity</span>
          </div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={movementTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#A7A9AC" />
                <XAxis dataKey="day" stroke="#000000" tick={{ fill: '#000000', fontWeight: 600 }} />
                <YAxis allowDecimals={false} stroke="#000000" tick={{ fill: '#000000', fontWeight: 600 }} />
                <Tooltip contentStyle={{ background: '#FFFFFF', borderColor: '#A7A9AC', borderRadius: 6, color: '#000000', fontWeight: 700 }} />
                <Area type="monotone" dataKey="receiving" stroke="#B3EF0B" fill="rgba(179, 239, 11, 0.18)" />
                <Area type="monotone" dataKey="releasing" stroke="#F58700" fill="rgba(245, 135, 0, 0.15)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid-3 mb-6">
        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><ShoppingCart className="w-5 h-5 text-blue" /> PSM Sourcing Status</span>
          </div>
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={procurementStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {procurementStatusData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#FFFFFF', borderColor: '#A7A9AC', borderRadius: 6, color: '#000000', fontWeight: 700 }} />
                <Legend tick={{ fill: '#000000' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><FileCheck className="w-5 h-5 text-blue" /> Purchase Orders Lifecycle</span>
          </div>
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={poStatusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#A7A9AC" />
                <XAxis type="number" allowDecimals={false} stroke="#000000" tick={{ fill: '#000000' }} />
                <YAxis dataKey="status" type="category" stroke="#000000" width={72} tick={{ fontSize: 10, fill: '#000000', fontWeight: 700 }} />
                <Tooltip contentStyle={{ background: '#FFFFFF', borderColor: '#A7A9AC', borderRadius: 6, color: '#000000', fontWeight: 700 }} />
                <Bar dataKey="count" fill="#F58700" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><AlertTriangle className="w-5 h-5 text-warning" /> Low Stock Trend</span>
          </div>
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lowStockTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#A7A9AC" />
                <XAxis dataKey="week" stroke="#000000" tick={{ fill: '#000000', fontWeight: 600 }} />
                <YAxis allowDecimals={false} stroke="#000000" tick={{ fill: '#000000', fontWeight: 600 }} />
                <Tooltip contentStyle={{ background: '#FFFFFF', borderColor: '#A7A9AC', borderRadius: 6, color: '#000000', fontWeight: 700 }} />
                <Line type="monotone" dataKey="count" stroke="#D97706" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="panel-card mb-6">
        <div className="panel-header">
          <span className="panel-title"><Award className="w-5 h-5 text-blue" /> Vendor & Supplier Performance Scores</span>
        </div>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={supplierPerfData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#A7A9AC" />
              <XAxis dataKey="name" stroke="#000000" tick={{ fill: '#000000', fontWeight: 700 }} />
              <YAxis allowDecimals={false} domain={[60, 100]} stroke="#000000" tick={{ fill: '#000000', fontWeight: 600 }} />
              <Tooltip contentStyle={{ background: '#FFFFFF', borderColor: '#A7A9AC', borderRadius: 6, color: '#000000', fontWeight: 700 }} />
              <Legend />
              <Bar dataKey="rating" name="Overall Score %" fill="#F58700" radius={[4, 4, 0, 0]} />
              <Bar dataKey="quality" name="Quality Score %" fill="#B3EF0B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="delivery" name="On-Time Delivery %" fill="#D97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
