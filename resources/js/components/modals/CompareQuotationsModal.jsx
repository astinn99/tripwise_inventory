import React from 'react';
import { useApp } from '../../context/AppContext';
import { FileSpreadsheet, Truck, Shield, DollarSign, CheckCircle2, Award, Star } from 'lucide-react';
import { Modal } from '../ui/Modal';

export const CompareQuotationsModal = () => {
  const { activeModal, setActiveModal, modalData, quotations, selectSupplierAndCreatePO } = useApp();

  if (activeModal !== 'compare_quotes' || !modalData) return null;

  const pr = modalData;
  const relatedQuotes = quotations.filter(q => q.procurementId === pr.id);
  const lowestPrice = relatedQuotes.length > 0
    ? Math.min(...relatedQuotes.map(q => Number(q.totalPrice)))
    : 0;

  const handleSelectSupplier = (quoteId) => {
    selectSupplierAndCreatePO(pr.id, quoteId);
    setActiveModal(null);
  };

  return (
    <Modal
      onClose={() => setActiveModal(null)}
      icon={FileSpreadsheet}
      tone="blue"
      size="xl"
      title={`Quotation Comparison — ${pr.id}`}
      subtitle="Review supplier offers, terms, and best value before creating a purchase order."
      footer={(
        <button onClick={() => setActiveModal(null)} className="btn btn-outline btn-sm">Close</button>
      )}
    >
      <div className="modal-hero">
        <div className="modal-hero-main">
          <div className="modal-kicker">{pr.department}</div>
          <h4>{pr.itemName}</h4>
          <div className="modal-chip-row">
            <span className="modal-chip">Qty needed: {pr.quantity}</span>
            <span className="modal-chip">Priority: {pr.priority}</span>
          </div>
        </div>
        <div className="modal-hero-aside">
          <span className="modal-stat-label">Estimated budget</span>
          <span className="modal-stat-value is-emerald">₱{Number(pr.estimatedCost || 0).toLocaleString()}</span>
        </div>
      </div>

      {relatedQuotes.length === 0 ? (
        <div className="modal-empty">
          <Award className="w-5 h-5" />
          <p>No quotations received yet. Send this request to vendor portals so suppliers can quote.</p>
        </div>
      ) : (
        <div className="grid-3 gap-4">
          {relatedQuotes.map((quote) => {
            const isBestValue = Number(quote.totalPrice) === lowestPrice;
            const cardClass = quote.status === 'Selected'
              ? 'modal-quote-card is-selected'
              : isBestValue
                ? 'modal-quote-card is-best'
                : 'modal-quote-card';

            return (
              <div key={quote.id} className={cardClass}>
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-mono font-bold">{quote.id}</span>
                        {isBestValue && (
                          <span className="badge badge-normal">
                            <Award className="w-3 h-3" /> Best Price
                          </span>
                        )}
                      </div>
                      <h5 className="text-sm font-extrabold">{quote.supplierName}</h5>
                    </div>
                    <span className="badge badge-warning">
                      <Star className="w-3 h-3" /> {quote.qualityRating}
                    </span>
                  </div>

                  <div className="modal-total mb-3">
                    <span>Total quotation</span>
                    <strong>₱{Number(quote.totalPrice).toLocaleString()}</strong>
                  </div>
                  <p className="text-xs mb-3">₱{Number(quote.unitPrice).toLocaleString()} / unit</p>

                  <div className="modal-dl">
                    <div className="modal-dl-row">
                      <span><Truck className="w-3.5 h-3.5" /> Delivery</span>
                      <strong>{quote.deliveryTimeDays} days</strong>
                    </div>
                    <div className="modal-dl-row">
                      <span><Shield className="w-3.5 h-3.5" /> Warranty</span>
                      <strong>{quote.warranty}</strong>
                    </div>
                    <div className="modal-dl-row">
                      <span><DollarSign className="w-3.5 h-3.5" /> Payment</span>
                      <strong>{quote.paymentTerms}</strong>
                    </div>
                  </div>

                  {quote.notes && (
                    <p className="text-xs italic mt-3">{quote.notes}</p>
                  )}
                </div>

                <button
                  onClick={() => handleSelectSupplier(quote.id)}
                  className={`btn ${quote.status === 'Selected' ? 'btn-success' : 'btn-primary'} btn-sm w-full`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {quote.status === 'Selected' ? 'Supplier Selected' : 'Select & Create PO'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};
