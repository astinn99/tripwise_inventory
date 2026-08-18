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

const mergeDefined = (existing, incoming) => {
    if (!incoming) {
        return existing;
    }

    const next = { ...existing };
    Object.entries(incoming).forEach(([key, value]) => {
        if (value === undefined || value === null) {
            return;
        }
        if (Array.isArray(value) && value.length === 0 && Array.isArray(existing?.[key]) && existing[key].length > 0) {
            return;
        }
        next[key] = value;
    });
    return next;
};

const ID_KEYS = {
    inventory: 'id',
    supplyRequests: 'id',
    procurementRequests: 'id',
    quotations: 'id',
    purchaseOrders: 'poNumber',
    suppliers: 'id',
    deliveries: 'id',
    storageLocations: 'id',
    releases: 'id',
    movements: 'id',
    stockCounts: 'id',
    documents: 'id',
    notifications: 'id',
    opportunities: 'id',
};

const upsertList = (list, record, idKey) => {
    if (!record || record[idKey] === undefined || record[idKey] === null) {
        return list;
    }

    const index = list.findIndex((item) => item[idKey] === record[idKey]);
    if (index === -1) {
        return [record, ...list];
    }

    return list.map((item, i) => (i === index ? mergeDefined(item, record) : item));
};

const detectCollection = (record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return null;
    }
    if (record.poNumber && record.poStatus) {
        return 'purchaseOrders';
    }
    if (record.itemsDelivered !== undefined || (record.poNumber && record.trackingNumber !== undefined && !record.poStatus)) {
        return 'deliveries';
    }
    if (record.unitPrice !== undefined && record.supplierName !== undefined) {
        return 'quotations';
    }
    if (record.quantityRequested !== undefined) {
        return 'supplyRequests';
    }
    if (record.sentToVendors !== undefined || record.vendorInviteCount !== undefined) {
        return 'procurementRequests';
    }
    if (record.minStockLevel !== undefined && record.itemCode) {
        return 'inventory';
    }
    if (record.rack !== undefined && record.bin !== undefined) {
        return 'storageLocations';
    }
    if (record.releasedTo !== undefined && record.requestId) {
        return 'releases';
    }
    if (record.movementType) {
        return 'movements';
    }
    if (record.daysRemaining !== undefined || record.expirationDate !== undefined) {
        return 'documents';
    }
    if (record.totalItemsAudited !== undefined || (record.title && record.discrepancyCount !== undefined)) {
        return 'stockCounts';
    }
    if (record.read !== undefined && record.timestamp !== undefined) {
        return 'notifications';
    }
    if (record.prNumber && record.deadline !== undefined) {
        return 'opportunities';
    }
    return null;
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
    const moreRequestedRef = useRef(false);
    const coreReadyRef = useRef(false);
    const liveStampsRef = useRef({});
    const livePauseUntilRef = useRef(0);

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

    const commitCollections = (updater) => {
        setCollections((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            writeBootstrapCache(portal, { ...(readBootstrapCache(portal) || {}), ...next });
            return next;
        });
    };

    const ingestResult = (result) => {
        if (result == null) {
            return;
        }

        if (Array.isArray(result)) {
            if (result.length === 0) {
                return;
            }
            const collection = detectCollection(result[0]);
            if (!collection) {
                return;
            }
            if (collection === 'storageLocations') {
                commitCollections((prev) => ({ ...prev, storageLocations: result }));
                return;
            }
            commitCollections((prev) => {
                let next = prev;
                result.forEach((record) => {
                    next = {
                        ...next,
                        [collection]: upsertList(next[collection], record, ID_KEYS[collection]),
                    };
                });
                return next;
            });
            return;
        }

        if (typeof result !== 'object') {
            return;
        }

        const { createdProcurement, ...record } = result;
        const collection = detectCollection(record);
        if (collection) {
            const idKey = ID_KEYS[collection];
            commitCollections((prev) => ({
                ...prev,
                [collection]: upsertList(prev[collection], record, idKey)
                    .filter((item) => item[idKey] === record[idKey] || !String(item[idKey] || '').startsWith('tmp-')),
            }));
        }
        if (createdProcurement) {
            commitCollections((prev) => ({
                ...prev,
                procurementRequests: upsertList(prev.procurementRequests, createdProcurement, 'id'),
            }));
        }
    };

    const runAction = async (callback, { optimistic, onSuccess } = {}) => {
        setActionError('');
        livePauseUntilRef.current = Date.now() + 10000;
        const snapshot = optimistic ? { ...collections } : null;
        if (optimistic) {
            commitCollections(optimistic);
        }
        setActionLoading(true);
        try {
            const result = await callback();
            ingestResult(result);
            onSuccess?.(result);
            return result;
        } catch (error) {
            if (snapshot) {
                setCollections(snapshot);
                writeBootstrapCache(portal, { ...(readBootstrapCache(portal) || {}), ...snapshot });
            }
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
                .listen('.stock.updated', (event) => {
                    const item = event.item;
                    if (!item) {
                        return;
                    }
                    setCollections((prev) => ({
                        ...prev,
                        inventory: prev.inventory.map((row) => (
                            row.id === item.id || row.itemCode === item.itemCode ? mergeDefined(row, item) : row
                        )),
                    }));
                })
                .listen('.purchase-order.updated', (event) => {
                    const po = event.purchaseOrder;
                    if (!po?.poNumber) {
                        return;
                    }
                    setCollections((prev) => ({
                        ...prev,
                        purchaseOrders: prev.purchaseOrders.some((item) => item.poNumber === po.poNumber)
                            ? prev.purchaseOrders.map((item) => item.poNumber === po.poNumber ? mergeDefined(item, po) : item)
                            : [po, ...prev.purchaseOrders],
                        procurementRequests: prev.procurementRequests.map((pr) => (
                            pr.id === po.procurementId || pr.poNumber === po.poNumber
                                ? {
                                    ...pr,
                                    poNumber: po.poNumber || pr.poNumber,
                                    status: po.financeApprovalStatus === 'Finance Approved'
                                        ? 'Finance Approved'
                                        : po.financeApprovalStatus === 'Finance Rejected'
                                            ? 'Finance Rejected'
                                            : pr.status,
                                }
                                : pr
                        )),
                    }));
                });
        };

        setupEcho();

        return () => {
            cancelled = true;
            echoRef.current?.leave('supply-chain');
            echoRef.current?.disconnect();
            echoRef.current = null;
        };
    }, [user?.id]);

    useEffect(() => {
        if (!user) {
            liveStampsRef.current = {};
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
            if (Date.now() < livePauseUntilRef.current) {
                return;
            }

            inFlight = true;
            try {
                const params = new URLSearchParams(liveStampsRef.current);
                const data = await api.get(`/api/live?${params.toString()}`, { portal, timeout: 8000 });
                if (cancelled || !data) {
                    return;
                }
                if (data.stamps) {
                    liveStampsRef.current = data.stamps;
                }
                applyBootstrapPayload(data, user);
                if (collectionKeys.some((key) => Object.prototype.hasOwnProperty.call(data, key))) {
                    const { stamp: _stamp, stamps: _stamps, ...collectionsData } = data;
                    writeBootstrapCache(portal, { ...(readBootstrapCache(portal) || {}), ...collectionsData });
                }
            } catch {
                // Keep the current screen if a live poll fails.
            } finally {
                inFlight = false;
            }
        };

        const startId = window.setTimeout(() => {
            void syncLive();
            intervalId = window.setInterval(syncLive, 4000);
        }, 1500);

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
        liveStampsRef.current = {};
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
            liveStampsRef.current = {};
            coreReadyRef.current = false;
        }
    };

    const pauseLiveSync = () => {
        livePauseUntilRef.current = Date.now() + 10000;
    };

    const handleActionError = (error) => {
        if (error instanceof ApiError && error.status === 401) {
            setAuthToken('', portal);
            setPortalUser(null, portal);
            setCollections(emptyCollections);
        }
        setActionError(error.message || 'Request failed');
    };

    const processSupplyRequestStock = (requestId) =>
        runAction(
            () => api.post(`/api/supply-requests/${requestId}/check-stock`),
            {
                optimistic: (prev) => {
                    const req = prev.supplyRequests.find((item) => item.id === requestId);
                    const item = prev.inventory.find((row) => row.itemCode === req?.itemCode);
                    const enough = (item?.quantity || 0) >= (req?.quantityRequested || 0);
                    return {
                        ...prev,
                        supplyRequests: prev.supplyRequests.map((row) => (
                            row.id === requestId
                                ? {
                                    ...row,
                                    status: enough ? 'Ready for Release' : 'For Procurement',
                                    stockAvailability: enough ? 'Stock Available' : 'Insufficient Stock',
                                }
                                : row
                        )),
                    };
                },
            }
        );

    const selectSupplierAndCreatePO = (procurementId, quotationId) =>
        runAction(
            () => api.post(`/api/quotations/${quotationId}/select`),
            {
                optimistic: (prev) => {
                    const quote = prev.quotations.find((item) => item.id === quotationId);
                    return {
                        ...prev,
                        quotations: prev.quotations.map((item) => (
                            item.procurementId === procurementId
                                ? { ...item, status: item.id === quotationId ? 'Selected' : 'Rejected' }
                                : item
                        )),
                        procurementRequests: prev.procurementRequests.map((item) => (
                            item.id === procurementId
                                ? {
                                    ...item,
                                    status: 'Pending Finance Approval',
                                    selectedSupplier: quote?.supplierName || item.selectedSupplier,
                                    canEdit: false,
                                }
                                : item
                        )),
                    };
                },
                onSuccess: (po) => {
                    if (!po?.poNumber) {
                        return;
                    }
                    commitCollections((prev) => ({
                        ...prev,
                        purchaseOrders: upsertList(prev.purchaseOrders, po, 'poNumber'),
                        procurementRequests: prev.procurementRequests.map((item) => (
                            item.id === (po.procurementId || procurementId)
                                ? { ...item, poNumber: po.poNumber, selectedSupplier: po.supplier || item.selectedSupplier, status: 'Pending Finance Approval' }
                                : item
                        )),
                    }));
                },
            }
        );

    const updateFinanceApproval = async (poNumber, status, remarks = '') => {
        pauseLiveSync();
        const snapshotOrders = collections.purchaseOrders;
        const snapshotRequests = collections.procurementRequests;
        const targetPo = snapshotOrders.find((po) => po.poNumber === poNumber);
        const poStatus = status === 'Finance Approved'
            ? 'Sent to Supplier'
            : status === 'Finance Rejected'
                ? 'Finance Rejected'
                : 'Returned for Revision';
        const prStatus = status === 'Finance Approved'
            ? 'Finance Approved'
            : status === 'Finance Rejected'
                ? 'Finance Rejected'
                : 'Quotation';

        setCollections((previous) => ({
            ...previous,
            purchaseOrders: previous.purchaseOrders.map((po) => (
                po.poNumber === poNumber
                    ? { ...po, financeApprovalStatus: status, poStatus, financeRemarks: remarks || po.financeRemarks }
                    : po
            )),
            procurementRequests: previous.procurementRequests.map((pr) => (
                pr.id === targetPo?.procurementId || pr.poNumber === poNumber
                    ? { ...pr, status: prStatus, poNumber }
                    : pr
            )),
        }));

        try {
            const po = await api.post(`/api/purchase-orders/${poNumber}/finance-decision`, { status, remarks });
            setCollections((previous) => {
                const next = {
                    ...previous,
                    purchaseOrders: previous.purchaseOrders.map((item) => (
                        item.poNumber === poNumber ? mergeDefined(item, po) : item
                    )),
                };
                writeBootstrapCache('internal', { ...(readBootstrapCache('internal') || {}), ...next });
                return next;
            });
            return po;
        } catch (error) {
            setCollections((previous) => ({
                ...previous,
                purchaseOrders: snapshotOrders,
                procurementRequests: snapshotRequests,
            }));
            handleActionError(error);
            throw error;
        }
    };

    const supplierConfirmPO = async (poNumber) => {
        pauseLiveSync();
        const snapshotOrders = collections.purchaseOrders;
        setCollections((previous) => ({
            ...previous,
            purchaseOrders: previous.purchaseOrders.map((po) => (
                po.poNumber === poNumber ? { ...po, poStatus: 'Confirmed' } : po
            )),
        }));

        try {
            const po = await api.post(`/api/purchase-orders/${poNumber}/confirm`);
            setCollections((previous) => {
                const next = {
                    ...previous,
                    purchaseOrders: previous.purchaseOrders.map((item) => (
                        item.poNumber === poNumber ? mergeDefined(item, po) : item
                    )),
                };
                writeBootstrapCache(portal, { ...(readBootstrapCache(portal) || {}), ...next });
                return next;
            });
            return po;
        } catch (error) {
            setCollections((previous) => ({
                ...previous,
                purchaseOrders: snapshotOrders,
            }));
            handleActionError(error);
            throw error;
        }
    };

    const processDeliveryInspection = (deliveryId, itemsDelivered, inspectionResult, remarks) =>
        runAction(
            () => api.post(`/api/deliveries/${deliveryId}/inspect`, {
                itemsDelivered,
                inspectionResult,
                remarks,
            }),
            {
                optimistic: (prev) => ({
                    ...prev,
                    deliveries: prev.deliveries.map((item) => (
                        item.id === deliveryId
                            ? {
                                ...item,
                                status: inspectionResult === 'Passed' ? 'Accepted' : (inspectionResult === 'Partial' ? 'Partially Accepted' : 'Rejected'),
                                inspectionResult,
                                inspectionNotes: remarks,
                                itemsDelivered,
                            }
                            : item
                    )),
                }),
            }
        );

    const releaseSupplyRequest = (requestId, releasedTo) =>
        runAction(
            () => api.post(`/api/supply-requests/${requestId}/release`, { releasedTo }),
            {
                optimistic: (prev) => {
                    const req = prev.supplyRequests.find((item) => item.id === requestId);
                    return {
                        ...prev,
                        supplyRequests: prev.supplyRequests.map((item) => (
                            item.id === requestId ? { ...item, status: 'Released' } : item
                        )),
                        inventory: prev.inventory.map((item) => (
                            item.itemCode === req?.itemCode
                                ? { ...item, quantity: Math.max(0, Number(item.quantity || 0) - Number(req.quantityRequested || 0)) }
                                : item
                        )),
                        releases: req
                            ? [{
                                id: `tmp-${Date.now()}`,
                                requestId,
                                requestingDepartment: req.requestingDepartment,
                                itemCode: req.itemCode,
                                itemName: req.itemName,
                                quantityReleased: req.quantityRequested,
                                approvalStatus: 'Released',
                                releasedTo,
                                releaseDate: new Date().toISOString().slice(0, 10),
                            }, ...prev.releases]
                            : prev.releases,
                    };
                },
            }
        );

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
        }, {
            optimistic: (prev) => {
                if (!itemData.id) {
                    return {
                        ...prev,
                        inventory: [{
                            id: `tmp-${Date.now()}`,
                            itemCode: itemData.itemCode || '',
                            itemName: itemData.description || itemData.itemName,
                            description: itemData.description || itemData.itemName,
                            category: itemData.category,
                            quantity: Number(itemData.quantity || 0),
                            damagedQuantity: 0,
                            minStockLevel: Number(itemData.minStockLevel || 0),
                            unit: itemData.unit,
                            supplier: itemData.supplier || '',
                            cost: Number(itemData.cost || 0),
                            location: 'Unassigned',
                            status: Number(itemData.quantity || 0) <= 0 ? 'OUT OF STOCK' : 'NORMAL',
                        }, ...prev.inventory],
                    };
                }
                return {
                    ...prev,
                    inventory: prev.inventory.map((item) => (
                        item.id === itemData.id ? mergeDefined(item, {
                            ...itemData,
                            itemName: itemData.description || itemData.itemName || item.itemName,
                        }) : item
                    )),
                };
            },
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
        runAction(() => api.post(`/api/stock-counts/${countId}/submit`, { items: updatedItems }), {
            optimistic: (prev) => ({
                ...prev,
                stockCounts: prev.stockCounts.map((item) => (
                    item.id === countId ? { ...item, status: 'Completed', items: updatedItems } : item
                )),
            }),
        });

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
        }, {
            optimistic: (prev) => ({
                ...prev,
                quotations: [{
                    id: `tmp-${Date.now()}`,
                    procurementId: newQuote.procurementId,
                    supplierId: newQuote.supplierId,
                    supplierName: newQuote.supplierName,
                    item: newQuote.item,
                    quantity: newQuote.quantity,
                    unitPrice: Number(newQuote.unitPrice || 0),
                    totalPrice: Number(newQuote.totalPrice || 0),
                    warranty: newQuote.warranty,
                    deliveryTimeDays: Number(newQuote.deliveryTimeDays || 0),
                    paymentTerms: newQuote.paymentTerms,
                    status: 'Submitted',
                    notes: newQuote.notes,
                }, ...prev.quotations],
                opportunities: prev.opportunities.filter((item) => item.prNumber !== newQuote.procurementId),
            }),
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
        }, {
            optimistic: (prev) => ({
                ...prev,
                quotations: prev.quotations.map((item) => (
                    item.id === quoteId ? mergeDefined(item, quoteData) : item
                )),
            }),
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
        }, {
            optimistic: (prev) => ({
                ...prev,
                documents: [{
                    id: `tmp-${Date.now()}`,
                    title: doc.title,
                    type: doc.type,
                    referenceNumber: doc.referenceNumber,
                    supplier: doc.supplier,
                    expirationDate: doc.expirationDate,
                    status: 'Active',
                    category: doc.category,
                    itemCode: doc.itemCode,
                    purchaseOrderNumber: doc.purchaseOrderNumber,
                }, ...prev.documents],
            }),
        });

    const createManualProcurementRequest = (itemCode, quantity, reason, priority) =>
        runAction(() => api.post('/api/procurement-requests', { itemCode, quantity, reason, priority }), {
            optimistic: (prev) => {
                const item = prev.inventory.find((row) => row.itemCode === itemCode);
                return {
                    ...prev,
                    procurementRequests: [{
                        id: `tmp-${Date.now()}`,
                        itemCode,
                        itemName: item?.itemName || item?.description || itemCode,
                        quantity,
                        reason,
                        priority,
                        status: 'For Procurement',
                        canEdit: true,
                        sentToVendors: false,
                        dateCreated: new Date().toISOString().slice(0, 10),
                    }, ...prev.procurementRequests],
                };
            },
        });

    const updateProcurementRequest = (prId, data) =>
        runAction(() => api.put(`/api/procurement-requests/${prId}`, data), {
            optimistic: (prev) => ({
                ...prev,
                procurementRequests: prev.procurementRequests.map((item) => (
                    item.id === prId ? mergeDefined(item, data) : item
                )),
            }),
        });

    const sendProcurementToVendors = async (procurementId) => {
        setActionError('');
        pauseLiveSync();
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
        runAction(() => api.post(`/api/notifications/${id}/read`), {
            optimistic: (prev) => ({
                ...prev,
                notifications: prev.notifications.map((item) => (
                    item.id === id ? { ...item, read: true } : item
                )),
            }),
        });

    const markAllNotificationsRead = () =>
        runAction(() => api.post('/api/notifications/read-all'), {
            optimistic: (prev) => ({
                ...prev,
                notifications: prev.notifications.map((item) => ({ ...item, read: true })),
            }),
        });

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
