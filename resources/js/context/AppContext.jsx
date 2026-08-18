import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, ApiError, getAuthToken, resetCsrf, setAuthToken } from '../services/api';
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

const withoutToken = (payload) => {
    if (!payload) {
        return null;
    }

    const { token, ...user } = payload;
    return user;
};

export const AppProvider = ({ children }) => {
    const location = useLocation();
    const isVendorPortal = location.pathname.startsWith('/vendor');
    const portal = isVendorPortal ? 'vendor' : 'internal';

    const [activeTab, setActiveTab] = useState('dashboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [internalUser, setInternalUser] = useState(null);
    const [vendorUser, setVendorUser] = useState(null);
    const [bootLoading, setBootLoading] = useState(true);
    const [bootError, setBootError] = useState('');
    const [actionError, setActionError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [collections, setCollections] = useState(emptyCollections);
    const [activeModal, setActiveModal] = useState(null);
    const [modalData, setModalData] = useState(null);
    const echoRef = useRef(null);

    const user = isVendorPortal ? vendorUser : internalUser;

    const setPortalUser = (nextUser, targetPortal = portal) => {
        if (targetPortal === 'vendor') {
            setVendorUser(nextUser);
            return;
        }

        setInternalUser(nextUser);
    };

    const applyUser = (nextUser, targetPortal = portal) => {
        const role = nextUser?.role;
        const allowed = targetPortal === 'vendor' ? role === 'supplier' : role === 'supply_chain';

        if (nextUser && !allowed) {
            setAuthToken('', targetPortal);
            setPortalUser(null, targetPortal);
            return null;
        }

        setPortalUser(nextUser, targetPortal);
        return nextUser;
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
                setAuthToken('', portal);
                setPortalUser(null, portal);
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
            setCollections(emptyCollections);

            if (!getAuthToken(portal)) {
                setPortalUser(null, portal);
                setBootLoading(false);
                return;
            }

            try {
                const current = await api.get('/api/user', { portal });
                if (cancelled) return;
                const nextUser = applyUser(current, portal);
                if (nextUser) {
                    await loadCollections(nextUser);
                }
            } catch (error) {
                if (cancelled) return;
                if (error instanceof ApiError && error.status === 401) {
                    setAuthToken('', portal);
                    setPortalUser(null, portal);
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
    }, [portal]);

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

    const login = async (email, password, targetPortal = portal) => {
        resetCsrf();
        const payload = await api.post('/api/login', { email, password, portal: targetPortal }, { portal: targetPortal });
        setAuthToken(payload.token, targetPortal);
        const current = applyUser(withoutToken(payload), targetPortal);
        await loadCollections(current);
        return current;
    };

    const logout = async () => {
        try {
            await api.post('/api/logout', {}, { portal });
        } finally {
            echoRef.current?.disconnect();
            echoRef.current = null;
            resetCsrf();
            setAuthToken('', portal);
            setPortalUser(null, portal);
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
        runAction(() => {
            const { imageFile, removeImage, imageUrl: _imageUrl, ...payload } = itemData;
            const shouldUpload = imageFile instanceof File || removeImage === true;

            if (shouldUpload) {
                const form = new FormData();
                Object.entries(payload).forEach(([key, value]) => {
                    if (value === undefined) {
                        return;
                    }
                    form.append(key, value === null ? '' : String(value));
                });
                if (imageFile instanceof File) {
                    form.append('image', imageFile);
                }
                if (removeImage === true) {
                    form.append('removeImage', '1');
                }
                if (itemData.id) {
                    return api.post(`/api/inventory-items/${itemData.id}`, form);
                }
                return api.post('/api/inventory-items', form);
            }

            return itemData.id
                ? api.put(`/api/inventory-items/${itemData.id}`, payload)
                : api.post('/api/inventory-items', payload);
        });

    const createStorageLocation = (locationData) =>
        runAction(() => api.post('/api/storage-locations', locationData));

    const bootstrapWarehouseLayout = () =>
        runAction(() => api.post('/api/storage-locations/bootstrap'));

    const moveInventoryItem = (itemId, storageLocationId = null) =>
        runAction(() => api.post(`/api/inventory-items/${itemId}/move`, { storageLocationId }));

    const adjustInventoryItem = (itemId, payload) =>
        runAction(() => api.post(`/api/inventory-items/${itemId}/adjust`, payload));

    const startStockCount = (title, locationName) =>
        runAction(async () => {
            const count = await api.post('/api/stock-counts', { title, location: locationName });
            setModalData(count);
            setActiveModal('stock_count');
            return count;
        });

    const submitPhysicalCount = (countId, updatedItems) =>
        runAction(() => api.post(`/api/stock-counts/${countId}/submit`, { items: updatedItems }));

    const submitSupplierQuotation = (newQuote) =>
        runAction(() => {
            const { warrantyFile, ...payload } = newQuote;
            if (warrantyFile instanceof File) {
                const form = new FormData();
                Object.entries(payload).forEach(([key, value]) => {
                    if (value === undefined || value === null) {
                        return;
                    }
                    form.append(key, String(value));
                });
                form.append('warrantyFile', warrantyFile);
                return api.post('/api/quotations', form);
            }
            return api.post('/api/quotations', payload);
        });

    const updateSupplierQuotation = (quoteId, quoteData) =>
        runAction(() => {
            const { warrantyFile, ...payload } = quoteData;
            if (warrantyFile instanceof File) {
                const form = new FormData();
                Object.entries(payload).forEach(([key, value]) => {
                    if (value === undefined || value === null) {
                        return;
                    }
                    form.append(key, String(value));
                });
                form.append('warrantyFile', warrantyFile);
                return api.post(`/api/quotations/${quoteId}`, form);
            }
            return api.put(`/api/quotations/${quoteId}`, payload);
        });

    const addDocument = (doc) =>
        runAction(() => {
            const { file, ...payload } = doc;
            const form = new FormData();
            Object.entries(payload).forEach(([key, value]) => {
                if (value === undefined || value === null || value === '') {
                    return;
                }
                form.append(key, String(value));
            });
            if (file instanceof File) {
                form.append('file', file);
            }
            return api.post('/api/documents', form);
        });

    const createManualProcurementRequest = (itemCode, quantity, reason, priority) =>
        runAction(() => api.post('/api/procurement-requests', { itemCode, quantity, reason, priority }));

    const updateProcurementRequest = (prId, data) =>
        runAction(() => api.put(`/api/procurement-requests/${prId}`, data));

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
            createStorageLocation,
            bootstrapWarehouseLayout,
            moveInventoryItem,
            adjustInventoryItem,
            startStockCount,
            submitPhysicalCount,
            submitSupplierQuotation,
            updateSupplierQuotation,
            addDocument,
            markNotificationRead,
            markAllNotificationsRead,
            createManualProcurementRequest,
            updateProcurementRequest,
            sendProcurementToVendors,
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);
