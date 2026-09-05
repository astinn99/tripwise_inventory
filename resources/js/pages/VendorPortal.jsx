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
  Mail,
  X,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import { Modal, displayValue } from '../components/ui/Modal';
import { api, ApiError } from '../services/api';
import { CredentialFiles } from '../components/ui/CredentialFiles';
import { VendorThread } from '../components/ui/VendorThread';
import { ItemIdentity, ItemThumb } from '../components/ui/ItemThumb';
import { compressImageFile, formatFileSize } from '../services/images';
import { formatDisplayDate } from '../services/dates';
import {
  normalizePriority,
  preferredMaxDeliveryDays,
  PRIORITIES,
  priorityBadgeClass,
  sortByPriority,
} from '../services/priority';

const MAX_ITEM_PHOTOS = 3;
const MAX_ITEM_PHOTO_BYTES = 5 * 1024 * 1024;
const ITEM_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const TAB_COPY = {
  dashboard: 'Review open RFQs, submitted quotes, and awarded purchase orders.',
  opportunities: 'Browse open sourcing requests and submit a formal quotation before the deadline.',
  my_quotes: 'Track quotations you have submitted and edit them until a supplier is selected.',
  purchase_orders: 'Confirm awarded purchase orders and schedule shipment.',
  messages: 'Ask the TripWise supply chain team a question. You share one conversation with the whole team.',
  profile: 'Update the company, legal, contact, and banking details for your vendor account.',
};

const SUPPLY_CATEGORIES = [
  'Office Supplies',
  'Communication Devices',
  'Maintenance Tools',
  'Fleet Consumables',
  'Others',
];

const emptyProfileForm = {
  companyName: '',
  address: '',
  categories: [],
  contactPerson: '',
  phone: '',
  taxId: '',
  secRegistration: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
};

const parseBankFields = (profile) => {
  if (profile.bankName || profile.accountName || profile.accountNumber) {
    return {
      bankName: profile.bankName || '',
      accountName: profile.accountName || '',
      accountNumber: profile.accountNumber || '',
    };
  }

  const raw = String(profile.bankDetails || '');
  const accountName = (raw.match(/Acct name:\s*(.+?)(?:\s*·|$)/u) || [])[1]?.trim() || '';
  const accountNumber = (raw.match(/Acct no:\s*(.+?)(?:\s*·|$)/u) || [])[1]?.trim() || '';
  const bankName = raw.split(' · ')[0]?.trim() || '';

  return {
    bankName: bankName.startsWith('Acct ') ? '' : bankName,
    accountName,
    accountNumber,
  };
};

const profileFormFromVendor = (profile) => ({
  companyName: profile.companyName || '',
  address: profile.address || '',
  categories: Array.isArray(profile.categories) ? profile.categories : [],
  contactPerson: profile.contactPerson || '',
  phone: profile.phone || '',
  taxId: profile.taxId || '',
  secRegistration: profile.secRegistration || '',
  ...parseBankFields(profile),
});

const profileFromSession = (user) => {
  if (!user?.supplierId && !user?.supplierName) {
    return null;
  }

  return {
    id: user.supplierId || '',
    companyName: user.supplierName || '',
    contactPerson: user.name || '',
    email: user.email || '',
    status: user.supplierStatus || '',
    address: '',
    phone: '',
    categories: [],
    taxId: '',
    secRegistration: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    credentials: [],
  };
};

const quoteBadgeClass = (status) => {
  if (status === 'Selected') return 'normal';
  if (status === 'Rejected') return 'rejected';
  return 'info';
};

const deadlineState = (deadline) => {
  if (!deadline) {
    return { short: 'No deadline', label: 'No deadline', tone: '' };
  }

  const pretty = formatDisplayDate(deadline) || deadline;
  const days = Math.ceil((new Date(`${deadline}T23:59:59`) - new Date()) / 86400000);
  if (Number.isNaN(days)) {
    return { short: pretty, label: pretty, tone: '' };
  }
  if (days < 0) {
    return { short: 'Overdue', label: `Overdue · ${pretty}`, tone: 'is-overdue' };
  }
  if (days === 0) {
    return { short: 'Due today', label: `Due today · ${pretty}`, tone: 'is-soon' };
  }
  if (days <= 3) {
    const short = `${days} day${days === 1 ? '' : 's'} left`;
    return { short, label: `${short} · ${pretty}`, tone: 'is-soon' };
  }

  return { short: pretty, label: pretty, tone: '' };
};

const rfqReason = (requirements) => {
  if (!requirements) {
    return '';
  }

  return String(requirements)
    .replace(/Please submit a quotation for .*?(?:\.|$)\s*/i, '')
    .replace(/Quote by .*?(?:\.|$)\s*/i, '')
    .replace(/Need item in .*?(?:\.|$)\s*/i, '')
    .trim();
};

const OpportunityCard = ({ opp, compact = false, onQuote, onCancel }) => {
  const due = deadlineState(opp.deadline);
  const priority = normalizePriority(opp.priority);
  const reason = rfqReason(opp.requirements);
  const meta = [opp.category, opp.itemCode].filter(Boolean).join(' · ');
  const badge = <span className={`badge ${priorityBadgeClass(priority)}`}>{priority}</span>;
  const cta = (
    <div className="vendor-rfq-cta-row">
      {onCancel ? (
        <button type="button" onClick={() => onCancel(opp)} className="btn btn-outline btn-sm">
          <X className="w-3.5 h-3.5" /> Cancel RFQ
        </button>
      ) : null}
      <button type="button" onClick={() => onQuote(opp)} className="btn btn-primary btn-sm vendor-rfq-cta">
        <Send className="w-3.5 h-3.5" /> Submit quotation
      </button>
    </div>
  );

  return (
    <article className={`vendor-rfq-card ${compact ? 'is-compact' : ''} ${priority === 'URGENT' ? 'is-urgent' : ''} ${priority === 'HIGH' ? 'is-high' : ''}`}>
      <div className="vendor-rfq-media">
        <ItemThumb src={opp.imageUrl} alt={opp.itemName || opp.title} size={compact ? 'md' : 'card'} />
      </div>

      <div className="vendor-rfq-body">
        <div className="vendor-rfq-top">
          <span className="vendor-rfq-ref">{opp.prNumber}</span>
          {!compact ? badge : null}
        </div>
        <h4 className="vendor-rfq-title">{opp.itemName || opp.title}</h4>
        {meta ? <p className="vendor-rfq-meta">{meta}</p> : null}

        {!compact && (
          <>
            <dl className="vendor-rfq-stats">
              <div>
                <dt>Qty</dt>
                <dd>{opp.quantity} units</dd>
              </div>
              <div>
                <dt>Budget</dt>
                <dd>{opp.budgetRange || '—'}</dd>
              </div>
              <div>
                <dt>Quote by</dt>
                <dd className={due.tone}>{formatDisplayDate(opp.deadline) || '—'}</dd>
              </div>
              {opp.neededBy ? (
                <div>
                  <dt>Need item</dt>
                  <dd>{formatDisplayDate(opp.neededBy)}</dd>
                </div>
              ) : null}
            </dl>
            {reason ? <p className="vendor-rfq-notes">{reason}</p> : null}
            <div className="vendor-rfq-foot">
              <span className={`vendor-deadline ${due.tone}`}>
                <Clock className="w-3 h-3" />
                {due.short}
              </span>
              {cta}
            </div>
          </>
        )}

        {compact && (
          <p className="vendor-rfq-notes is-compact">
            {opp.quantity} units
            {opp.budgetRange ? ` · ${opp.budgetRange}` : ''}
            {` · ${due.short}`}
          </p>
        )}
      </div>
      {compact ? (
        <div className="vendor-rfq-actions">
          {badge}
          {cta}
        </div>
      ) : null}
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

const QuoteFileField = ({
  label,
  hint,
  accept,
  busy,
  disabled,
  fileHint,
  existingUrl,
  existingLabel,
  selectedFile,
  onChange,
}) => (
  <div className="form-group">
    <label className="form-label">{label}</label>
    <input
      type="file"
      accept={accept}
      className="form-control"
      disabled={busy || disabled}
      onChange={(e) => {
        onChange(e.target.files?.[0] || null);
        e.target.value = '';
      }}
    />
    <p className="item-photo-hint">{hint}</p>
    {fileHint ? <p className="item-photo-hint">{fileHint}</p> : null}
    {selectedFile ? (
      <p className="item-photo-hint">Selected: {selectedFile.name}</p>
    ) : null}
    {existingUrl && !selectedFile ? (
      <p className="text-xs text-slate-400 mt-1">
        <a href={existingUrl} target="_blank" rel="noreferrer">{existingLabel}</a>
        {' '}is already on file. Choose a new file to replace it.
      </p>
    ) : null}
  </div>
);

export const VendorPortal = ({ activeTab, setActiveTab }) => {
  const {
    opportunities,
    quotations,
    purchaseOrders,
    submitSupplierQuotation,
    updateSupplierQuotation,
    supplierConfirmPO,
    cancelProcurementRequest,
    actionError,
    actionLoading,
    user,
    suppliers,
    patchSessionUser,
    vendorMessageRevision,
    setVendorMessageUnread,
  } = useApp();

  const uploadAbortRef = useRef(null);
  const [pendingCancel, setPendingCancel] = useState(null);
  const savedQuotes = sortByPriority(quotations.filter((quote) => !String(quote.id || '').startsWith('tmp-')));
  const rankedOpportunities = sortByPriority(opportunities);
  const rankedPurchaseOrders = sortByPriority(purchaseOrders, 'confirmBy');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [editingQuote, setEditingQuote] = useState(null);

  const emptyQuoteForm = {
    unitPrice: '',
    warrantyMonths: '',
    warranty: '',
    warrantyFile: null,
    manualFile: null,
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
  const [manualBusy, setManualBusy] = useState(false);
  const [manualHint, setManualHint] = useState('');
  const bootProfile = suppliers.find((item) => item?.id === user?.supplierId) || suppliers[0] || null;
  const [vendorProfile, setVendorProfile] = useState(() => bootProfile || profileFromSession(user));
  const [profileForm, setProfileForm] = useState(() => (
    bootProfile || profileFromSession(user)
      ? profileFormFromVendor(bootProfile || profileFromSession(user))
      : emptyProfileForm
  ));
  const [profileLoading, setProfileLoading] = useState(!bootProfile);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const profileDirtyRef = useRef(false);

  const awaitingConfirm = rankedPurchaseOrders.filter((po) => po.poStatus === 'Sent to Supplier');
  const urgentOpen = rankedOpportunities.filter((opp) => normalizePriority(opp.priority) === 'URGENT');
  const visibleOpportunities = priorityFilter === 'ALL'
    ? rankedOpportunities
    : rankedOpportunities.filter((opp) => normalizePriority(opp.priority) === priorityFilter);
  const pendingApproval = (vendorProfile?.status || user?.supplierStatus) === 'Pending Approval';

  const applyLoadedProfile = (profile) => {
    setVendorProfile(profile);
    if (!profileDirtyRef.current) {
      setProfileForm(profileFormFromVendor(profile));
    }
    setProfileError('');
    setProfileLoading(false);
  };

  const loadVendorProfile = () => {
    setProfileError('');
    setProfileSaved(false);
    if (!vendorProfile) {
      setProfileLoading(true);
    }

    return api.get('/api/vendor/profile', { portal: 'vendor' })
      .then((profile) => {
        profileDirtyRef.current = false;
        applyLoadedProfile(profile);
      })
      .catch((caught) => {
        if (!vendorProfile) {
          setVendorProfile(profileFromSession(user));
        }
        setProfileError(caught instanceof ApiError ? caught.message : 'Unable to load your company profile.');
        setProfileLoading(false);
      });
  };

  useEffect(() => {
    if (bootProfile) {
      applyLoadedProfile(bootProfile);
      return;
    }

    let cancelled = false;
    setProfileLoading((current) => current || !vendorProfile);
    api.get('/api/vendor/profile', { portal: 'vendor' })
      .then((profile) => {
        if (!cancelled) {
          applyLoadedProfile(profile);
        }
      })
      .catch((caught) => {
        if (cancelled) {
          return;
        }
        setProfileError(caught instanceof ApiError ? caught.message : 'Unable to load your company profile.');
        setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bootProfile?.id, bootProfile?.taxId, bootProfile?.bankDetails]);

  const setProfileField = (key, value) => {
    profileDirtyRef.current = true;
    setProfileForm((current) => ({ ...current, [key]: value }));
    setProfileSaved(false);
  };

  const toggleProfileCategory = (category) => {
    profileDirtyRef.current = true;
    setProfileForm((current) => {
      const selected = current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category];
      return { ...current, categories: selected };
    });
    setProfileSaved(false);
  };

  const resetProfileForm = () => {
    if (!vendorProfile) {
      return;
    }
    profileDirtyRef.current = false;
    setProfileForm(profileFormFromVendor(vendorProfile));
    setProfileError('');
    setProfileSaved(false);
  };

  const saveVendorProfile = async (event) => {
    event.preventDefault();
    setProfileError('');
    setProfileSaved(false);

    if (profileForm.categories.length === 0) {
      setProfileError('Select at least one supply category you can serve.');
      return;
    }

    setProfileSaving(true);
    try {
      const profile = await api.put('/api/vendor/profile', profileForm, { portal: 'vendor' });
      profileDirtyRef.current = false;
      setVendorProfile(profile);
      setProfileForm(profileFormFromVendor(profile));
      patchSessionUser({
        name: profile.contactPerson,
        supplierName: profile.companyName,
      });
      setProfileSaved(true);
    } catch (caught) {
      setProfileError(caught instanceof ApiError ? caught.message : 'Unable to save your company profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const resetPhotos = (urls = []) => {
    setSavedPhotos(urls);
    setNewPhotos([]);
    setPhotoError('');
    setPhotoBusy(false);
    setWarrantyBusy(false);
    setWarrantyHint('');
    setManualBusy(false);
    setManualHint('');
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
      warrantyMonths: quote.warrantyMonths ? String(quote.warrantyMonths) : '',
      warranty: quote.warranty || '',
      warrantyFile: null,
      manualFile: null,
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

  const attachOptionalFile = async (file, field, setBusy, setHint) => {
    if (!file) {
      setQuoteForm((current) => ({ ...current, [field]: null }));
      setHint('');
      return;
    }

    setBusy(true);
    setHint('Optimizing file…');
    try {
      const prepared = file.type.startsWith('image/')
        ? await compressImageFile(file)
        : file;
      setQuoteForm((current) => ({ ...current, [field]: prepared }));
      if (prepared.size < file.size) {
        setHint(`Reduced automatically from ${formatFileSize(file.size)} to ${formatFileSize(prepared.size)}.`);
        return;
      }
      setHint(prepared.size > 512 * 1024
        ? 'Large file — it will be uploaded in smaller pieces so it stays under the server limit.'
        : '');
    } catch {
      setQuoteForm((current) => ({ ...current, [field]: file }));
      setHint('');
    } finally {
      setBusy(false);
    }
  };

  const filesBusy = photoBusy || warrantyBusy || manualBusy;

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOpp && !editingQuote) return;

    if (filesBusy) {
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
      const quoteFields = {
        unitPrice: Number(quoteForm.unitPrice),
        warrantyMonths: quoteForm.warrantyMonths ? Number(quoteForm.warrantyMonths) : null,
        warranty: quoteForm.warranty,
        warrantyFile: quoteForm.warrantyFile,
        manualFile: quoteForm.manualFile,
        itemPhotos: photosToUpload,
        deliveryTimeDays: Number(quoteForm.deliveryTimeDays),
        paymentTerms: quoteForm.paymentTerms,
        notes: quoteForm.notes,
      };

      const result = editingQuote
        ? await updateSupplierQuotation(editingQuote.id, {
          ...quoteFields,
          keepItemPhotos: photosToKeep,
        }, { signal: controller.signal })
        : await submitSupplierQuotation({
          ...quoteFields,
          procurementId: selectedOpp.prNumber,
          supplierId: user?.supplierId,
          supplierName: user?.supplierName,
          item: selectedOpp.itemName || selectedOpp.title,
          quantity: selectedOpp.quantity,
          totalPrice: Number(quoteForm.unitPrice) * selectedOpp.quantity,
          qualityRating: 4.8,
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
  const quotePriority = normalizePriority(editingQuote?.priority || selectedOpp?.priority);
  const quoteNeededBy = editingQuote?.neededBy || selectedOpp?.neededBy;
  const quoteDeadline = selectedOpp?.deadline;
  const quoteOverdue = Boolean(selectedOpp?.isOverdue);
  const maxDeliveryDays = preferredMaxDeliveryDays(
    quotePriority,
    selectedOpp?.neededInDays || selectedOpp?.preferredMaxDeliveryDays
  );
  const deliveryTooSlow = Boolean(maxDeliveryDays && Number(quoteForm.deliveryTimeDays) > maxDeliveryDays);

  return (
    <div className="vendor-portal-page">
      <div className="page-header">
        <div className="page-header-title-group">
          <h2 className="page-title">{vendorProfile?.companyName || user?.supplierName || 'Vendor'}</h2>
          <p className="page-description">{TAB_COPY[activeTab] || TAB_COPY.dashboard}</p>
        </div>
      </div>

      {pendingApproval ? (
        <div className="vendor-alert-banner is-pending">
          <Clock className="w-5 h-5" />
          <div>
            <strong>Pending supply chain review</strong>
            <p>Your credentials are under review. You can still update your profile. RFQs will appear here after approval.</p>
          </div>
        </div>
      ) : null}

      {activeTab === 'dashboard' && (
        <div>
          <div className="grid-3 mb-4">
            <button type="button" className="kpi-card vendor-kpi" onClick={() => setActiveTab('opportunities')}>
              <div className="kpi-header">
                <span className="kpi-title">Open RFQ Opportunities</span>
                <div className="kpi-icon-box text-blue"><ShoppingBag className="w-5 h-5" /></div>
              </div>
              <div className="kpi-value text-blue">{rankedOpportunities.length}</div>
              <div className="kpi-footer">
                {urgentOpen.length > 0 ? `${urgentOpen.length} urgent RFQ${urgentOpen.length === 1 ? '' : 's'} due` : 'Available for bidding'}
              </div>
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
              <div className="kpi-value text-success">{rankedPurchaseOrders.length}</div>
              <div className="kpi-footer">
                {awaitingConfirm.length > 0 ? `${awaitingConfirm.length} awaiting confirmation` : 'Active procurement POs'}
              </div>
            </button>
          </div>

          {urgentOpen.length > 0 && (
            <div className="vendor-alert-banner is-urgent">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <strong>{urgentOpen.length} urgent RFQ{urgentOpen.length === 1 ? '' : 's'} need a quote</strong>
                <p>Operations cannot wait. Quote the fastest realistic delivery first.</p>
              </div>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setActiveTab('opportunities')}>
                Review urgent RFQs
              </button>
            </div>
          )}

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
              {rankedOpportunities.length > 0 && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveTab('opportunities')}>
                  View all
                </button>
              )}
            </div>
            {rankedOpportunities.length === 0 ? (
              <div className="empty-state">
                <p>No open RFQs right now. Submitted quotes appear under My Quotes.</p>
              </div>
            ) : (
              <div className="vendor-rfq-feed">
                {rankedOpportunities.slice(0, 4).map((opp) => (
                  <OpportunityCard key={opp.id} opp={opp} compact onQuote={openQuote} onCancel={setPendingCancel} />
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
            <div className="vendor-priority-filters">
              {['ALL', ...PRIORITIES].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`btn btn-sm ${priorityFilter === level ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setPriorityFilter(level)}
                >
                  {level === 'ALL' ? 'All' : level}
                </button>
              ))}
            </div>
          </div>
          {visibleOpportunities.length === 0 ? (
            <div className="empty-state">
              <p>{rankedOpportunities.length === 0 ? 'No open RFQs available. Submitted items now appear under My Quotes.' : `No ${priorityFilter.toLowerCase()} RFQs right now.`}</p>
            </div>
          ) : (
            <div className="vendor-rfq-grid">
              {visibleOpportunities.map((opp) => (
                <OpportunityCard key={opp.id} opp={opp} onQuote={openQuote} onCancel={setPendingCancel} />
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
              <table className="custom-table table-stack">
                <thead>
                  <tr>
                    <th>Quotation ID</th>
                    <th>Procurement Ref</th>
                    <th>Item</th>
                    <th>Priority</th>
                    <th>Photos</th>
                    <th>Guide / Manual</th>
                    <th className="text-right">Total Price</th>
                    <th>Delivery</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {savedQuotes.map((q) => (
                    <tr key={q.id}>
                      <td data-label="Quotation ID" className="font-mono text-xs text-blue font-bold">{q.id}</td>
                      <td data-label="Procurement Ref" className="font-mono text-xs text-secondary">{q.procurementId}</td>
                      <td data-label="Item">
                        <ItemIdentity src={q.imageUrl} name={q.item} extra={`x${q.quantity}`} />
                      </td>
                      <td data-label="Priority">
                        <span className={`badge ${priorityBadgeClass(q.priority)}`}>{normalizePriority(q.priority)}</span>
                      </td>
                      <td data-label="Photos">
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
                      <td data-label="Guide / Manual">
                        {q.manualFileUrl ? (
                          <a href={q.manualFileUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                            <BookOpen className="w-3.5 h-3.5" /> View
                          </a>
                        ) : (
                          <span className="quote-photo-empty">None</span>
                        )}
                      </td>
                      <td data-label="Total Price" className="text-right font-mono text-xs text-success font-bold">₱{Number(q.totalPrice).toLocaleString()}</td>
                      <td data-label="Delivery" className="text-xs text-secondary">{q.deliveryTimeDays} days</td>
                      <td data-label="Status">
                        <span className={`badge badge-${quoteBadgeClass(q.status)}`}>{q.status}</span>
                      </td>
                      <td data-label="Action" className="text-right table-stack-actions">
                        <div className="flex justify-end gap-1">
                          {q.canEdit && (
                            <button type="button" onClick={() => openEditQuote(q)} className="btn btn-outline btn-sm">
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </button>
                          )}
                          {q.status !== 'Selected' && q.procurementId && (
                            <button type="button" onClick={() => setPendingCancel({ prNumber: q.procurementId, itemName: q.item })} className="btn btn-outline btn-sm">
                              <X className="w-3.5 h-3.5" /> Cancel PR
                            </button>
                          )}
                        </div>
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
          {rankedPurchaseOrders.length === 0 ? (
            <div className="empty-state">
              <p>No awarded purchase orders yet.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table table-stack">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Priority</th>
                    <th>Total Cost</th>
                    <th>Delivery Date</th>
                    <th>Confirm by</th>
                    <th>Finance Status</th>
                    <th>PO Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedPurchaseOrders.map((po) => (
                    <tr key={po.poNumber}>
                      <td data-label="PO Number" className="font-mono text-xs text-blue font-bold">{po.poNumber}</td>
                      <td data-label="Priority">
                        <span className={`badge ${priorityBadgeClass(po.priority)}`}>{normalizePriority(po.priority)}</span>
                      </td>
                      <td data-label="Total Cost" className="font-mono text-xs text-success font-bold">₱{Number(po.totalCost).toLocaleString()}</td>
                      <td data-label="Delivery Date" className="text-xs text-secondary">{formatDisplayDate(po.deliveryDate) || po.deliveryDate}</td>
                      <td data-label="Confirm by" className="text-xs text-secondary">
                        {po.poStatus === 'Sent to Supplier' && po.confirmBy ? formatDisplayDate(po.confirmBy) : '—'}
                      </td>
                      <td data-label="Finance Status">
                        <span className={`badge badge-${po.financeApprovalStatus.toLowerCase().replace(/ /g, '-')}`}>
                          {po.financeApprovalStatus}
                        </span>
                      </td>
                      <td data-label="PO Status">
                        <span className={`badge badge-${po.poStatus.toLowerCase().replace(/ /g, '-')}`}>
                          {po.poStatus}
                        </span>
                      </td>
                      <td data-label="Action" className="text-right table-stack-actions">
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
            ? 'Update pricing, lead time, optional warranty, item photos, and an optional guide or manual before a supplier is selected.'
            : 'Enter unit price, lead time, and 1 to 3 photos of the actual item. Warranty coverage and a guide or manual are optional.'}
          footer={(
            <>
              <button type="button" onClick={closeQuoteModal} className="btn btn-outline btn-sm">Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading || filesBusy}>
                {actionLoading || warrantyBusy || manualBusy ? 'Uploading…' : (editingQuote ? 'Save Changes' : 'Submit Quotation')}
              </button>
            </>
          )}
        >
          {actionError ? <p className="quote-photo-error">{actionError}</p> : null}

          {quoteOverdue ? (
            <div className="quote-priority-banner is-urgent">
              <AlertTriangle className="w-4 h-4" />
              <div>
                <strong>RFQ deadline has passed</strong>
                <p>
                  Quote by was {formatDisplayDate(quoteDeadline)}. You can still submit — TripWise keeps the request
                  open until a quotation is awarded.
                </p>
              </div>
            </div>
          ) : null}

          {quotePriority !== 'NORMAL' ? (
            <div className={`quote-priority-banner is-${quotePriority.toLowerCase()}`}>
              <AlertTriangle className="w-4 h-4" />
              <div>
                <strong>{quotePriority} request</strong>
                <p>
                  {quotePriority === 'URGENT'
                    ? 'Operations cannot wait. Fastest delivery is preferred over lowest price.'
                    : 'Quote soon and prefer a shorter lead time where you can.'}
                  {quoteDeadline ? ` Quote by ${formatDisplayDate(quoteDeadline)}.` : ''}
                  {quoteNeededBy ? ` Need item by ${formatDisplayDate(quoteNeededBy)}.` : ''}
                </p>
              </div>
            </div>
          ) : null}

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
                <span className={`badge ${priorityBadgeClass(quotePriority)}`}>{quotePriority}</span>
                {quoteNeededBy ? <span className="modal-chip">Need item by {formatDisplayDate(quoteNeededBy)}</span> : null}
                {quoteDeadline ? <span className="modal-chip">Quote by {formatDisplayDate(quoteDeadline)}</span> : null}
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
            <div className={`form-group ${quotePriority === 'URGENT' ? 'is-urgent-field' : ''}`}>
              <label className="form-label">Delivery lead time (days)</label>
              <input
                type="number"
                required
                min="1"
                className="form-control"
                value={quoteForm.deliveryTimeDays}
                onChange={(e) => setQuoteForm({ ...quoteForm, deliveryTimeDays: e.target.value })}
              />
              {quotePriority === 'URGENT' ? (
                <p className="item-photo-hint">Fastest realistic delivery wins this RFQ.</p>
              ) : null}
              {deliveryTooSlow ? (
                <p className="quote-photo-error">
                  This lead time is longer than TripWise prefers for {quotePriority} stock
                  {maxDeliveryDays ? ` (${maxDeliveryDays} days or faster)` : ''}. You can still submit.
                </p>
              ) : null}
            </div>
            <div className="form-group">
              <label className="form-label">Warranty coverage</label>
              <select
                className="form-select"
                value={quoteForm.warrantyMonths}
                onChange={(e) => setQuoteForm({ ...quoteForm, warrantyMonths: e.target.value })}
              >
                <option value="">None</option>
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

          <QuoteFileField
            label="Warranty certificate (optional)"
            hint="Optional. PDF or image. Attach only if this offer includes a warranty certificate."
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            busy={warrantyBusy}
            disabled={actionLoading}
            fileHint={warrantyHint}
            existingUrl={editingQuote?.warrantyFileUrl}
            existingLabel="A certificate"
            selectedFile={quoteForm.warrantyFile}
            onChange={(file) => attachOptionalFile(file, 'warrantyFile', setWarrantyBusy, setWarrantyHint)}
          />

          <QuoteFileField
            label="Guide / manual (optional)"
            hint="Optional. PDF or image of the product guide or manual, if the item has one."
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            busy={manualBusy}
            disabled={actionLoading}
            fileHint={manualHint}
            existingUrl={editingQuote?.manualFileUrl}
            existingLabel="A guide / manual"
            selectedFile={quoteForm.manualFile}
            onChange={(file) => attachOptionalFile(file, 'manualFile', setManualBusy, setManualHint)}
          />

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

      {activeTab === 'profile' && (
        <div className="panel-card">
          {vendorProfile ? (
            <form className="vendor-profile" onSubmit={saveVendorProfile}>
              <div className="modal-hero">
                <div className="flex items-start gap-3">
                  <span className="modal-avatar">
                    {(profileForm.companyName || vendorProfile.companyName || 'V').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="modal-hero-main">
                    <div className="modal-kicker">{vendorProfile.id}</div>
                    <h4>{profileForm.companyName || vendorProfile.companyName}</h4>
                    <div className="modal-hero-meta">{displayValue(profileForm.address || vendorProfile.address)}</div>
                    <div className="modal-chip-row">
                      <span className="modal-chip"><Mail className="w-3.5 h-3.5" /> {displayValue(vendorProfile.email)}</span>
                    </div>
                  </div>
                </div>
                <div className="modal-hero-aside">
                  <span className="modal-stat-label">Account status</span>
                  <span className={`badge ${vendorProfile.status === 'Active' ? 'badge-active' : 'badge-pending'}`}>
                    {vendorProfile.status}
                  </span>
                </div>
              </div>

              {profileLoading ? (
                <div className="vendor-alert-banner is-pending" role="status">
                  <Clock className="w-5 h-5" />
                  <div>
                    <strong>Refreshing details</strong>
                    <p>You can already edit the fields below.</p>
                  </div>
                </div>
              ) : null}

              {profileError ? (
                <div className="vendor-alert-banner is-urgent" role="alert">
                  <AlertTriangle className="w-5 h-5" />
                  <div>
                    <strong>Could not update profile</strong>
                    <p>{profileError}</p>
                  </div>
                </div>
              ) : null}

              {profileSaved ? (
                <div className="vendor-alert-banner" role="status">
                  <CheckCircle2 className="w-5 h-5" />
                  <div>
                    <strong>Profile updated</strong>
                    <p>Supply chain will see these details on your vendor record.</p>
                  </div>
                </div>
              ) : null}

              <div className="grid-2">
                <div className="modal-panel">
                  <div className="modal-section-title">Company</div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profileCompanyName">Company name</label>
                    <input
                      id="profileCompanyName"
                      className="form-control"
                      value={profileForm.companyName}
                      onChange={(event) => setProfileField('companyName', event.target.value)}
                      disabled={profileSaving}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profileAddress">Business address</label>
                    <textarea
                      id="profileAddress"
                      className="form-control"
                      rows="2"
                      value={profileForm.address}
                      onChange={(event) => setProfileField('address', event.target.value)}
                      disabled={profileSaving}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <span className="form-label" id="profileCategoriesLabel">Categories you can supply</span>
                    <div className="login-check-row" role="group" aria-labelledby="profileCategoriesLabel">
                      {SUPPLY_CATEGORIES.map((category) => (
                        <label key={category} className="login-check">
                          <input
                            type="checkbox"
                            checked={profileForm.categories.includes(category)}
                            onChange={() => toggleProfileCategory(category)}
                            disabled={profileSaving}
                          />
                          {category}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="modal-panel">
                  <div className="modal-section-title">Contacts</div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profileContactPerson">Contact person</label>
                    <input
                      id="profileContactPerson"
                      className="form-control"
                      value={profileForm.contactPerson}
                      onChange={(event) => setProfileField('contactPerson', event.target.value)}
                      disabled={profileSaving}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profilePhone">Phone</label>
                    <input
                      id="profilePhone"
                      className="form-control"
                      value={profileForm.phone}
                      onChange={(event) => setProfileField('phone', event.target.value)}
                      disabled={profileSaving}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profileEmail">Email (used to sign in)</label>
                    <input
                      id="profileEmail"
                      className="form-control"
                      value={vendorProfile.email || ''}
                      disabled
                      readOnly
                    />
                  </div>
                </div>
              </div>

              <div className="grid-2">
                <div className="modal-panel">
                  <div className="modal-section-title">Legal registrations</div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profileTaxId">TIN</label>
                    <input
                      id="profileTaxId"
                      className="form-control"
                      value={profileForm.taxId}
                      onChange={(event) => setProfileField('taxId', event.target.value)}
                      disabled={profileSaving}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profileSecRegistration">SEC / DTI number</label>
                    <input
                      id="profileSecRegistration"
                      className="form-control"
                      value={profileForm.secRegistration}
                      onChange={(event) => setProfileField('secRegistration', event.target.value)}
                      disabled={profileSaving}
                      required
                    />
                  </div>
                </div>

                <div className="modal-panel">
                  <div className="modal-section-title">Bank details</div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profileBankName">Bank name</label>
                    <input
                      id="profileBankName"
                      className="form-control"
                      value={profileForm.bankName}
                      onChange={(event) => setProfileField('bankName', event.target.value)}
                      disabled={profileSaving}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profileAccountName">Account name</label>
                    <input
                      id="profileAccountName"
                      className="form-control"
                      value={profileForm.accountName}
                      onChange={(event) => setProfileField('accountName', event.target.value)}
                      disabled={profileSaving}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profileAccountNumber">Account number</label>
                    <input
                      id="profileAccountNumber"
                      className="form-control"
                      value={profileForm.accountNumber}
                      onChange={(event) => setProfileField('accountNumber', event.target.value)}
                      disabled={profileSaving}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mb-4">
                <button type="button" className="btn btn-outline btn-sm" onClick={resetProfileForm} disabled={profileSaving}>
                  Reset
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={profileSaving}>
                  <Pencil className="w-3.5 h-3.5" />
                  {profileSaving ? 'Saving...' : 'Save profile'}
                </button>
              </div>

              <CredentialFiles
                credentials={vendorProfile.credentials || []}
                onReplace={async (doc, file) => {
                  const payload = new FormData();
                  payload.append('file', file);
                  const profile = await api.post(`/api/vendor/profile/credentials/${doc.id}`, payload, {
                    portal: 'vendor',
                    timeout: 90000,
                  });
                  setVendorProfile(profile);
                }}
              />
            </form>
          ) : (
            <div className="vendor-placeholder">
              <Building className="w-10 h-10" />
              <h3>Company Profile</h3>
              <p>{profileError || TAB_COPY.profile}</p>
              {profileError ? (
                <button type="button" className="btn btn-outline btn-sm mt-3" onClick={loadVendorProfile}>
                  Try again
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}

      <div hidden={activeTab !== 'messages'}>
        <VendorThread
          title="TripWise Supply Chain"
          isVendor
          revision={vendorMessageRevision}
          emptyTitle="No messages yet"
          emptyDescription="Ask the supply chain team a question."
          onUnreadChange={setVendorMessageUnread}
        />
      </div>

      {pendingCancel && (
        <Modal
          onClose={() => setPendingCancel(null)}
          icon={X}
          tone="rose"
          size="sm"
          title="Cancel this RFQ"
          subtitle={`${pendingCancel.prNumber} will close for every vendor.`}
          footer={(
            <>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPendingCancel(null)}>
                Keep RFQ
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={actionLoading}
                onClick={async () => {
                  try {
                    await cancelProcurementRequest(pendingCancel.prNumber);
                    setPendingCancel(null);
                  } catch {
                    // actionError banner
                  }
                }}
              >
                Cancel RFQ
              </button>
            </>
          )}
        >
          <p className="text-sm">
            This removes {pendingCancel.itemName || pendingCancel.title || 'this request'} from Open Sourcing Opportunities.
          </p>
        </Modal>
      )}
    </div>
  );
};
