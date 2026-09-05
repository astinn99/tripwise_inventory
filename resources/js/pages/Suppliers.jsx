import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Users, Phone, Mail, Building, Star, MessageSquare } from 'lucide-react';
import { Modal, displayValue } from '../components/ui/Modal';
import { api } from '../services/api';
import { CredentialFiles } from '../components/ui/CredentialFiles';

export const Suppliers = () => {
  const { suppliers, searchQuery, approveSupplier, actionLoading, openVendorMessages } = useApp();
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [profile, setProfile] = useState(null);
  const profileRequestRef = useRef(0);

  const filteredSuppliers = suppliers.filter(s =>
    s.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.categories || []).some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const statusClass = (status) => (
    status === 'Pending Approval' ? 'badge-pending' : 'badge-active'
  );

  const openProfile = async (supplier) => {
    const requestId = profileRequestRef.current + 1;
    profileRequestRef.current = requestId;
    setSelectedSupplier(supplier);
    setProfile(supplier);
    try {
      const detail = await api.get(`/api/suppliers/${supplier.id}`);
      if (profileRequestRef.current !== requestId) {
        return;
      }
      setProfile(detail);
      setSelectedSupplier(detail);
    } catch {
      if (profileRequestRef.current !== requestId) {
        return;
      }
      setProfile(supplier);
    }
  };

  const closeProfile = () => {
    profileRequestRef.current += 1;
    setSelectedSupplier(null);
    setProfile(null);
  };

  const handleApprove = async () => {
    if (!selectedSupplier) {
      return;
    }
    try {
      const updated = await approveSupplier(selectedSupplier.id);
      if (updated) {
        setSelectedSupplier(updated);
        setProfile(updated);
      }
    } catch {
      // Surface via actionError banner.
    }
  };

  return (
    <div className="suppliers-page">
      {/* Subsystem Banner */}
      <div className="subsystem-banner">
        <div className="subsystem-title-group">
          <span className="subsystem-badge">VENDOR MANAGEMENT</span>
          <div>
            <h2 className="subsystem-heading">Supplier & Vendor Directory & Performance</h2>
            <p className="subsystem-subtext">Manages registered vendors, legal credentials (TIN, SEC/DTI, Business Permits), and quality performance metrics.</p>
          </div>
        </div>
      </div>

      {/* Supplier Directory Table */}
      <div className="panel-card mb-6">
        <div className="panel-header">
          <span className="panel-title">
            <Users className="w-5 h-5 text-blue-400" /> Registered Vendors ({filteredSuppliers.length})
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Supplier ID</th>
                <th>Company Name</th>
                <th>Contact Person</th>
                <th>Categories</th>
                <th className="text-center">Overall Score</th>
                <th>Quality %</th>
                <th>Delivery %</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map(s => (
                <tr key={s.id}>
                  <td className="font-mono text-xs text-blue-400 font-bold">{s.id}</td>
                  <td>
                    <div className="font-bold text-xs text-white">{s.companyName}</div>
                    <div className="text-xs text-slate-400">{s.phone} | {s.email}</div>
                  </td>
                  <td className="text-xs text-slate-300">{s.contactPerson}</td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {(s.categories || []).map((c, i) => (
                        <span key={i} className="badge badge-info">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="text-center font-bold text-emerald-400">
                    <span className="badge badge-normal">★ {s.overallScore}</span>
                  </td>
                  <td className="text-xs font-bold text-blue-400">{s.qualityScore}%</td>
                  <td className="text-xs font-bold text-emerald-400">{s.deliveryPerformance}%</td>
                  <td><span className={`badge ${statusClass(s.status)}`}>{s.status}</span></td>
                  <td className="text-right">
                    <button
                      onClick={() => openProfile(s)}
                      className="btn btn-outline btn-sm"
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSupplier && (
        <Modal
          onClose={closeProfile}
          icon={Building}
          tone="blue"
          size="lg"
          title="Supplier Legal & Financial Profile"
          subtitle="Credentials, uploaded permits, banking details, and rolling performance scores."
          footer={(
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const supplierId = selectedSupplier.id;
                  closeProfile();
                  openVendorMessages(supplierId);
                }}
              >
                <MessageSquare className="w-4 h-4" /> Message vendor
              </button>
              {selectedSupplier.status !== 'Active' ? (
                <button type="button" onClick={handleApprove} className="btn btn-primary btn-sm" disabled={actionLoading}>
                  {actionLoading ? 'Approving...' : 'Approve vendor'}
                </button>
              ) : null}
              <button onClick={closeProfile} className="btn btn-outline btn-sm">Close Profile</button>
            </>
          )}
        >
          <div className="modal-hero">
            <div className="flex items-start gap-3">
              <span className="modal-avatar">
                {(selectedSupplier.companyName || 'S').slice(0, 2).toUpperCase()}
              </span>
              <div className="modal-hero-main">
                <div className="modal-kicker">{selectedSupplier.id}</div>
                <h4>{selectedSupplier.companyName}</h4>
                <div className="modal-hero-meta">{displayValue(selectedSupplier.address)}</div>
                <div className="modal-chip-row">
                  <span className="modal-chip"><Phone className="w-3.5 h-3.5" /> {displayValue(selectedSupplier.phone)}</span>
                  <span className="modal-chip"><Mail className="w-3.5 h-3.5" /> {displayValue(selectedSupplier.email)}</span>
                </div>
              </div>
            </div>
            <div className="modal-hero-aside">
              <span className="modal-stat-label">Overall rating</span>
              <span className="modal-stat-value is-amber">{displayValue(selectedSupplier.rating)} / 5.0</span>
              <div className="modal-stars mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className={star <= Math.round(Number(selectedSupplier.rating) || 0) ? 'is-on' : ''} />
                ))}
              </div>
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">Performance scorecard</div>
            <div className="modal-stat-grid cols-4">
              <div className="modal-stat">
                <span className="modal-stat-label">Quality</span>
                <span className="modal-stat-value is-emerald">{displayValue(selectedSupplier.qualityScore)}%</span>
                <div className="modal-meter is-emerald"><span style={{ width: `${Number(selectedSupplier.qualityScore) || 0}%` }} /></div>
              </div>
              <div className="modal-stat">
                <span className="modal-stat-label">Responsiveness</span>
                <span className="modal-stat-value is-blue">{displayValue(selectedSupplier.responsivenessScore)}%</span>
                <div className="modal-meter is-blue"><span style={{ width: `${Number(selectedSupplier.responsivenessScore) || 0}%` }} /></div>
              </div>
              <div className="modal-stat">
                <span className="modal-stat-label">On-time delivery</span>
                <span className="modal-stat-value is-violet">{displayValue(selectedSupplier.deliveryPerformance)}%</span>
                <div className="modal-meter is-violet"><span style={{ width: `${Number(selectedSupplier.deliveryPerformance) || 0}%` }} /></div>
              </div>
              <div className="modal-stat">
                <span className="modal-stat-label">Pricing</span>
                <span className="modal-stat-value is-amber">{displayValue(selectedSupplier.pricingScore)}%</span>
                <div className="modal-meter is-amber"><span style={{ width: `${Number(selectedSupplier.pricingScore) || 0}%` }} /></div>
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="modal-panel">
              <div className="modal-section-title">Legal registrations</div>
              <div className="modal-dl">
                <div className="modal-dl-row"><span>TIN</span><strong>{displayValue(selectedSupplier.taxId)}</strong></div>
                <div className="modal-dl-row"><span>SEC / DTI #</span><strong>{displayValue(selectedSupplier.secRegistration)}</strong></div>
                <div className="modal-dl-row"><span>Status</span><strong>{displayValue(selectedSupplier.status)}</strong></div>
              </div>
            </div>
            <div className="modal-panel">
              <div className="modal-section-title">Financial & bank info</div>
              <div className="modal-dl">
                <div className="modal-dl-row"><span>Bank details</span><strong>{displayValue(selectedSupplier.bankDetails)}</strong></div>
                <div className="modal-dl-row"><span>Payment terms</span><strong>30 Days Net</strong></div>
                <div className="modal-dl-row"><span>Active POs</span><strong>{displayValue(selectedSupplier.activeOrders)} POs</strong></div>
              </div>
            </div>
          </div>

          <CredentialFiles credentials={profile?.credentials || selectedSupplier.credentials || []} />
        </Modal>
      )}
    </div>
  );
};
