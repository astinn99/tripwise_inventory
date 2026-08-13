import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FileText, Plus, AlertTriangle, CheckCircle2, Search, Filter, Download } from 'lucide-react';
import { Modal } from '../components/ui/Modal';

export const Documents = () => {
  const { documents, addDocument, searchQuery } = useApp();

  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showAddDocModal, setShowAddDocModal] = useState(false);

  const [newDocForm, setNewDocForm] = useState({
    title: '',
    type: 'Warranty',
    referenceNumber: '',
    supplier: 'NaviTrack Philippines',
    expirationDate: '',
    category: 'Communication Equipment'
  });

  const filteredDocs = documents.filter(doc => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'ALL' || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleCreateDoc = (e) => {
    e.preventDefault();
    addDocument({
      ...newDocForm,
      status: 'Active',
      fileSize: '1.5 MB'
    });
    setShowAddDocModal(false);
  };

  return (
    <div className="documents-page">
      {/* DTRS Banner */}
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">DTRS SUBSYSTEM</span>
          <div>
            <h2 className="subsystem-heading">Document Tracking & Logistics Records System (DTRS)</h2>
            <p className="subsystem-subtext">Archives supply chain contracts, warranties, insurance, PO receipts, and monitors document expiration dates.</p>
          </div>
        </div>
        <button onClick={() => setShowAddDocModal(true)} className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" /> Add Document to DTRS
        </button>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-bold uppercase">Document Type:</span>
          <div className="flex gap-1 flex-wrap">
            {['ALL', 'Warranty', 'Insurance', 'Contract', 'Purchase Order', 'Invoice', 'Inspection Report'].map(t => (
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

      {/* Documents Table */}
      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <FileText className="w-5 h-5 text-blue-400" /> Logistics Documents Repository ({filteredDocs.length})
          </span>
        </div>

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
              {filteredDocs.map(doc => (
                <tr key={doc.id}>
                  <td className="font-mono text-xs text-blue-400 font-bold">{doc.id}</td>
                  <td className="font-bold text-xs text-white">{doc.title}</td>
                  <td><span className="badge badge-info">{doc.type}</span></td>
                  <td className="font-mono text-xs text-purple-400">{doc.referenceNumber}</td>
                  <td className="text-xs text-slate-300">{doc.supplier}</td>
                  <td className="text-xs text-slate-400">{doc.category}</td>
                  <td className="text-xs text-slate-300">{doc.issueDate}</td>
                  <td className="text-xs font-bold text-amber-400">{doc.expirationDate}</td>
                  <td>
                    <span className={`badge badge-${doc.status.toLowerCase().replace(/ /g, '-')}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <button onClick={() => alert(`Downloading DTRS Archive Document: ${doc.title}`)} className="btn btn-outline btn-sm p-1">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddDocModal && (
        <Modal
          asForm
          onSubmit={handleCreateDoc}
          onClose={() => setShowAddDocModal(false)}
          icon={FileText}
          tone="violet"
          size="md"
          title="Upload Document to DTRS"
          subtitle="Archive a warranty, contract, invoice, or insurance record."
          footer={(
            <>
              <button type="button" onClick={() => setShowAddDocModal(false)} className="btn btn-outline btn-sm">Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm">Archive Document</button>
            </>
          )}
        >
          <div className="form-group">
            <label className="form-label">Document Title</label>
            <input
              type="text"
              required
              className="form-control"
              placeholder="e.g. Master Telematics Warranty Certificate"
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
                <option value="Warranty">Warranty</option>
                <option value="Insurance">Insurance</option>
                <option value="Contract">Contract</option>
                <option value="Purchase Order">Purchase Order</option>
                <option value="Invoice">Invoice</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reference #</label>
              <input
                type="text"
                required
                className="form-control font-mono"
                value={newDocForm.referenceNumber}
                onChange={(e) => setNewDocForm({ ...newDocForm, referenceNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group mb-0">
              <label className="form-label">Supplier / Entity</label>
              <input
                type="text"
                required
                className="form-control"
                value={newDocForm.supplier}
                onChange={(e) => setNewDocForm({ ...newDocForm, supplier: e.target.value })}
              />
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Expiration Date</label>
              <input
                type="date"
                required
                className="form-control"
                value={newDocForm.expirationDate}
                onChange={(e) => setNewDocForm({ ...newDocForm, expirationDate: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
