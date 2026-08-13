import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError, resetCsrf } from '../services/api';
import { createEcho } from '../echo';

const AppContext = createContext();

const emptyCollections = {
    inventory: [],
    supplyRequests: [],
    procurementRequests: [],
    quotations: [],
    purchaseOrders: [],
    suppliers: [],
    deliveries: [],
    storageLocations: [],
    releases: [],
    movements: [],
    stockCounts: [],
    documents: [],
    notifications: [],
    opportunities: [],
    movementTrend: [],
    lowStockTrend: [],
};

export const AppProvider = ({ children }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [user, setUser] = useState(null);
    const [bootLoading, setBootLoading] = useState(true);
    const [bootError, setBootError] = useState('');
    const [actionError, setActionError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [collections, setCollections] = useState(emptyCollections);
    const [activeModal, setActiveModal] = useState(null);
    const [modalData, setModalData] = useState(null);
    const echoRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    const applyUser = (nextUser) => {
        setUser(nextUser);
        if (nextUser?.role === 'supplier') {
            if (!location.pathname.startsWith('/vendor')) {
                navigate('/vendor', { replace: true });
            }
            return;
        }

        if (nextUser && location.pathname.startsWith('/vendor')) {
            navigate('/', { replace: true });
        }
    };

    const loadCollections = async (currentUser = user) => {
        if (!currentUser) {
            setCollections(emptyCollections);
            return;
        }

        if (currentUser.role === 'supplier') {
            const [quotations, purchaseOrders, opportunities, notifications] = await Promise.all([
                api.get('/api/quotations'),
                api.get('/api/purchase-orders'),
                api.get('/api/opportunities'),
                api.get('/api/notifications'),
            ]);
            setCollections({
                ...emptyCollections,
                quotations: quotations || [],
                purchaseOrders: purchaseOrders || [],
                opportunities: opportunities || [],
                notifications: notifications || [],
            });
            return;
        }

        const [
            inventory,
            supplyRequests,
            procurementRequests,
            quotations,
            purchaseOrders,
            suppliers,
            deliveries,
            storageLocations,
            releases,
            movements,
            stockCounts,
            documents,
            notifications,
            opportunities,
            dashboard,
        ] = await Promise.all([
            api.get('/api/inventory-items'),
            api.get('/api/supply-requests'),
            api.get('/api/procurement-requests'),
            api.get('/api/quotations'),
            api.get('/api/purchase-orders'),
            api.get('/api/suppliers'),
            api.get('/api/deliveries'),
            api.get('/api/storage-locations'),
            api.get('/api/releases'),
            api.get('/api/inventory-movements'),
            api.get('/api/stock-counts'),
            api.get('/api/documents'),
            api.get('/api/notifications'),
            api.get('/api/opportunities'),
            api.get('/api/dashboard'),
        ]);

        setCollections({
            inventory: inventory || [],
            supplyRequests: supplyRequests || [],
            procurementRequests: procurementRequests || [],
            quotations: quotations || [],
            purchaseOrders: purchaseOrders || [],
            suppliers: suppliers || [],
            deliveries: deliveries || [],
            storageLocations: storageLocations || [],
            releases: releases || [],
            movements: movements || [],
            stockCounts: stockCounts || [],
            documents: documents || [],
            notifications: notifications || [],
            opportunities: opportunities || [],
            movementTrend: dashboard?.movementTrend || [],
            lowStockTrend: dashboard?.lowStockTrend || [],
        });
    };

    const runAction = async (callback) => {
        setActionError('');
        setActionLoading(true);
        try {
            const result = await callback();
            await loadCollections();
            return result;
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                setUser(null);
                setCollections(emptyCollections);
            }
            setActionError(error.message || 'Request failed');
            throw error;
        } finally {
            setActionLoading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            setBootLoading(true);
            setBootError('');
            try {
                const current = await api.get('/api/user');
                if (cancelled) return;
                applyUser(current);
                await loadCollections(current);
            } catch (error) {
                if (cancelled) return;
                if (error instanceof ApiError && error.status === 401) {
                    setUser(null);
                } else {
                    setBootError(error.message || 'Unable to load the application.');
                }
            } finally {
                if (!cancelled) {
                    setBootLoading(false);
                }
            }
        };

        bootstrap();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!user) {
            echoRef.current?.disconnect();
            echoRef.current = null;
            return undefined;
        }

        const echo = createEcho();
        echoRef.current = echo;
        if (!echo) {
            return undefined;
        }

        echo.private('supply-chain')
            .listen('.notification.created', (event) => {
                if (event.notification) {
                    setCollections((prev) => ({
                        ...prev,
                        notifications: [event.notification, ...prev.notifications.filter((item) => item.id !== event.notification.id)],
                    }));
                }
            })
            .listen('.stock.updated', () => {
                loadCollections();
            })
            .listen('.purchase-order.updated', () => {
                loadCollections();
            })
            .listen('.quotation.submitted', () => {
                loadCollections();
            })
            .listen('.opportunity.published', () => {
                loadCollections();
            });

        return () => {
            echo.leave('supply-chain');
            echo.disconnect();
            echoRef.current = null;
        };
    }, [user?.id]);

    const login = async (email, password) => {
        resetCsrf();
        const current = await api.post('/api/login', { email, password });
        applyUser(current);
        await loadCollections(current);
        return current;
    };

    const logout = async () => {
        try {
            await api.post('/api/logout');
        } finally {
            echoRef.current?.disconnect();
            echoRef.current = null;
            resetCsrf();
            setUser(null);
            setCollections(emptyCollections);
            setActiveTab('dashboard');
        }
    };

    const processSupplyRequestStock = (requestId) =>
        runAction(() => api.post(`/api/supply-requests/${requestId}/check-stock`));

    const selectSupplierAndCreatePO = (procurementId, quotationId) =>
        runAction(() => api.post(`/api/quotations/${quotationId}/select`));

    const updateFinanceApproval = (poNumber, status, remarks = '') =>
        runAction(() => api.post(`/api/purchase-orders/${poNumber}/finance-decision`, { status, remarks }));

    const supplierConfirmPO = (poNumber) =>
        runAction(() => api.post(`/api/purchase-orders/${poNumber}/confirm`));

    const processDeliveryInspection = (deliveryId, itemsDelivered, inspectionResult, remarks) =>
        runAction(() => api.post(`/api/deliveries/${deliveryId}/inspect`, {
            itemsDelivered,
            inspectionResult,
            remarks,
        }));

    const releaseSupplyRequest = (requestId, releasedTo) =>
        runAction(() => api.post(`/api/supply-requests/${requestId}/release`, { releasedTo }));

    const saveInventoryItem = (itemData) =>
        runAction(() => (
            itemData.id
                ? api.put(`/api/inventory-items/${itemData.id}`, itemData)
                : api.post('/api/inventory-items', itemData)
        ));

    const startStockCount = (title, location) =>
        runAction(async () => {
            const count = await api.post('/api/stock-counts', { title, location });
            setModalData(count);
            setActiveModal('stock_count');
            return count;
        });

    const submitPhysicalCount = (countId, updatedItems) =>
        runAction(() => api.post(`/api/stock-counts/${countId}/submit`, { items: updatedItems }));

    const submitSupplierQuotation = (newQuote) =>
        runAction(() => api.post('/api/quotations', newQuote));

    const updateSupplierQuotation = (quoteId, quoteData) =>
        runAction(() => api.put(`/api/quotations/${quoteId}`, quoteData));

    const addDocument = (doc) =>
        runAction(() => api.post('/api/documents', doc));

    const createManualProcurementRequest = (itemCode, quantity, reason, priority) =>
        runAction(() => api.post('/api/procurement-requests', { itemCode, quantity, reason, priority }));

    const sendProcurementToVendors = (procurementId) =>
        runAction(() => api.post(`/api/procurement-requests/${procurementId}/send-to-vendors`));

    const markNotificationRead = (id) =>
        runAction(() => api.post(`/api/notifications/${id}/read`));

    const markAllNotificationsRead = () =>
        runAction(() => api.post('/api/notifications/read-all'));

    return (
        <AppContext.Provider value={{
            user,
            bootLoading,
            bootError,
            actionError,
            actionLoading,
            activeTab,
            setActiveTab,
            searchQuery,
            setSearchQuery,
            ...collections,
            activeModal,
            setActiveModal,
            modalData,
            setModalData,
            login,
            logout,
            processSupplyRequestStock,
            selectSupplierAndCreatePO,
            updateFinanceApproval,
            supplierConfirmPO,
            processDeliveryInspection,
            releaseSupplyRequest,
            saveInventoryItem,
            startStockCount,
            submitPhysicalCount,
            submitSupplierQuotation,
            updateSupplierQuotation,
            addDocument,
            markNotificationRead,
            markAllNotificationsRead,
            createManualProcurementRequest,
            sendProcurementToVendors,
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);
