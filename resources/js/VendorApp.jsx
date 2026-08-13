import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { VendorSidebar } from './components/layout/VendorSidebar';
import { VendorHeader } from './components/layout/VendorHeader';
import { VendorPortal } from './pages/VendorPortal';
import { Login } from './pages/Login';

export function VendorApp() {
  const { user, bootLoading, bootError, actionError } = useApp();
  const navigate = useNavigate();
  const [vendorTab, setVendorTab] = useState('dashboard');

  useEffect(() => {
    if (!bootLoading && user && user.role !== 'supplier') {
      navigate('/', { replace: true });
    }
  }, [user, bootLoading, navigate]);

  if (bootLoading) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <p className="text-sm font-bold">Loading Vendor Portal...</p>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="panel-card p-6">
          <p className="text-sm font-bold">{bootError}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login portal="vendor" />;
  }

  if (user.role !== 'supplier') {
    return null;
  }

  return (
    <div className="app-shell">
      <VendorSidebar activeTab={vendorTab} setActiveTab={setVendorTab} />

      <div className="main-wrapper">
        <VendorHeader />

        <main className="main-content">
          {actionError && (
            <div className="login-error action-banner">
              <p className="text-xs font-bold">{actionError}</p>
            </div>
          )}
          <VendorPortal activeTab={vendorTab} setActiveTab={setVendorTab} />
        </main>
      </div>
    </div>
  );
}
