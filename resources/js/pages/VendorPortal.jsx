import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText,
  Send,
  CheckCircle2,
  ShoppingBag,
  Building,
  Pencil,
  Clock,
  Inbox,
  MessageSquare,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { ItemIdentity, ItemThumb } from '../components/ui/ItemThumb';

const TAB_COPY = {
  dashboard: 'Review open RFQs, submitted quotes, and awarded purchase orders.',
  opportunities: 'Browse open sourcing requests and submit a formal quotation before the deadline.',
  my_quotes: 'Track quotations you have submitted and edit them until a supplier is selected.',
  purchase_orders: 'Confirm awarded purchase orders and schedule shipment.',
  messages: 'Message threads with the TripWise supply chain team will appear here.',
  profile: 'Company profile and portal account details will appear here.',
};

const quoteBadgeClass = (status) => {
  if (status === 'Selected') return 'normal';
  if (status === 'Rejected') return 'rejected';
  return 'info';
};

const deadlineState = (deadline) => {
  if (!deadline) {
    return { label: 'No deadline', tone: '' };
  }

  const days = Math.ceil((new Date(`${deadline}T23:59:59`) - new Date()) / 86400000);
  if (Number.isNaN(days)) {
    return { label: deadline, tone: '' };
  }
  if (days < 0) {
    return { label: `Overdue · ${deadline}`, tone: 'is-overdue' };
  }
  if (days === 0) {
    return { label: `Due today · ${deadline}`, tone: 'is-soon' };
  }
  if (days <= 3) {
    return { label: `${days} day${days === 1 ? '' : 's'} left · ${deadline}`, tone: 'is-soon' };
  }

  return { label: deadline, tone: '' };
};

const OpportunityCard = ({ opp, compact = false, onQuote }) => {
  const due = deadlineState(opp.deadline);
  const cta = (
    <button type="button" onClick={() => onQuote(opp)} className="btn btn-primary btn-sm vendor-rfq-cta">
      <Send className="w-3.5 h-3.5" /> {compact ? 'Submit Quotation' : 'Submit Formal Quotation'}
    </button>
  );

  return (
    <article className={`vendor-rfq-card ${compact ? 'is-compact' : ''}`}>
      <div className="vendor-rfq-media">
        <ItemThumb src={opp.imageUrl} alt={opp.itemName || opp.title} size={compact ? 'md' : 'card'} />
      </div>

      <div className="vendor-rfq-body">
        <div className="vendor-rfq-top">
          <span className="modal-kicker">{opp.prNumber}</span>
          <span className={`vendor-deadline ${due.tone}`}>
            <Clock className="w-3 h-3" />
            {due.label}
          </span>
        </div>
        <h4 className="vendor-rfq-title">{opp.itemName || opp.title}</h4>
        <div className="vendor-rfq-chips">
          <span className="badge badge-normal">{opp.category || 'RFQ'}</span>
          {opp.itemCode ? <span className="modal-chip">{opp.itemCode}</span> : null}
          {opp.priority && opp.priority !== 'NORMAL' ? (
            <span className={`badge ${opp.priority === 'URGENT' ? 'badge-urgent' : 'badge-for-procurement'}`}>{opp.priority}</span>
          ) : null}
        </div>

        {!compact && (
          <>
            <div className="vendor-rfq-stats">
              <div>
                <span>Qty needed</span>
                <strong>{opp.quantity} units</strong>
              </div>
              <div>
                <span>Budget</span>
                <strong>{opp.budgetRange || '—'}</strong>
              </div>
              <div>
                <span>Deadline</span>
                <strong className={due.tone}>{opp.deadline || '—'}</strong>
              </div>
            </div>
            {opp.requirements ? (
              <p className="vendor-rfq-notes">{opp.requirements}</p>
            ) : null}
            {cta}
          </>
        )}

        {compact && (
          <p className="vendor-rfq-notes is-compact">
            {opp.quantity} units{opp.budgetRange ? ` · ${opp.budgetRange}` : ''}
            {opp.requirements ? ` · ${opp.requirements}` : ''}
          </p>
        )}
      </div>
      {compact ? cta : null}
    </article>
  );
};

export const VendorPortal = ({ activeTab, setActiveTab }) => {
  const {
    opportunities,
    quotations,
    purchaseOrders,
    submitSupplierQuotation,
    updateSupplierQuotation,
    supplierConfirmPO,
    user,
  } = useApp();

  const [selectedOpp, setSelectedOpp] = useState(null);
  const [editingQuote, setEditingQuote] = useState(null);

  const emptyQuoteForm = {
    unitPrice: '',
    warrantyMonths: '12',
    warranty: '',
    warrantyFile: null,
    deliveryTimeDays: '',
    paymentTerms: '30 Days Net',
    notes: '',
  };

  const [quoteForm, setQuoteForm] = useState(emptyQuoteForm);

  const awaitingConfirm = purchaseOrders.filter((po) => po.poStatus === 'Sent to Supplier');

  const closeQuoteModal = () => {
    setSelectedOpp(null);
    setEditingQuote(null);
    setQuoteForm(emptyQuoteForm);
  };

  const openQuote = (opp) => {
    setEditingQuote(null);
    setQuoteForm(emptyQuoteForm);
    setSelectedOpp(opp);
  };

  const openEditQuote = (quote) => {
    setSelectedOpp(null);
    setEditingQuote(quote);
    setQuoteForm({
      unitPrice: quote.unitPrice ?? '',
      warrantyMonths: quote.warrantyMonths ? String(quote.warrantyMonths) : '12',
      warranty: quote.warranty || '',
      warrantyFile: null,
      deliveryTimeDays: quote.deliveryTimeDays ?? '',
      paymentTerms: quote.paymentTerms || '30 Days Net',
      notes: quote.notes || '',
    });
  };

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOpp && !editingQuote) return;

    try {
      if (editingQuote) {
        await updateSupplierQuotation(editingQuote.id, {
          unitPrice: Number(quoteForm.unitPrice),
          warrantyMonths: Number(quoteForm.warrantyMonths),
          warranty: quoteForm.warranty,
          warrantyFile: quoteForm.warrantyFile,
          deliveryTimeDays: Number(quoteForm.deliveryTimeDays),
          paymentTerms: quoteForm.paymentTerms,
          notes: quoteForm.notes,
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
          warrantyMonths: Number(quoteForm.warrantyMonths),
          warranty: quoteForm.warranty,
          warrantyFile: quoteForm.warrantyFile,
          deliveryTimeDays: Number(quoteForm.deliveryTimeDays),
          qualityRating: 4.8,
          paymentTerms: quoteForm.paymentTerms,
          notes: quoteForm.notes,
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
          <p className="page-description">{TAB_COPY[activeTab] || TAB_COPY.dashboard}</p>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div>
          <div className="grid-3 mb-4">
            <button type="button" className="kpi-card vendor-kpi" onClick={() => setActiveTab('opportunities')}>
              <div className="kpi-header">
                <span className="kpi-title">Open RFQ Opportunities</span>
                <div className="kpi-icon-box text-blue"><ShoppingBag className="w-5 h-5" /></div>
              </div>
              <div className="kpi-value text-blue">{opportunities.length}</div>
              <div className="kpi-footer">Available for bidding</div>
            </button>

            <button type="button" className="kpi-card vendor-kpi" onClick={() => setActiveTab('my_quotes')}>
              <div className="kpi-header">
                <span className="kpi-title">My Submitted Quotes</span>
                <div className="kpi-icon-box text-blue"><FileText className="w-5 h-5" /></div>
              </div>
              <div className="kpi-value text-blue">{quotations.length}</div>
              <div className="kpi-footer">Active quotations</div>
            </button>

            <button type="button" className="kpi-card vendor-kpi" onClick={() => setActiveTab('purchase_orders')}>
              <div className="kpi-header">
                <span className="kpi-title">Awarded Purchase Orders</span>
                <div className="kpi-icon-box text-success"><CheckCircle2 className="w-5 h-5" /></div>
              </div>
              <div className="kpi-value text-success">{purchaseOrders.length}</div>
              <div className="kpi-footer">
                {awaitingConfirm.length > 0 ? `${awaitingConfirm.length} awaiting confirmation` : 'Active procurement POs'}
              </div>
            </button>
          </div>

          {awaitingConfirm.length > 0 && (
            <div className="vendor-alert-banner">
              <Inbox className="w-5 h-5" />
              <div>
                <strong>{awaitingConfirm.length} purchase order{awaitingConfirm.length === 1 ? '' : 's'} need confirmation</strong>
                <p>Confirm shipment so TripWise can prepare receiving.</p>
              </div>
              <button type="button" className="btn btn-success btn-sm" onClick={() => setActiveTab('purchase_orders')}>
                Review POs
              </button>
            </div>
          )}

          <div className="panel-card">
            <div className="panel-header">
              <span className="panel-title"><ShoppingBag className="w-5 h-5 text-blue" /> Open Sourcing Opportunities</span>
              {opportunities.length > 0 && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveTab('opportunities')}>
                  View all
                </button>
              )}
            </div>
            {opportunities.length === 0 ? (
              <div className="empty-state">
                <p>No open RFQs right now. Submitted quotes appear under My Quotes.</p>
              </div>
            ) : (
              <div className="vendor-rfq-feed">
                {opportunities.slice(0, 4).map((opp) => (
                  <OpportunityCard key={opp.id} opp={opp} compact onQuote={openQuote} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'opportunities' && (
        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><ShoppingBag className="w-5 h-5 text-blue" /> Open Sourcing Bidding Opportunities</span>
          </div>
          {opportunities.length === 0 ? (
            <div className="empty-state">
              <p>No open RFQs available. Submitted items now appear under My Quotes.</p>
            </div>
          ) : (
            <div className="vendor-rfq-grid">
              {opportunities.map((opp) => (
                <OpportunityCard key={opp.id} opp={opp} onQuote={openQuote} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'my_quotes' && (
        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><FileText className="w-5 h-5 text-blue" /> Submitted Quotations Log</span>
          </div>
          {quotations.length === 0 ? (
            <div className="empty-state">
              <p>You have not submitted any quotations yet.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Quotation ID</th>
                    <th>Procurement Ref</th>
                    <th>Item</th>
                    <th className="text-right">Total Price</th>
                    <th>Delivery</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q) => (
                    <tr key={q.id}>
                      <td className="font-mono text-xs text-blue font-bold">{q.id}</td>
                      <td className="font-mono text-xs text-secondary">{q.procurementId}</td>
                      <td>
                        <ItemIdentity src={q.imageUrl} name={q.item} extra={`x${q.quantity}`} />
                      </td>
                      <td className="text-right font-mono text-xs text-success font-bold">₱{Number(q.totalPrice).toLocaleString()}</td>
                      <td className="text-xs text-secondary">{q.deliveryTimeDays} days</td>
                      <td>
                        <span className={`badge badge-${quoteBadgeClass(q.status)}`}>{q.status}</span>
                      </td>
                      <td className="text-right">
                        {q.canEdit && (
                          <button type="button" onClick={() => openEditQuote(q)} className="btn btn-outline btn-sm">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'purchase_orders' && (
        <div className="panel-card">
          <div className="panel-header">
            <span className="panel-title"><CheckCircle2 className="w-5 h-5 text-success" /> Confirmed Purchase Orders</span>
          </div>
          {purchaseOrders.length === 0 ? (
            <div className="empty-state">
              <p>No awarded purchase orders yet.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Total Cost</th>
                    <th>Delivery Date</th>
                    <th>Finance Status</th>
                    <th>PO Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po.poNumber}>
                      <td className="font-mono text-xs text-blue font-bold">{po.poNumber}</td>
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
                          <button onClick={() => supplierConfirmPO(po.poNumber)} className="btn btn-success btn-sm">
                            Confirm & Schedule Shipment
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
            ? 'Update unit price, lead time, and warranty coverage before a supplier is selected.'
            : 'Enter unit price, lead time, warranty months, and an optional warranty certificate.'}
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
            <ItemThumb
              src={quoteTarget.imageUrl}
              alt={editingQuote ? editingQuote.item : (selectedOpp.itemName || selectedOpp.title)}
              size="md"
            />
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
              <label className="form-label">Warranty coverage</label>
              <select
                required
                className="form-select"
                value={quoteForm.warrantyMonths}
                onChange={(e) => setQuoteForm({ ...quoteForm, warrantyMonths: e.target.value })}
              >
                {[6, 12, 18, 24, 36, 48, 60].map((m) => (
                  <option key={m} value={m}>{m} months</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Warranty terms (optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. parts and on-site labor"
              value={quoteForm.warranty}
              onChange={(e) => setQuoteForm({ ...quoteForm, warranty: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Warranty certificate (PDF or image)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="form-control"
              onChange={(e) => setQuoteForm({ ...quoteForm, warrantyFile: e.target.files?.[0] || null })}
            />
            {editingQuote?.warrantyFileUrl && !quoteForm.warrantyFile && (
              <p className="text-xs text-slate-400 mt-1">A certificate is already on file. Choose a new file to replace it.</p>
            )}
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
        <div className="panel-card">
          <div className="vendor-placeholder">
            {activeTab === 'messages' ? <MessageSquare className="w-10 h-10" /> : <Building className="w-10 h-10" />}
            <h3>{activeTab === 'messages' ? 'Messages' : 'Company Profile'}</h3>
            <p>{TAB_COPY[activeTab]}</p>
          </div>
        </div>
      )}
    </div>
  );
};
