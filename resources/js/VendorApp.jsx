import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { VendorSidebar } from './components/layout/VendorSidebar';
import { VendorHeader } from './components/layout/VendorHeader';
import { BrandLogo } from './components/layout/BrandLogo';
import { VendorPortal } from './pages/VendorPortal';
import { Login } from './pages/Login';

export function VendorApp() {
  const { user, collectionsLoading, bootError, actionError } = useApp();
  const [vendorTab, setVendorTab] = useState('dashboard');

  if (bootError) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-brand">
            <BrandLogo variant="login" subtitle="Vendor Portal" />
          </div>
          <p className="text-sm font-bold">{bootError}</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'supplier') {
    return <Login portal="vendor" />;
  }

  return (
    <div className="app-shell">
      <VendorSidebar activeTab={vendorTab} setActiveTab={setVendorTab} />

      <div className="main-wrapper">
        {collectionsLoading ? <div className="data-loading-bar" /> : null}
        <VendorHeader activeTab={vendorTab} />

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
