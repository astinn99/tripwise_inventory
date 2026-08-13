import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FileText, Send, CheckCircle2, ShoppingBag, Building, Pencil } from 'lucide-react';
import { Modal } from '../components/ui/Modal';

export const VendorPortal = ({ activeTab, setActiveTab }) => {
  const {
    opportunities,
    quotations,
    purchaseOrders,
    submitSupplierQuotation,
    updateSupplierQuotation,
    supplierConfirmPO,
    user
  } = useApp();

  const [selectedOpp, setSelectedOpp] = useState(null);
  const [editingQuote, setEditingQuote] = useState(null);

  const emptyQuoteForm = {
    unitPrice: '',
    warranty: '',
    deliveryTimeDays: '',
    paymentTerms: '30 Days Net',
    notes: ''
  };

  const [quoteForm, setQuoteForm] = useState(emptyQuoteForm);

  const closeQuoteModal = () => {
    setSelectedOpp(null);
    setEditingQuote(null);
    setQuoteForm(emptyQuoteForm);
  };

  const openEditQuote = (quote) => {
    setSelectedOpp(null);
    setEditingQuote(quote);
    setQuoteForm({
      unitPrice: quote.unitPrice ?? '',
      warranty: quote.warranty || '',
      deliveryTimeDays: quote.deliveryTimeDays ?? '',
      paymentTerms: quote.paymentTerms || '30 Days Net',
      notes: quote.notes || ''
    });
  };

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOpp && !editingQuote) return;

    try {
      if (editingQuote) {
        await updateSupplierQuotation(editingQuote.id, {
          unitPrice: Number(quoteForm.unitPrice),
          warranty: quoteForm.warranty,
          deliveryTimeDays: Number(quoteForm.deliveryTimeDays),
          paymentTerms: quoteForm.paymentTerms,
          notes: quoteForm.notes
        });
      } else {
        await submitSupplierQuotation({
          procurementId: selectedOpp.prNumber,
          supplierId: user?.supplierId,
          supplierName: user?.supplierName,
          item: selectedOpp.itemName || selectedOpp.title,
          quantity: selectedOpp.quantity,
          unitPrice: Number(quoteForm.unitPrice),
          totalPrice: Number(quoteForm.unitPrice) * selectedOpp.quantity,
          warranty: quoteForm.warranty,
          deliveryTimeDays: Number(quoteForm.deliveryTimeDays),
          qualityRating: 4.8,
          paymentTerms: quoteForm.paymentTerms,
          notes: quoteForm.notes
        });
      }

      closeQuoteModal();
      setActiveTab('my_quotes');
    } catch {
      // Action error is shown by AppContext.
    }
  };

  const quoteTarget = editingQuote || selectedOpp;
  const quoteQty = editingQuote?.quantity ?? selectedOpp?.quantity ?? 0;

  return (
    <div className="vendor-portal-page">
      <div className="page-header">
        <div className="page-header-title-group">
          <h2 className="page-title">{user?.supplierName || 'Vendor'}</h2>
          <p className="page-description">
            Review open opportunities, submit quotations, and confirm awarded purchase orders.
          </p>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div>
          <div className="grid-3 mb-4">
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Open RFQ Opportunities</span>
                <ShoppingBag className="w-5 h-5 text-blue" />
              </div>
              <div className="kpi-value text-blue">{opportunities.length}</div>
              <div className="kpi-footer">Available for bidding</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">My Submitted Quotes</span>
                <FileText className="w-5 h-5 text-blue" />
              </div>
              <div className="kpi-value text-blue">{quotations.length}</div>
              <div className="kpi-footer">Active RFQs</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Awarded Purchase Orders</span>
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div className="kpi-value text-success">{purchaseOrders.length}</div>
              <div className="kpi-footer">Active Procurement POs</div>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <span className="panel-title"><ShoppingBag className="w-5 h-5 text-blue" /> Open Sourcing Opportunities</span>
            </div>
            <div className="space-y-3">
              {opportunities.length === 0 && (
                <p className="text-xs text-secondary p-4">No open RFQs available. Submitted items now appear under My Quotes.</p>
              )}
              {opportunities.map(opp => (
                <div key={opp.id} className="bg-main p-4 rounded border border-color flex justify-between items-center">
                  <div>
                    <span className="text-xs font-mono text-blue">{opp.prNumber} | {opp.itemCode} | Deadline: {opp.deadline}</span>
                    <h4 className="text-sm font-bold text-primary">{opp.itemName || opp.title}</h4>
                    <p className="text-xs text-secondary">{opp.quantity} units · {opp.requirements}</p>
                  </div>
                  <button
                    onClick={() => {
                      setQuoteForm(emptyQuoteForm);
                      setSelectedOpp(opp);
                      setActiveTab('opportunities');
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    Submit Quotation
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'opportunities' && (
        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><ShoppingBag className="w-5 h-5 text-blue" /> Open Sourcing Bidding Opportunities</span>
          </div>

          <div className="grid-2 gap-4">
            {opportunities.length === 0 && (
              <p className="text-xs text-secondary p-4">No open RFQs available. Submitted items now appear under My Quotes.</p>
            )}
            {opportunities.map(opp => (
              <div key={opp.id} className="bg-main p-4 rounded border border-color">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono text-blue font-bold">{opp.prNumber}</span>
                  <span className="badge badge-normal">{opp.category || 'RFQ'}</span>
                </div>
                <h4 className="text-base font-bold text-primary mb-1">{opp.itemName || opp.title}</h4>
                <div className="text-xs text-secondary space-y-1 mb-3">
                  <div>Item Code: <strong className="text-primary font-mono">{opp.itemCode || '—'}</strong></div>
                  <div>Quantity Needed: <strong className="text-primary">{opp.quantity} units</strong></div>
                  <div>Estimated Budget: <strong className="text-primary">{opp.budgetRange}</strong></div>
                  <div>Requirements: <em>{opp.requirements}</em></div>
                </div>
                <button
                  onClick={() => {
                    setQuoteForm(emptyQuoteForm);
                    setSelectedOpp(opp);
                  }}
                  className="btn btn-primary btn-sm w-full"
                >
                  <Send className="w-3.5 h-3.5" /> Submit Formal Quotation
                </button>
              </div>
            ))}
          </div>

        </div>
      )}

      {activeTab === 'my_quotes' && (
        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><FileText className="w-5 h-5 text-blue" /> Submitted Quotations Log</span>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Quotation ID</th>
                  <th>Procurement Ref</th>
                  <th>Vendor</th>
                  <th>Item</th>
                  <th className="text-right">Total Price</th>
                  <th>Delivery</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map(q => (
                  <tr key={q.id}>
                    <td className="font-mono text-xs text-blue font-bold">{q.id}</td>
                    <td className="font-mono text-xs text-secondary">{q.procurementId}</td>
                    <td className="font-bold text-xs text-primary">{q.supplierName}</td>
                    <td className="text-xs text-primary">{q.item} (x{q.quantity})</td>
                    <td className="text-right font-mono text-xs text-success font-bold">₱{Number(q.totalPrice).toLocaleString()}</td>
                    <td className="text-xs text-secondary">{q.deliveryTimeDays} days</td>
                    <td>
                      <span className={`badge badge-${q.status === 'Selected' ? 'normal' : 'info'}`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="text-right">
                      {q.canEdit && (
                        <button
                          type="button"
                          onClick={() => openEditQuote(q)}
                          className="btn btn-outline btn-sm"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'purchase_orders' && (
        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><CheckCircle2 className="w-5 h-5 text-success" /> Confirmed Purchase Orders</span>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Vendor</th>
                  <th>Total Cost</th>
                  <th>Delivery Date</th>
                  <th>Finance Status</th>
                  <th>PO Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map(po => (
                  <tr key={po.poNumber}>
                    <td className="font-mono text-xs text-blue font-bold">{po.poNumber}</td>
                    <td className="font-bold text-xs text-primary">{po.supplier}</td>
                    <td className="font-mono text-xs text-success font-bold">₱{Number(po.totalCost).toLocaleString()}</td>
                    <td className="text-xs text-secondary">{po.deliveryDate}</td>
                    <td>
                      <span className={`badge badge-${po.financeApprovalStatus.toLowerCase().replace(/ /g, '-')}`}>
                        {po.financeApprovalStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${po.poStatus.toLowerCase().replace(/ /g, '-')}`}>
                        {po.poStatus}
                      </span>
                    </td>
                    <td className="text-right">
                      {po.poStatus === 'Sent to Supplier' && (
                        <button
                          onClick={() => supplierConfirmPO(po.poNumber)}
                          className="btn btn-success btn-sm"
                        >
                          Confirm & Schedule Shipment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {quoteTarget && (
        <Modal
          asForm
          onSubmit={handleQuoteSubmit}
          onClose={closeQuoteModal}
          icon={editingQuote ? Pencil : Send}
          tone="rose"
          size="md"
          title={editingQuote ? `Edit Quotation — ${editingQuote.id}` : `Submit RFQ Quotation — ${selectedOpp.id}`}
          subtitle={editingQuote
            ? 'Update unit price, lead time, and warranty before a supplier is selected.'
            : 'Enter unit price, lead time, and warranty terms for this opportunity.'}
          footer={(
            <>
              <button type="button" onClick={closeQuoteModal} className="btn btn-outline btn-sm">Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm">
                {editingQuote ? 'Save Changes' : 'Submit Quotation'}
              </button>
            </>
          )}
        >
          <div className="modal-hero">
            <div className="modal-hero-main">
              <div className="modal-kicker">
                {editingQuote ? editingQuote.procurementId : `${selectedOpp.prNumber} · ${selectedOpp.itemCode}`}
              </div>
              <h4>{editingQuote ? editingQuote.item : (selectedOpp.itemName || selectedOpp.title)}</h4>
              <div className="modal-chip-row">
                <span className="modal-chip">Qty: {quoteQty}</span>
                <span className="modal-chip">{user?.supplierName || 'Vendor account'}</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Unit price (₱)</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              className="form-control font-bold font-mono"
              value={quoteForm.unitPrice}
              onChange={(e) => setQuoteForm({ ...quoteForm, unitPrice: e.target.value })}
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Delivery lead time (days)</label>
              <input
                type="number"
                required
                className="form-control"
                value={quoteForm.deliveryTimeDays}
                onChange={(e) => setQuoteForm({ ...quoteForm, deliveryTimeDays: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Warranty terms</label>
              <input
                type="text"
                required
                className="form-control"
                value={quoteForm.warranty}
                onChange={(e) => setQuoteForm({ ...quoteForm, warranty: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Special notes / specifications</label>
            <textarea
              className="form-control"
              rows="2"
              value={quoteForm.notes}
              onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
            />
          </div>

          <div className="modal-total">
            <span>Total quoted value</span>
            <strong>₱{(Number(quoteForm.unitPrice || 0) * quoteQty).toLocaleString()}</strong>
          </div>
        </Modal>
      )}

      {(activeTab === 'messages' || activeTab === 'profile') && (
        <div className="panel-card p-6 text-center text-secondary">
          <Building className="w-12 h-12 text-blue mx-auto mb-2" />
          <h3 className="text-base font-bold text-primary capitalize">{activeTab} Panel</h3>
          <p className="text-xs text-secondary mt-1">Vendor account details and communication thread with PureRide Supply Chain team.</p>
        </div>
      )}
    </div>
  );
};
