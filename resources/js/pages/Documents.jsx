import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { FileText, Plus, Filter, Download, Upload } from 'lucide-react';
import { Modal } from '../components/ui/Modal';

const DOC_TYPES = ['ALL', 'Warranty', 'Insurance', 'Contract', 'Purchase Order', 'Invoice', 'Inspection Report'];
const EXPIRY_REQUIRED = ['Warranty', 'Insurance', 'Contract'];

const emptyForm = {
  title: '',
  type: 'Warranty',
  referenceNumber: '',
  supplierId: '',
  expirationDate: '',
  category: '',
  itemCode: '',
  purchaseOrderNumber: '',
  warrantyMonths: '12',
};

export const Documents = () => {
  const { documents, addDocument, searchQuery, suppliers, inventory, purchaseOrders } = useApp();
  const fileRef = useRef(null);

  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [newDocForm, setNewDocForm] = useState(emptyForm);
  const [file, setFile] = useState(null);

  const filteredDocs = documents.filter((doc) => {
    const haystack = [doc.title, doc.referenceNumber, doc.supplier, doc.category, doc.itemCode]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesSearch = haystack.includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const closeModal = () => {
    setShowAddDocModal(false);
    setNewDocForm(emptyForm);
    setFile(null);
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  };

  const handleCreateDoc = async (e) => {
    e.preventDefault();
    const supplier = suppliers.find((s) => String(s.id) === String(newDocForm.supplierId));
    try {
      await addDocument({
        ...newDocForm,
        supplier: supplier?.companyName || supplier?.name || '',
        supplierId: newDocForm.supplierId || undefined,
        warrantyMonths: newDocForm.type === 'Warranty' ? newDocForm.warrantyMonths : undefined,
        file,
      });
      closeModal();
    } catch {
      // Action error is shown by AppContext.
    }
  };

  const expiryRequired = EXPIRY_REQUIRED.includes(newDocForm.type);

  return (
    <div className="documents-page">
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">DTRS SUBSYSTEM</span>
          <div>
            <h2 className="subsystem-heading">Document Tracking & Logistics Records System (DTRS)</h2>
            <p className="subsystem-subtext">
              Archive warranty certificates, contracts, insurance, and PO papers. Set an expiration date so Expiring Documents can alert you.
            </p>
          </div>
        </div>
        <button onClick={() => setShowAddDocModal(true)} className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" /> Add Document to DTRS
        </button>
      </div>

      <div className="filter-bar">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-bold uppercase">Document Type:</span>
          <div className="flex gap-1 flex-wrap">
            {DOC_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`btn btn-sm ${typeFilter === t ? 'btn-primary' : 'btn-outline'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <FileText className="w-5 h-5 text-blue-400" /> Logistics Documents Repository ({filteredDocs.length})
          </span>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="empty-state">
            <p>No documents in DTRS yet. Use Add Document to archive a warranty, contract, invoice, or insurance file.</p>
            <p>Vendor warranties also appear here automatically after a delivery inspection passes.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Document ID</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Reference #</th>
                  <th>Supplier / Issuer</th>
                  <th>Category</th>
                  <th>Issue Date</th>
                  <th>Expiration Date</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td className="font-mono text-xs text-blue-400 font-bold">{doc.id}</td>
                    <td className="font-bold text-xs text-white">{doc.title}</td>
                    <td><span className="badge badge-info">{doc.type}</span></td>
                    <td className="font-mono text-xs text-purple-400">{doc.referenceNumber || '—'}</td>
                    <td className="text-xs text-slate-300">{doc.supplier || '—'}</td>
                    <td className="text-xs text-slate-400">{doc.category || '—'}</td>
                    <td className="text-xs text-slate-300">{doc.issueDate || '—'}</td>
                    <td className="text-xs font-bold text-amber-400">{doc.expirationDate || '—'}</td>
                    <td>
                      <span className={`badge badge-${doc.status.toLowerCase().replace(/ /g, '-')}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="text-right">
                      {doc.fileUrl ? (
                        <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm p-1" title="Open file">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">No file</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddDocModal && (
        <Modal
          asForm
          onSubmit={handleCreateDoc}
          onClose={closeModal}
          icon={FileText}
          tone="violet"
          size="md"
          title="Upload Document to DTRS"
          subtitle="Click Choose file to attach the PDF or photo, then fill in the title and expiration date."
          footer={(
            <>
              <button type="button" onClick={closeModal} className="btn btn-outline btn-sm">Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm">Archive Document</button>
            </>
          )}
        >
          <div className="form-group">
            <label className="form-label">Attach file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="item-photo-input"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div className="document-file-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4" /> Choose file
              </button>
              <span className="document-file-name">
                {file ? file.name : 'No file selected'}
              </span>
            </div>
            <p className="item-photo-hint">PDF, JPG, or PNG up to 10 MB. This is the actual warranty, contract, or invoice.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Document Title</label>
            <input
              type="text"
              required
              className="form-control"
              placeholder="e.g. Radio handset warranty certificate"
              value={newDocForm.title}
              onChange={(e) => setNewDocForm({ ...newDocForm, title: e.target.value })}
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Document Type</label>
              <select
                className="form-select"
                value={newDocForm.type}
                onChange={(e) => setNewDocForm({ ...newDocForm, type: e.target.value })}
              >
                {DOC_TYPES.filter((t) => t !== 'ALL').map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reference #</label>
              <input
                type="text"
                className="form-control font-mono"
                placeholder="PO, policy, or serial"
                value={newDocForm.referenceNumber}
                onChange={(e) => setNewDocForm({ ...newDocForm, referenceNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Supplier / Issuer</label>
              <select
                className="form-select"
                value={newDocForm.supplierId}
                onChange={(e) => setNewDocForm({ ...newDocForm, supplierId: e.target.value })}
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id || s.code} value={s.id}>{s.companyName || s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Expiration Date{expiryRequired ? '' : ' (optional)'}</label>
              <input
                type="date"
                required={expiryRequired}
                className="form-control"
                value={newDocForm.expirationDate}
                onChange={(e) => setNewDocForm({ ...newDocForm, expirationDate: e.target.value })}
              />
            </div>
          </div>

          {newDocForm.type === 'Warranty' && (
            <div className="form-group">
              <label className="form-label">Warranty coverage (months)</label>
              <select
                className="form-select"
                value={newDocForm.warrantyMonths}
                onChange={(e) => setNewDocForm({ ...newDocForm, warrantyMonths: e.target.value })}
              >
                {[6, 12, 18, 24, 36, 48, 60].map((m) => (
                  <option key={m} value={m}>{m} months</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid-2">
            <div className="form-group mb-0">
              <label className="form-label">Linked item (optional)</label>
              <select
                className="form-select"
                value={newDocForm.itemCode}
                onChange={(e) => setNewDocForm({ ...newDocForm, itemCode: e.target.value })}
              >
                <option value="">None</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.itemCode}>{item.itemCode} — {item.itemName || item.description}</option>
                ))}
              </select>
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Linked PO (optional)</label>
              <select
                className="form-select"
                value={newDocForm.purchaseOrderNumber}
                onChange={(e) => setNewDocForm({ ...newDocForm, purchaseOrderNumber: e.target.value })}
              >
                <option value="">None</option>
                {purchaseOrders.map((po) => (
                  <option key={po.poNumber} value={po.poNumber}>{po.poNumber} — {po.supplier}</option>
                ))}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
