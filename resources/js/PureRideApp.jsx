import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { VendorApp } from './VendorApp';

import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { BrandLogo } from './components/layout/BrandLogo';

import { Dashboard } from './pages/Dashboard';
import { Documents } from './pages/Documents';
import { ExpiringDocuments } from './pages/ExpiringDocuments';
import { Inspection } from './pages/Inspection';
import { InventoryManagement } from './pages/InventoryManagement';
import { InventoryMovements } from './pages/InventoryMovements';
import { Notifications } from './pages/Notifications';
import { Procurement } from './pages/Procurement';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { Quotations } from './pages/Quotations';
import { Receiving } from './pages/Receiving';
import { Releases } from './pages/Releases';
import { Reports } from './pages/Reports';
import { StockCount } from './pages/StockCount';
import { StockMonitoring } from './pages/StockMonitoring';
import { StorageLocations } from './pages/StorageLocations';
import { Suppliers } from './pages/Suppliers';
import { SupplyRequests } from './pages/SupplyRequests';
import { Login } from './pages/Login';

import { AddEditItemModal } from './components/modals/AddEditItemModal';
import { CheckStockModal } from './components/modals/CheckStockModal';
import { CompareQuotationsModal } from './components/modals/CompareQuotationsModal';
import { FinanceApprovalModal } from './components/modals/FinanceApprovalModal';
import { AdjustInventoryModal } from './components/modals/AdjustInventoryModal';
import { ManualRestockModal } from './components/modals/ManualRestockModal';
import { EditProcurementModal } from './components/modals/EditProcurementModal';
import { ReceiveInspectionModal } from './components/modals/ReceiveInspectionModal';
import { StockCountModal } from './components/modals/StockCountModal';

import './App.css';
import './index.css';
import './styles/custom.css';
import './styles/layout.css';
import './styles/ui.css';

const pageMap = {
    dashboard: Dashboard,
    supply_requests: SupplyRequests,
    procurement: Procurement,
    quotations: Quotations,
    purchase_orders: PurchaseOrders,
    suppliers: Suppliers,
    items: InventoryManagement,
    stock_monitoring: StockMonitoring,
    inventory_movements: InventoryMovements,
    stock_count: StockCount,
    receiving: Receiving,
    inspection: Inspection,
    storage_locations: StorageLocations,
    releases: Releases,
    documents: Documents,
    expiring_documents: ExpiringDocuments,
    reports: Reports,
    notifications: Notifications,
};

function InternalApp() {
    const {
        user,
        bootLoading,
        bootError,
        actionError,
        activeTab,
        activeModal,
        setActiveModal,
    } = useApp();

    if (bootLoading) {
        return (
            <div className="login-screen">
                <div className="login-card">
                    <div className="login-brand">
                        <BrandLogo variant="login" subtitle="Supply Chain" />
                    </div>
                    <p className="text-sm font-bold">Loading...</p>
                </div>
            </div>
        );
    }

    if (bootError) {
        return (
            <div className="login-screen">
                <div className="login-card">
                    <div className="login-brand">
                        <BrandLogo variant="login" subtitle="Supply Chain" />
                    </div>
                    <p className="text-sm font-bold">{bootError}</p>
                </div>
            </div>
        );
    }

    if (!user || user.role === 'supplier') {
        return <Login portal="internal" />;
    }

    const CurrentPage = pageMap[activeTab] || Dashboard;

    return (
        <div className="app-shell">
            <Sidebar />

            <div className="main-wrapper">
                <Header />

                <main className="main-content">
                    {actionError && (
                        <div className="login-error action-banner">
                            <p className="text-xs font-bold">{actionError}</p>
                        </div>
                    )}
                    <CurrentPage />
                </main>
            </div>

            {activeModal === 'add_item' && (
                <AddEditItemModal
                    onClose={() => setActiveModal(null)}
                />
            )}

            {activeModal === 'edit_item' && (
               <AddEditItemModal
                    onClose={() => setActiveModal(null)}
                />
            )}

            {activeModal === 'check_stock' && (
                <CheckStockModal
                    onClose={() => setActiveModal(null)}
                />
            )}

            {activeModal === 'compare_quotes' && (
                <CompareQuotationsModal
                    onClose={() => setActiveModal(null)}
                />
            )}

            {activeModal === 'finance_approval' && (
                <FinanceApprovalModal
                    onClose={() => setActiveModal(null)}
                />
            )}

            {activeModal === 'receive_delivery' && (
                <ReceiveInspectionModal
                    onClose={() => setActiveModal(null)}
                />
            )}

            {activeModal === 'stock_count' && (
                <StockCountModal
                    onClose={() => setActiveModal(null)}
                />
            )}

            {activeModal === 'manual_restock' && (
                <ManualRestockModal />
            )}

            {activeModal === 'adjust_stock' && (
                <AdjustInventoryModal />
            )}

            {activeModal === 'edit_procurement' && (
                <EditProcurementModal />
            )}
        </div>
    );
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/vendor/*" element={<VendorApp />} />
            <Route path="/" element={<InternalApp />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function PureRideApp() {
    return (
        <AppProvider>
            <AppRoutes />
        </AppProvider>
    );
}
