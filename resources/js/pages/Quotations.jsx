import React from 'react';
import { useApp } from '../context/AppContext';
import { FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { ItemIdentity, ItemThumb } from '../components/ui/ItemThumb';

export const Quotations = () => {
  const { quotations, selectSupplierAndCreatePO, searchQuery } = useApp();

  const filteredQuotes = quotations.filter(q =>
    !String(q.id || '').startsWith('tmp-') && (
      q.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.procurementId.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="quotations-page">
      {/* PSM Banner */}
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">PSM SOURCING</span>
          <div>
            <h2 className="subsystem-heading">Supplier Quotations & RFQ Evaluation</h2>
            <p className="subsystem-subtext">Review submitted vendor price quotations, warranty terms, and lead times to select preferred supplier.</p>
          </div>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <FileSpreadsheet className="w-5 h-5 text-blue" /> Submitted Vendor Price Quotations ({filteredQuotes.length})
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Quotation ID</th>
                <th>Procurement Ref</th>
                <th>Supplier Name</th>
                <th>Item & Qty</th>
                <th>Vendor Photos</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Total Price</th>
                <th>Delivery Lead Time</th>
                <th>Warranty</th>
                <th>Vendor Rating</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map(q => (
                <tr key={q.id}>
                  <td className="font-mono text-xs text-blue font-bold">{q.id}</td>
                  <td className="font-mono text-xs text-purple-400 font-semibold">{q.procurementId}</td>
                  <td className="font-bold text-xs text-primary">{q.supplierName}</td>
                  <td>
                    <ItemIdentity
                      src={q.imageUrl}
                      name={q.item}
                      extra={`Qty: ${q.quantity}`}
                    />
                  </td>
                  <td>
                    {q.itemPhotoUrls?.length ? (
                      <div className="quote-photo-strip">
                        {q.itemPhotoUrls.map((url) => (
                          <ItemThumb key={url} src={url} alt={`${q.supplierName} — ${q.item}`} />
                        ))}
                      </div>
                    ) : (
                      <span className="quote-photo-empty">None</span>
                    )}
                  </td>
                  <td className="text-right font-mono text-xs text-secondary">₱{Number(q.unitPrice).toLocaleString()}</td>
                  <td className="text-right font-mono text-xs text-success font-bold">₱{Number(q.totalPrice).toLocaleString()}</td>
                  <td className="text-xs text-secondary">{q.deliveryTimeDays} days</td>
                  <td className="text-xs text-secondary">{q.warrantyLabel || q.warranty || '—'}</td>
                  <td><span className="badge badge-normal">★ {q.qualityRating}</span></td>
                  <td>
                    <span className={`badge badge-${q.status === 'Selected' ? 'supplier-selected' : 'info'}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="text-right">
                    {q.status !== 'Selected' && (
                      <button
                        onClick={() => selectSupplierAndCreatePO(q.procurementId, q.id)}
                        className="btn btn-primary btn-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Select & Create PO
                      </button>
                    )}
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
