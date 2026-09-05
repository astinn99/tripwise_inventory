import React, { useRef, useState } from 'react';
import { AlertTriangle, Download, Pencil } from 'lucide-react';
import { ApiError, openProtectedFile } from '../../services/api';

export const CredentialFiles = ({ credentials = [], onReplace }) => {
  const fileInputs = useRef({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

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

  const chooseReplacement = (doc) => {
    setError('');
    fileInputs.current[doc.id]?.click();
  };

  const handleReplacement = async (doc, file) => {
    if (!file || !onReplace) {
      return;
    }

    setBusyId(doc.id);
    setError('');
    try {
      await onReplace(doc, file);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update this document.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="modal-section">
      <div className="modal-section-title">Submitted documents</div>
      {error ? (
        <div className="vendor-alert-banner is-urgent" role="alert">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <strong>Could not update document</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : null}
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
              <div className="flex items-center gap-2 flex-wrap">
                {(doc.downloadUrl || doc.fileUrl) ? (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openFile(doc)}>
                    <Download className="w-3.5 h-3.5" /> View file
                  </button>
                ) : null}
                {onReplace ? (
                  <>
                    <input
                      ref={(node) => {
                        fileInputs.current[doc.id] = node;
                      }}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        event.target.value = '';
                        handleReplacement(doc, file);
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busyId === doc.id}
                      onClick={() => chooseReplacement(doc)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {busyId === doc.id ? 'Updating...' : 'Update'}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
