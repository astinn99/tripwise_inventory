import React from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, Download, FileText } from 'lucide-react';

export const ExpiringDocuments = () => {
  const { documents, searchQuery, setActiveTab } = useApp();

  const expiringDocs = documents.filter((d) => {
    const isExpiring = d.status === 'Expiring Soon' || d.status === 'Expired';
    if (!isExpiring) {
      return false;
    }
    const haystack = [d.title, d.referenceNumber, d.supplier, d.id]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="expiring-documents-page">
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">DTRS EXPIRATION MONITORING</span>
          <div>
            <h2 className="subsystem-heading">Expiring Contracts, Warranties & Insurance Policies</h2>
            <p className="subsystem-subtext">
              Shows documents whose expiration date is within 30 days or already past. A daily check also posts notifications at 90, 60, 30, 7, and 0 days.
            </p>
          </div>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <AlertTriangle className="w-5 h-5 text-amber-400" /> Expiring Documents Queue ({expiringDocs.length})
          </span>
        </div>

        {expiringDocs.length === 0 ? (
          <div className="empty-state">
            <p>No warranties or contracts are expiring in the next 30 days.</p>
            <p>Archive a document with an expiration date in DTRS, or receive a vendor warranty through inspection.</p>
            <button type="button" className="btn btn-outline btn-sm mt-3" onClick={() => setActiveTab('documents')}>
              <FileText className="w-4 h-4" /> Open DTRS
            </button>
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
                  <th>Supplier / Partner</th>
                  <th>Expiration Date</th>
                  <th>Days left</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {expiringDocs.map((doc) => (
                  <tr key={doc.id} className={doc.status === 'Expired' ? 'bg-rose-950/20' : 'bg-amber-950/20'}>
                    <td className="font-mono text-xs text-blue-400 font-bold">{doc.id}</td>
                    <td className="font-bold text-xs text-white">{doc.title}</td>
                    <td><span className="badge badge-info">{doc.type}</span></td>
                    <td className="font-mono text-xs text-purple-400">{doc.referenceNumber || '—'}</td>
                    <td className="text-xs text-slate-300">{doc.supplier || '—'}</td>
                    <td className="text-xs font-bold text-amber-400">{doc.expirationDate}</td>
                    <td className="text-xs font-bold">
                      {doc.daysRemaining < 0 ? `${Math.abs(doc.daysRemaining)} days overdue` : `${doc.daysRemaining} days`}
                    </td>
                    <td>
                      <span className={`badge badge-${doc.status.toLowerCase().replace(/ /g, '-')}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="text-right">
                      {doc.fileUrl ? (
                        <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                          <Download className="w-3.5 h-3.5" /> Open
                        </a>
                      ) : (
                        <button type="button" className="btn btn-warning btn-sm" onClick={() => setActiveTab('documents')}>
                          Open in DTRS
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
    </div>
  );
};
