import React from 'react';
import { Download } from 'lucide-react';
import { openProtectedFile } from '../../services/api';

export const CredentialFiles = ({ credentials = [] }) => {
  const openFile = async (doc) => {
    const path = doc.downloadUrl || doc.fileUrl;
    if (!path) {
      return;
    }
    try {
      await openProtectedFile(path);
    } catch {
      if (doc.fileUrl && doc.fileUrl !== path) {
        window.open(doc.fileUrl, '_blank', 'noopener');
      }
    }
  };

  return (
    <div className="modal-section">
      <div className="modal-section-title">Submitted documents</div>
      {credentials.length === 0 ? (
        <p className="text-xs text-secondary">No mayor&apos;s permit or SEC/DTI file has been uploaded yet.</p>
      ) : (
        <div className="vendor-credential-list">
          {credentials.map((doc) => (
            <div key={doc.id} className="vendor-credential-row">
              <div>
                <strong>{doc.title}</strong>
                <p>
                  {doc.type}
                  {doc.expirationDate ? ` · expires ${doc.expirationDate}` : ''}
                  {doc.originalFilename ? ` · ${doc.originalFilename}` : ''}
                </p>
              </div>
              {(doc.downloadUrl || doc.fileUrl) ? (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => openFile(doc)}>
                  <Download className="w-3.5 h-3.5" /> View file
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
