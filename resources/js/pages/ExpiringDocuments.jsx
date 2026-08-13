import React from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, FileText, Clock, RefreshCw } from 'lucide-react';

export const ExpiringDocuments = () => {
  const { documents } = useApp();

  const expiringDocs = documents.filter(d => d.status === 'Expiring Soon' || d.status === 'Expired');

  return (
    <div className="expiring-documents-page">
      {/* Banner */}
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">DTRS EXPIRATION MONITORING</span>
          <div>
            <h2 className="subsystem-heading">Expiring Contracts, Warranties & Insurance Policies</h2>
            <p className="subsystem-subtext">Automatic alerts for legal documents, vendor service contracts, and equipment warranties requiring renewal.</p>
          </div>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <AlertTriangle className="w-5 h-5 text-amber-400" /> Expiring Documents Queue ({expiringDocs.length})
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
                <th>Supplier / Partner</th>
                <th>Expiration Date</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {expiringDocs.map(doc => (
                <tr key={doc.id} className={doc.status === 'Expired' ? 'bg-rose-950/20' : 'bg-amber-950/20'}>
                  <td className="font-mono text-xs text-blue-400 font-bold">{doc.id}</td>
                  <td className="font-bold text-xs text-white">{doc.title}</td>
                  <td><span className="badge badge-info">{doc.type}</span></td>
                  <td className="font-mono text-xs text-purple-400">{doc.referenceNumber}</td>
                  <td className="text-xs text-slate-300">{doc.supplier}</td>
                  <td className="text-xs font-bold text-amber-400">{doc.expirationDate}</td>
                  <td>
                    <span className={`badge badge-${doc.status.toLowerCase().replace(/ /g, '-')}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <button onClick={() => alert(`Initiating Renewal for ${doc.title}`)} className="btn btn-warning btn-sm">
                      <RefreshCw className="w-3.5 h-3.5" /> Initiate Renewal
                    </button>
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
