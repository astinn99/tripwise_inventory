import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, ApiError, getAuthToken, getBootstrap, getBootstrapMore, getCachedUser, invalidateBootstrap, readBootstrapCache, resetCsrf, setAuthToken, setCachedUser, writeBootstrapCache } from '../services/api';
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

const collectionKeys = Object.keys(emptyCollections);

const MORE_TABS = new Set([
    'storage_locations',
    'stock_count',
    'inventory_movements',
    'releases',
    'documents',
    'expiring_documents',
    'reports',
    'purchase_orders',
    'items',
    'receiving',
    'inspection',
]);

const hydrateCollections = () => {
    const initialPortal = window.location.pathname.startsWith('/vendor') ? 'vendor' : 'internal';
    const cached = readBootstrapCache(initialPortal);
    if (!cached) {
        return emptyCollections;
    }

    const next = { ...emptyCollections };
    collectionKeys.forEach((key) => {
        if (Array.isArray(cached[key])) {
            next[key] = cached[key];
        }
    });
    return next;
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
    const [internalUser, setInternalUser] = useState(() => getCachedUser('internal'));
    const [vendorUser, setVendorUser] = useState(() => getCachedUser('vendor'));
    const [bootLoading, setBootLoading] = useState(() => {
        const initialPortal = window.location.pathname.startsWith('/vendor') ? 'vendor' : 'internal';
        return Boolean(getAuthToken(initialPortal)) && !getCachedUser(initialPortal);
    });
    const [collectionsLoading, setCollectionsLoading] = useState(false);
    const [bootError, setBootError] = useState('');
    const [actionError, setActionError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [collections, setCollections] = useState(hydrateCollections);
    const [activeModal, setActiveModal] = useState(null);
    const [modalData, setModalData] = useState(null);
    const echoRef = useRef(null);
    const loadCollectionsRef = useRef(null);
    const reloadTimerRef = useRef(null);
    const moreRequestedRef = useRef(false);
    const coreReadyRef = useRef(false);
    const liveStampRef = useRef('');

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
        setCachedUser(nextUser, targetPortal);
        return nextUser;
    };

    const applyBootstrapPayload = (data, actor) => {
        if (!data || typeof data !== 'object') {
            return;
        }

        const hasCollections = collectionKeys.some((key) => Object.prototype.hasOwnProperty.call(data, key));
        if (!hasCollections) {
            return;
        }

        if (actor.role === 'supplier') {
            setCollections((previous) => ({
                ...previous,
                quotations: data.quotations ?? previous.quotations,
                purchaseOrders: data.purchaseOrders ?? previous.purchaseOrders,
                opportunities: data.opportunities ?? previous.opportunities,
                notifications: data.notifications ?? previous.notifications,
            }));
            return;
        }

        setCollections((previous) => {
            const next = { ...previous };
            collectionKeys.forEach((key) => {
                if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
                    next[key] = data[key];
                }
            });
            return next;
        });
    };

    const loadCollections = async (currentUser, { fresh = false, silent = false } = {}) => {
        const actor = currentUser ?? user;
        if (!actor) {
            setCollections(emptyCollections);
            return;
        }

        const cachePortal = actor.role === 'supplier' ? 'vendor' : 'internal';
        const cached = readBootstrapCache(cachePortal);
        if (cached && !fresh) {
            applyBootstrapPayload(cached, actor);
        } else if (!silent) {
            setCollectionsLoading(true);
        }

        try {
            const data = await getBootstrap({ portal, fresh: true });
            applyBootstrapPayload(data, actor);
            writeBootstrapCache(cachePortal, { ...(cached || {}), ...data });

            if (actor.role !== 'supplier' && MORE_TABS.has(activeTab)) {
                loadMoreCollections(actor);
            }
        } finally {
            coreReadyRef.current = true;
            setCollectionsLoading(false);
        }
    };

    const loadMoreCollections = (currentUser) => {
        const actor = currentUser ?? user;
        if (!actor || actor.role === 'supplier' || moreRequestedRef.current) {
            return;
        }

        moreRequestedRef.current = true;
        void getBootstrapMore({ portal: 'internal' })
            .then((more) => {
                applyBootstrapPayload(more, actor);
                writeBootstrapCache('internal', { ...(readBootstrapCache('internal') || {}), ...more });
            })
            .catch(() => {
                moreRequestedRef.current = false;
            });
    };

    loadCollectionsRef.current = loadCollections;

    const runAction = async (callback) => {
        setActionError('');
        setActionLoading(true);
        try {
            const result = await callback();
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
            setBootError('');

            if (!getAuthToken(portal)) {
                setPortalUser(null, portal);
                setCachedUser(null, portal);
                setCollections(emptyCollections);
                setBootLoading(false);
                return;
            }

            const cached = getCachedUser(portal);
            if (cached) {
                applyUser(cached, portal);
                setBootLoading(false);
                void loadCollections(cached);
            }

            try {
                const current = await api.get('/api/user', { portal });
                if (cancelled) return;
                const nextUser = applyUser(current, portal);
                setBootLoading(false);
                if (nextUser && !cached) {
                    void loadCollections(nextUser);
                }
            } catch (error) {
                if (cancelled) return;
                setBootLoading(false);
                if (error instanceof ApiError && error.status === 401) {
                    setAuthToken('', portal);
                    setPortalUser(null, portal);
                    setCollections(emptyCollections);
                } else if (!cached) {
                    setBootError(error.message || 'Unable to load the application.');
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

        let cancelled = false;

        const scheduleReload = () => {
            clearTimeout(reloadTimerRef.current);
            reloadTimerRef.current = setTimeout(() => {
                loadCollectionsRef.current?.(undefined, { fresh: true, silent: true });
            }, 400);
        };

        const setupEcho = async () => {
            const echo = await createEcho();
            if (cancelled || !echo) {
                echo?.disconnect();
                return;
            }

            echoRef.current = echo;
            echo.private('supply-chain')
                .listen('.notification.created', (event) => {
                    if (event.notification) {
                        setCollections((prev) => ({
                            ...prev,
                            notifications: [event.notification, ...prev.notifications.filter((item) => item.id !== event.notification.id)],
                        }));
                    }
                })
                .listen('.quotation.submitted', (event) => {
                    const quote = event.quotation;
                    if (!quote) {
                        scheduleReload();
                        return;
                    }
                    setCollections((prev) => ({
                        ...prev,
                        quotations: [quote, ...prev.quotations.filter((item) => item.id !== quote.id)],
                        procurementRequests: prev.procurementRequests.map((pr) => (
                            pr.id === quote.procurementId
                                ? { ...pr, status: 'Evaluation', canEdit: false, sentToVendors: true }
                                : pr
                        )),
                    }));
                })
                .listen('.opportunity.published', () => {
                    void api.get('/api/opportunities', { portal }).then((opportunities) => {
                        setCollections((prev) => ({ ...prev, opportunities: opportunities || [] }));
                    }).catch(() => {});
                })
                .listen('.stock.updated', scheduleReload)
                .listen('.purchase-order.updated', scheduleReload);
        };

        setupEcho();

        return () => {
            cancelled = true;
            clearTimeout(reloadTimerRef.current);
            echoRef.current?.leave('supply-chain');
            echoRef.current?.disconnect();
            echoRef.current = null;
        };
    }, [user?.id]);

    useEffect(() => {
        if (!user) {
            liveStampRef.current = '';
            coreReadyRef.current = false;
            return undefined;
        }

        let cancelled = false;
        let inFlight = false;
        let intervalId = 0;

        const syncLive = async () => {
            if (cancelled || document.hidden || inFlight || !coreReadyRef.current) {
                return;
            }

            inFlight = true;
            try {
                const stamp = encodeURIComponent(liveStampRef.current || '');
                const data = await api.get(`/api/live?stamp=${stamp}`, { portal, timeout: 8000 });
                if (cancelled || !data) {
                    return;
                }
                if (data.stamp) {
                    liveStampRef.current = data.stamp;
                }
                applyBootstrapPayload(data, user);
                if (collectionKeys.some((key) => Object.prototype.hasOwnProperty.call(data, key))) {
                    writeBootstrapCache(portal, { ...(readBootstrapCache(portal) || {}), ...data, stamp: undefined });
                }
            } catch {
                // Keep the current screen if a live poll fails.
            } finally {
                inFlight = false;
            }
        };

        const startId = window.setTimeout(() => {
            void syncLive();
            intervalId = window.setInterval(syncLive, 2500);
        }, 1200);

        document.addEventListener('visibilitychange', syncLive);

        return () => {
            cancelled = true;
            window.clearTimeout(startId);
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', syncLive);
        };
    }, [user?.id, portal]);

    const login = async (email, password, targetPortal = portal) => {
        resetCsrf();
        const payload = await api.post('/api/login', { email, password, portal: targetPortal }, { portal: targetPortal });
        setAuthToken(payload.token, targetPortal);
        invalidateBootstrap();
        moreRequestedRef.current = false;
        liveStampRef.current = '';
        coreReadyRef.current = false;
        const current = applyUser(withoutToken(payload), targetPortal);
        void loadCollections(current, { fresh: true });
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
            moreRequestedRef.current = false;
            liveStampRef.current = '';
            coreReadyRef.current = false;
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

    const sendProcurementToVendors = async (procurementId) => {
        setActionError('');
        const snapshot = collections.procurementRequests;

        setCollections((previous) => ({
            ...previous,
            procurementRequests: previous.procurementRequests.map((item) => (
                item.id === procurementId
                    ? { ...item, status: 'Quotation', canEdit: false, sentToVendors: true }
                    : item
            )),
        }));

        try {
            const pr = await api.post(`/api/procurement-requests/${procurementId}/send-to-vendors`);
            setCollections((previous) => {
                const next = {
                    ...previous,
                    procurementRequests: previous.procurementRequests.map((item) => (
                        item.id === procurementId || item.id === pr?.id ? { ...item, ...pr } : item
                    )),
                };
                writeBootstrapCache('internal', { ...(readBootstrapCache('internal') || {}), ...next });
                return next;
            });
            return pr;
        } catch (error) {
            setCollections((previous) => ({
                ...previous,
                procurementRequests: snapshot,
            }));
            if (error instanceof ApiError && error.status === 401) {
                setAuthToken('', portal);
                setPortalUser(null, portal);
                setCollections(emptyCollections);
            }
            setActionError(error.message || 'Request failed');
            throw error;
        }
    };

    const markNotificationRead = (id) =>
        runAction(() => api.post(`/api/notifications/${id}/read`));

    const markAllNotificationsRead = () =>
        runAction(() => api.post('/api/notifications/read-all'));

    const openTab = (tab) => {
        setActiveTab(tab);
        if (MORE_TABS.has(tab)) {
            loadMoreCollections();
        }
    };

    return (
        <AppContext.Provider value={{
            user,
            bootLoading,
            collectionsLoading,
            bootError,
            actionError,
            actionLoading,
            activeTab,
            setActiveTab: openTab,
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
