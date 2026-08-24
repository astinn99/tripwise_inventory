import React, { useEffect, useRef, useState } from 'react';
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
  ImagePlus,
  MessageSquare,
  X,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { ItemIdentity, ItemThumb } from '../components/ui/ItemThumb';
import { compressImageFile, formatFileSize } from '../services/images';

const MAX_ITEM_PHOTOS = 3;
const MAX_ITEM_PHOTO_BYTES = 5 * 1024 * 1024;
const ITEM_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

const QuotePhotoPicker = ({ savedPhotos, newPhotos, error, busy, onAdd, onRemoveSaved, onRemoveNew }) => {
  const inputRef = useRef(null);
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const urls = newPhotos.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [newPhotos]);

  const total = savedPhotos.length + newPhotos.length;
  const remaining = MAX_ITEM_PHOTOS - total;

  const handleChange = (event) => {
    onAdd(Array.from(event.target.files || []));
    event.target.value = '';
  };

  return (
    <div className="form-group">
      <label className="form-label">Photos of the actual item ({total}/{MAX_ITEM_PHOTOS})</label>
      <div className="quote-photo-grid">
        {savedPhotos.map((url) => (
          <div key={url} className="quote-photo-tile">
            <img src={url} alt="Quoted item" />
            <button type="button" className="quote-photo-remove" onClick={() => onRemoveSaved(url)} aria-label="Remove photo">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {newPhotos.map((file, index) => (
          <div key={`${file.name}-${file.lastModified}-${index}`} className="quote-photo-tile">
            {previews[index] ? <img src={previews[index]} alt={file.name} /> : null}
            <button type="button" className="quote-photo-remove" onClick={() => onRemoveNew(index)} aria-label="Remove photo">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {remaining > 0 ? (
          <button type="button" className="quote-photo-add" disabled={busy} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="w-5 h-5" />
            <span>{busy ? 'Optimizing…' : 'Add photo'}</span>
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="item-photo-input"
        onChange={handleChange}
      />
      <p className="item-photo-hint">
        Required. Upload 1 to {MAX_ITEM_PHOTOS} clear photos of the unit you are offering so the buyer can verify quality.
        JPG, PNG or WebP — large photos are resized automatically.
      </p>
      {error ? <p className="quote-photo-error">{error}</p> : null}
    </div>
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
    actionError,
    actionLoading,
    user,
  } = useApp();

  const uploadAbortRef = useRef(null);
  const savedQuotes = quotations.filter((quote) => !String(quote.id || '').startsWith('tmp-'));
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
  const [savedPhotos, setSavedPhotos] = useState([]);
  const [newPhotos, setNewPhotos] = useState([]);
  const [photoError, setPhotoError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [warrantyBusy, setWarrantyBusy] = useState(false);
  const [warrantyHint, setWarrantyHint] = useState('');

  const awaitingConfirm = purchaseOrders.filter((po) => po.poStatus === 'Sent to Supplier');

  const resetPhotos = (urls = []) => {
    setSavedPhotos(urls);
    setNewPhotos([]);
    setPhotoError('');
    setPhotoBusy(false);
    setWarrantyBusy(false);
    setWarrantyHint('');
  };

  const closeQuoteModal = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setSelectedOpp(null);
    setEditingQuote(null);
    setQuoteForm(emptyQuoteForm);
    resetPhotos();
  };

  const openQuote = (opp) => {
    setEditingQuote(null);
    setQuoteForm(emptyQuoteForm);
    resetPhotos();
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
    resetPhotos(Array.isArray(quote.itemPhotoUrls) ? quote.itemPhotoUrls : []);
  };

  const photoCount = savedPhotos.length + newPhotos.length;

  const addPhotos = async (files) => {
    const room = MAX_ITEM_PHOTOS - photoCount;
    if (room <= 0) {
      setPhotoError(`You can attach a maximum of ${MAX_ITEM_PHOTOS} photos.`);
      return;
    }

    let rejection = files.length > room ? `You can attach a maximum of ${MAX_ITEM_PHOTOS} photos.` : '';
    const accepted = [];

    setPhotoBusy(true);
    try {
      for (const file of files.slice(0, room)) {
        if (!ITEM_PHOTO_TYPES.includes(file.type)) {
          rejection = 'Item photos must be JPG, PNG or WebP files.';
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const prepared = await compressImageFile(file);
        if (prepared.size > MAX_ITEM_PHOTO_BYTES) {
          rejection = 'That photo is too large to upload. Please choose a smaller image.';
          continue;
        }

        accepted.push(prepared);
      }
    } finally {
      setPhotoBusy(false);
    }

    if (accepted.length > 0) {
      setNewPhotos((current) => [...current, ...accepted].slice(0, MAX_ITEM_PHOTOS));
    }
    setPhotoError(rejection);
  };

  const removeSavedPhoto = (url) => {
    setSavedPhotos((current) => current.filter((item) => item !== url));
    setPhotoError('');
  };

  const removeNewPhoto = (index) => {
    setNewPhotos((current) => current.filter((_, position) => position !== index));
    setPhotoError('');
  };

  const attachWarranty = async (file) => {
    if (!file) {
      setQuoteForm((current) => ({ ...current, warrantyFile: null }));
      setWarrantyHint('');
      return;
    }

    setWarrantyBusy(true);
    setWarrantyHint('Optimizing file…');
    try {
      const prepared = file.type.startsWith('image/')
        ? await compressImageFile(file)
        : file;
      setQuoteForm((current) => ({ ...current, warrantyFile: prepared }));
      if (prepared.size < file.size) {
        setWarrantyHint(`Reduced automatically from ${formatFileSize(file.size)} to ${formatFileSize(prepared.size)}.`);
        return;
      }
      setWarrantyHint(prepared.size > 512 * 1024
        ? 'Large file — it will be uploaded in smaller pieces so it stays under the server limit.'
        : '');
    } catch {
      setQuoteForm((current) => ({ ...current, warrantyFile: file }));
      setWarrantyHint('');
    } finally {
      setWarrantyBusy(false);
    }
  };

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOpp && !editingQuote) return;

      if (photoBusy || warrantyBusy) {
        setPhotoError('Please wait until the selected files finish processing.');
        return;
      }

      if (photoCount < 1) {
        setPhotoError('Attach at least 1 photo of the actual item you are offering.');
        return;
      }

      const photosToUpload = newPhotos;
      const photosToKeep = savedPhotos;

      const controller = new AbortController();
      uploadAbortRef.current?.abort();
      uploadAbortRef.current = controller;

      try {
        const result = editingQuote
          ? await updateSupplierQuotation(editingQuote.id, {
            unitPrice: Number(quoteForm.unitPrice),
            warrantyMonths: Number(quoteForm.warrantyMonths),
            warranty: quoteForm.warranty,
            warrantyFile: quoteForm.warrantyFile,
            itemPhotos: photosToUpload,
            keepItemPhotos: photosToKeep,
            deliveryTimeDays: Number(quoteForm.deliveryTimeDays),
            paymentTerms: quoteForm.paymentTerms,
            notes: quoteForm.notes,
          }, { signal: controller.signal })
          : await submitSupplierQuotation({
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
            itemPhotos: photosToUpload,
            deliveryTimeDays: Number(quoteForm.deliveryTimeDays),
            qualityRating: 4.8,
            paymentTerms: quoteForm.paymentTerms,
            notes: quoteForm.notes,
          }, { signal: controller.signal });
        if (controller.signal.aborted || !result) {
          return;
        }
        uploadAbortRef.current = null;
        closeQuoteModal();
        setActiveTab('my_quotes');
      } catch {
        // Keep the modal open so the vendor can fix the attachment and retry.
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
              <div className="kpi-value text-blue">{savedQuotes.length}</div>
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
          {savedQuotes.length === 0 ? (
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
                    <th>Photos</th>
                    <th className="text-right">Total Price</th>
                    <th>Delivery</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {savedQuotes.map((q) => (
                    <tr key={q.id}>
                      <td className="font-mono text-xs text-blue font-bold">{q.id}</td>
                      <td className="font-mono text-xs text-secondary">{q.procurementId}</td>
                      <td>
                        <ItemIdentity src={q.imageUrl} name={q.item} extra={`x${q.quantity}`} />
                      </td>
                      <td>
                        {q.itemPhotoUrls?.length ? (
                          <div className="quote-photo-strip">
                            {q.itemPhotoUrls.map((url) => (
                              <ItemThumb key={url} src={url} alt={q.item} />
                            ))}
                          </div>
                        ) : (
                          <span className="quote-photo-empty">None</span>
                        )}
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
            ? 'Update pricing, lead time, warranty coverage, and item photos before a supplier is selected.'
            : 'Enter unit price, lead time, warranty coverage, and 1 to 3 photos of the actual item.'}
          footer={(
            <>
              <button type="button" onClick={closeQuoteModal} className="btn btn-outline btn-sm">Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading || photoBusy || warrantyBusy}>
                {actionLoading || warrantyBusy ? 'Uploading…' : (editingQuote ? 'Save Changes' : 'Submit Quotation')}
              </button>
            </>
          )}
        >
          {actionError ? <p className="quote-photo-error">{actionError}</p> : null}

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

          <QuotePhotoPicker
            savedPhotos={savedPhotos}
            newPhotos={newPhotos}
            error={photoError}
            busy={photoBusy}
            onAdd={addPhotos}
            onRemoveSaved={removeSavedPhoto}
            onRemoveNew={removeNewPhoto}
          />

          <div className="form-group">
            <label className="form-label">Warranty certificate (PDF or image)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="form-control"
              disabled={warrantyBusy || actionLoading}
              onChange={(e) => {
                attachWarranty(e.target.files?.[0] || null);
                e.target.value = '';
              }}
            />
            <p className="item-photo-hint">
              PDF or image. Oversized files are reduced automatically, or sent in smaller pieces if they still exceed the server limit.
            </p>
            {warrantyHint ? <p className="item-photo-hint">{warrantyHint}</p> : null}
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
