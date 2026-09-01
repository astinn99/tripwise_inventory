import React from 'react';
import { useApp } from '../context/AppContext';
import { FileSpreadsheet, CheckCircle2, Star } from 'lucide-react';
import { ItemThumb } from '../components/ui/ItemThumb';
import { normalizePriority, priorityBadgeClass, sortByPriority } from '../services/priority';

const hasValue = (value) => {
  const text = String(value || '').trim();
  return text !== '' && text.toLowerCase() !== 'none';
};

export const Quotations = () => {
  const { quotations, selectSupplierAndCreatePO, searchQuery } = useApp();
  const query = searchQuery.toLowerCase();

  const filteredQuotes = sortByPriority(quotations.filter((quote) =>
    !String(quote.id || '').startsWith('tmp-') && (
      quote.id.toLowerCase().includes(query) ||
      quote.supplierName.toLowerCase().includes(query) ||
      quote.item.toLowerCase().includes(query) ||
      quote.procurementId.toLowerCase().includes(query)
    )
  ));

  return (
    <div className="quotations-page">
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

        {filteredQuotes.length === 0 ? (
          <div className="empty-state">
            <p>No vendor quotations match this search.</p>
          </div>
        ) : (
          <div className="quotations-list">
            {filteredQuotes.map((quote) => {
              const warranty = quote.warrantyLabel || quote.warranty;
              const selected = quote.status === 'Selected';

              return (
                <article key={quote.id} className={`quote-eval-card ${selected ? 'is-selected' : ''}`}>
                  <div className="quote-eval-item">
                    <ItemThumb src={quote.imageUrl} alt={quote.item} />
                    <div className="quote-eval-copy">
                      <div className="quote-eval-ids">
                        <span className="quote-eval-qt">{quote.id}</span>
                        <span className="quote-eval-pr">{quote.procurementId}</span>
                        <span className={`badge ${priorityBadgeClass(quote.priority)}`}>{normalizePriority(quote.priority)}</span>
                      </div>
                      <h4 className="quote-eval-title">{quote.item}</h4>
                      <p className="quote-eval-sub">{quote.supplierName} · Qty {quote.quantity}</p>
                    </div>
                  </div>

                  <div className="quote-eval-offer">
                    <strong>₱{Number(quote.totalPrice).toLocaleString()}</strong>
                    <span>₱{Number(quote.unitPrice).toLocaleString()} / unit</span>
                  </div>

                  <div className="quote-eval-meta">
                    <span className="quote-eval-chip">{quote.deliveryTimeDays} day lead</span>
                    {hasValue(warranty) ? <span className="quote-eval-chip">{warranty}</span> : null}
                    {quote.manualFileUrl ? (
                      <a href={quote.manualFileUrl} target="_blank" rel="noreferrer" className="quote-eval-chip is-link">Manual</a>
                    ) : null}
                    {quote.qualityRating ? (
                      <span className="quote-eval-chip">
                        <Star className="w-3 h-3" /> {quote.qualityRating}
                      </span>
                    ) : null}
                    <span className={`badge badge-${selected ? 'supplier-selected' : 'info'}`}>{quote.status}</span>
                    {quote.itemPhotoUrls?.length ? (
                      <div className="quote-photo-strip">
                        {quote.itemPhotoUrls.map((url) => (
                          <ItemThumb key={url} src={url} alt={`${quote.supplierName} — ${quote.item}`} />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="quote-eval-aside">
                    {selected ? (
                      <span className="quote-eval-selected">Selected</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => selectSupplierAndCreatePO(quote.procurementId, quote.id)}
                        className="btn btn-primary btn-sm"
                        title="Select supplier and create purchase order"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Select
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
