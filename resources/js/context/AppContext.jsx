import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, ApiError, expireLocalAuth, fetchCurrentUser, fileToBase64, getAuthToken, getBootstrap, getBootstrapMore, getCachedUser, invalidateBootstrap, readBootstrapCache, resetCsrf, setAuthToken, setCachedUser, writeBootstrapCache } from '../services/api';
import { SESSION_EXPIRED_KEY, shouldExpireSession, subscribeToActivity, touchActivity } from '../services/session';
import { compressImageFile } from '../services/images';
import { prefetchItemImages } from '../components/ui/ItemThumb';
import { createEcho } from '../echo';
import { normalizeOtpChallenge } from '../services/otp';

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
        if (!Array.isArray(cached[key])) {
            return;
        }
        next[key] = key === 'quotations'
            ? cached[key].filter((item) => !String(item?.id || '').startsWith('tmp-'))
            : cached[key];
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

const QUOTE_JSON_MAX_BYTES = 1500 * 1024;
const QUOTE_GET_CHUNK_BYTES = 3600;
const QUOTE_REQUEST_TIMEOUT = 90000;
const QUOTE_IMAGE_MAX_BYTES = 400 * 1024;

const prepareQuoteFile = async (file) => {
    if (!(file instanceof File)) {
        return file;
    }
    if (file.type.startsWith('image/')) {
        return compressImageFile(file, { maxBytes: QUOTE_IMAGE_MAX_BYTES });
    }
    return file;
};

const quoteUploadQuery = (params) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    return `/api/quotation-uploads?${query.toString()}`;
};

const quotationUploadGet = (params, signal) => (
    api.get(quoteUploadQuery(params), { signal, timeout: QUOTE_REQUEST_TIMEOUT })
);

const documentFallbackName = (kind) => {
    if (kind === 'warranty') return 'warranty.pdf';
    if (kind === 'manual') return 'manual.pdf';
    return 'photo.jpg';
};

const uploadViaGetChunks = async (file, kind, signal) => {
    const fileName = file.name || documentFallbackName(kind);
    const started = await quotationUploadGet({ step: 'start', kind, fileName }, signal);
    const bytes = new Uint8Array(await file.arrayBuffer());

    for (let offset = 0; offset < bytes.length; offset += QUOTE_GET_CHUNK_BYTES) {
        const slice = bytes.subarray(offset, offset + QUOTE_GET_CHUNK_BYTES);
        await quotationUploadGet({
            step: 'chunk',
            uploadId: started.uploadId,
            chunk: await fileToBase64(new Blob([slice])),
        }, signal);
    }

    return quotationUploadGet({ step: 'finish', uploadId: started.uploadId }, signal);
};

const attachQuotedDocument = async (next, file, kind, tokenKey, base64Key, nameKey, signal) => {
    if (!(file instanceof File)) {
        return;
    }

    const prepared = await prepareQuoteFile(file);
    if (prepared.size > QUOTE_JSON_MAX_BYTES) {
        next[tokenKey] = (await uploadViaGetChunks(prepared, kind, signal)).token;
        return;
    }

    next[base64Key] = await fileToBase64(prepared);
    next[nameKey] = prepared.name || documentFallbackName(kind);
};

const quotationPayload = async ({ warrantyFile, manualFile, itemPhotos, keepItemPhotos, ...payload }, signal) => {
    const photos = [];
    for (const photo of (itemPhotos || []).filter((item) => item instanceof File)) {
        photos.push(await prepareQuoteFile(photo));
    }

    const next = { ...payload };

    if (photos.length > 0) {
        if (photos.some((photo) => photo.size > QUOTE_JSON_MAX_BYTES)) {
            next.itemPhotoTokens = [];
            for (const photo of photos) {
                next.itemPhotoTokens.push((await uploadViaGetChunks(photo, 'photo', signal)).token);
            }
        } else {
            next.itemPhotoNames = photos.map((photo) => photo.name || 'photo.jpg');
            next.itemPhotosBase64 = [];
            for (const photo of photos) {
                next.itemPhotosBase64.push(await fileToBase64(photo));
            }
        }
    }

    await attachQuotedDocument(next, warrantyFile, 'warranty', 'warrantyToken', 'warrantyFileBase64', 'warrantyFileName', signal);
    await attachQuotedDocument(next, manualFile, 'manual', 'manualToken', 'manualFileBase64', 'manualFileName', signal);

    if (Array.isArray(keepItemPhotos)) {
        next.keepItemPhotos = keepItemPhotos;
    }

    return next;
};

const quoteQueryString = (payload) => {
    const query = new URLSearchParams();
    [
        'procurementId', 'item', 'quantity', 'unitPrice', 'totalPrice',
        'warranty', 'warrantyMonths', 'warrantyToken', 'warrantyFileName',
        'manualToken', 'manualFileName',
        'deliveryTimeDays', 'qualityRating', 'paymentTerms', 'notes',
        'supplierId', 'supplierName',
    ].forEach((key) => {
        if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
            query.set(key, String(payload[key]));
        }
    });
    (payload.itemPhotoTokens || []).forEach((token, index) => {
        query.set(`itemPhotoTokens[${index}]`, token);
    });
    return query.toString();
};

const isDiscardedPostError = (error) => {
    if (!(error instanceof ApiError) || error.status !== 422) {
        return false;
    }
    const details = `${error.message} ${Object.values(error.errors || {}).flat().join(' ')}`.toLowerCase();
    return details.includes('procurement id field is required')
        || details.includes('item field is required');
};

const postQuotation = async (path, quoteData, signal, preferPut = false) => {
    const payload = await quotationPayload(quoteData, signal);
    const method = preferPut ? 'put' : 'post';
    const url = `${path}?${quoteQueryString(payload)}`;

    try {
        return await api[method](url, payload, { signal, timeout: QUOTE_REQUEST_TIMEOUT });
    } catch (error) {
        if (!isDiscardedPostError(error)) {
            throw error;
        }

        const photos = (quoteData.itemPhotos || []).filter((item) => item instanceof File);
        const warranty = quoteData.warrantyFile instanceof File ? quoteData.warrantyFile : null;
        const manual = quoteData.manualFile instanceof File ? quoteData.manualFile : null;
        const retry = { ...payload };
        delete retry.itemPhotosBase64;
        delete retry.itemPhotoNames;
        delete retry.warrantyFileBase64;
        delete retry.manualFileBase64;

        if (photos.length > 0) {
            retry.itemPhotoTokens = [];
            for (const photo of photos) {
                retry.itemPhotoTokens.push((await uploadViaGetChunks(await prepareQuoteFile(photo), 'photo', signal)).token);
            }
        }
        if (warranty) {
            retry.warrantyToken = (await uploadViaGetChunks(await prepareQuoteFile(warranty), 'warranty', signal)).token;
        }
        if (manual) {
            retry.manualToken = (await uploadViaGetChunks(await prepareQuoteFile(manual), 'manual', signal)).token;
        }

        return api.post(`${path}?${quoteQueryString(retry)}`, retry, { signal, timeout: QUOTE_REQUEST_TIMEOUT });
    }
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

const mergeListsById = (current, incoming, idKey) => {
    if (!Array.isArray(incoming)) {
        return current;
    }

    const currentList = Array.isArray(current) ? current : [];
    const incomingIds = new Set(incoming.map((item) => item?.[idKey]).filter((id) => id !== undefined && id !== null));
    const leftovers = currentList.filter((item) => !incomingIds.has(item?.[idKey]));
    const mergedIncoming = incoming.map((item) => {
        const previous = currentList.find((row) => row?.[idKey] === item?.[idKey]);
        return previous ? mergeDefined(previous, item) : item;
    });

    return [...mergedIncoming, ...leftovers];
};

const upsertRecords = (list, records, idKey) => {
    const rows = Array.isArray(records) ? records : [records];
    let next = list;
    rows.forEach((record) => {
        next = upsertList(next, record, idKey);
    });
    return next;
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
    if (record.companyName !== undefined && record.contactPerson !== undefined && record.taxId !== undefined) {
        return 'suppliers';
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

const locationItemFromInventory = (item) => ({
    id: item.id,
    itemCode: item.itemCode,
    itemName: item.itemName || item.description,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    status: item.status,
});

const syncStorageLocationsFromInventory = (storageLocations, inventory) => {
    if (!Array.isArray(storageLocations) || storageLocations.length === 0) {
        return storageLocations;
    }

    const grouped = new Map();
    inventory.forEach((item) => {
        if (item.storageLocationId === null || item.storageLocationId === undefined || item.storageLocationId === '') {
            return;
        }

        const key = String(item.storageLocationId);
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key).push(locationItemFromInventory(item));
    });

    return storageLocations.map((location) => {
        const items = grouped.get(String(location.id)) || [];

        return {
            ...location,
            items,
            quantity: items.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0),
            itemCount: items.length,
            itemCode: items[0]?.itemCode || '',
            itemName: items[0]?.itemName || '',
        };
    });
};

const collectionImageUrls = (collections) => (
    Object.values(collections || {})
        .flatMap((value) => (Array.isArray(value) ? value : []))
        .flatMap((record) => [record?.imageUrl, ...(Array.isArray(record?.itemPhotoUrls) ? record.itemPhotoUrls : [])])
        .filter(Boolean)
);

const applyInspectionStock = (collections, itemsDelivered, inspectionResult) => {
    const lines = Array.isArray(itemsDelivered) ? itemsDelivered : [];
    const inventory = collections.inventory.map((item) => {
        const line = lines.find((row) => row.itemCode === item.itemCode);
        if (!line) {
            return item;
        }

        const qty = Number(line.deliveredQuantity || 0);
        const lineResult = line.result || inspectionResult;
        if (qty <= 0 || (lineResult !== 'Passed' && inspectionResult === 'Failed')) {
            return item;
        }

        const quantity = Number(item.quantity || 0) + qty;
        const min = Number(item.minStockLevel || 0);

        return {
            ...item,
            quantity,
            status: quantity <= 0 ? 'OUT OF STOCK' : quantity <= min ? 'LOW STOCK' : 'NORMAL',
            updatedAt: new Date().toISOString(),
        };
    });

    return {
        ...collections,
        inventory,
        storageLocations: syncStorageLocationsFromInventory(collections.storageLocations, inventory),
    };
};


const MUTATION_PROTECTED_KEYS = new Set(['inventory', 'deliveries', 'storageLocations', 'movements', 'documents']);

const inventoryTimestamp = (item) => {
    const value = Date.parse(item?.updatedAt || '');
    return Number.isFinite(value) ? value : 0;
};

const mergeInventoryByTimestamp = (current, incoming) => {
    if (!Array.isArray(incoming)) {
        return current;
    }
    if (!Array.isArray(current) || current.length === 0) {
        return incoming;
    }

    const currentById = new Map(current.map((item) => [item.id, item]));
    return incoming.map((item) => {
        const previous = currentById.get(item.id);
        if (previous && inventoryTimestamp(previous) > inventoryTimestamp(item)) {
            return previous;
        }
        return previous ? { ...previous, ...item } : item;
    });
};

const upsertInventoryRecords = (collections, records) => {
    const list = Array.isArray(records) ? records : [records];
    let inventory = collections.inventory;
    list.forEach((record) => {
        inventory = upsertList(inventory, record, 'id');
    });

    return {
        ...collections,
        inventory,
        storageLocations: syncStorageLocationsFromInventory(collections.storageLocations, inventory),
    };
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
    const [sidebarOpen, setSidebarOpen] = useState(false);
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
    const liveAbortRef = useRef(null);
    const mutationGenerationRef = useRef(0);

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

    const applyBootstrapPayload = (data, actor, { fetchedAt = Date.now(), generation } = {}) => {
        if (!data || typeof data !== 'object') {
            return;
        }

        const hasCollections = collectionKeys.some((key) => Object.prototype.hasOwnProperty.call(data, key));
        if (!hasCollections) {
            return;
        }

        const stale = generation !== undefined && generation !== mutationGenerationRef.current;

        if (actor.role === 'supplier') {
            const next = {
                quotations: data.quotations ?? [],
                purchaseOrders: data.purchaseOrders ?? [],
                opportunities: data.opportunities ?? [],
                notifications: data.notifications ?? [],
            };
            prefetchItemImages(collectionImageUrls(next));
            setCollections((previous) => ({
                ...previous,
                quotations: Array.isArray(data.quotations)
                    ? data.quotations
                    : previous.quotations.filter((item) => !String(item?.id || '').startsWith('tmp-')),
                purchaseOrders: data.purchaseOrders ?? previous.purchaseOrders,
                opportunities: data.opportunities ?? previous.opportunities,
                notifications: data.notifications ?? previous.notifications,
            }));
            return;
        }

        setCollections((previous) => {
            const next = { ...previous };
            collectionKeys.forEach((key) => {
                if (!Object.prototype.hasOwnProperty.call(data, key) || data[key] === undefined) {
                    return;
                }
                if (stale && MUTATION_PROTECTED_KEYS.has(key)) {
                    return;
                }
                if (Array.isArray(data[key]) && data[key].length === 0 && Array.isArray(next[key]) && next[key].length > 0) {
                    return;
                }
                if (key === 'inventory') {
                    next.inventory = mergeInventoryByTimestamp(next.inventory, data.inventory);
                    return;
                }
                if (key === 'deliveries' || key === 'movements' || key === 'supplyRequests' || key === 'releases') {
                    next[key] = mergeListsById(next[key], data[key], ID_KEYS[key]);
                    return;
                }
                next[key] = data[key];
            });
            if (Object.prototype.hasOwnProperty.call(data, 'inventory') || Object.prototype.hasOwnProperty.call(data, 'storageLocations')) {
                next.storageLocations = syncStorageLocationsFromInventory(next.storageLocations, next.inventory);
            }
            prefetchItemImages(collectionImageUrls(next));
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
        if (cached) {
            applyBootstrapPayload(cached, actor);
            coreReadyRef.current = true;
        } else if (!silent) {
            setCollectionsLoading(true);
        }

        try {
            const generation = mutationGenerationRef.current;
            const data = await getBootstrap({ portal, fresh: true });
            applyBootstrapPayload(data, actor, { fetchedAt: Date.now(), generation });
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
                applyBootstrapPayload(more, actor, { fetchedAt: Date.now(), generation: mutationGenerationRef.current });
                writeBootstrapCache('internal', { ...(readBootstrapCache('internal') || {}), ...more });
            })
            .catch(() => {
                moreRequestedRef.current = false;
            });
    };

    loadCollectionsRef.current = loadCollections;

    const commitCollections = (updater) => {
        mutationGenerationRef.current += 1;
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

        const { createdProcurement, updatedInventory, createdMovements, updatedSupplyRequest, ...record } = result;
        const collection = detectCollection(record);
        if (updatedInventory) {
            liveStampsRef.current = { ...liveStampsRef.current, inventory: '' };
        }
        if (updatedSupplyRequest) {
            liveStampsRef.current = { ...liveStampsRef.current, supplyRequests: '' };
        }
        if (collection === 'deliveries') {
            liveStampsRef.current = { ...liveStampsRef.current, deliveries: '' };
        }
        if (collection === 'releases') {
            liveStampsRef.current = { ...liveStampsRef.current, releases: '' };
        }
        commitCollections((prev) => {
            let next = prev;
            if (collection) {
                const idKey = ID_KEYS[collection];
                next = {
                    ...next,
                    [collection]: upsertList(next[collection], record, idKey)
                        .filter((item) => item[idKey] === record[idKey] || !String(item[idKey] || '').startsWith('tmp-')),
                };
                if (collection === 'quotations' && record.procurementId) {
                    next.opportunities = next.opportunities.filter((item) => item.prNumber !== record.procurementId);
                }
                if (collection === 'inventory') {
                    next.storageLocations = syncStorageLocationsFromInventory(next.storageLocations, next.inventory);
                }
            }
            if (updatedInventory) {
                next = upsertInventoryRecords(next, updatedInventory);
            }
            if (updatedSupplyRequest) {
                next = {
                    ...next,
                    supplyRequests: upsertList(next.supplyRequests, updatedSupplyRequest, 'id'),
                };
            }
            if (Array.isArray(createdMovements) && createdMovements.length > 0) {
                next = {
                    ...next,
                    movements: upsertRecords(next.movements, createdMovements, 'id'),
                };
            }
            if (createdProcurement) {
                next = {
                    ...next,
                    procurementRequests: upsertList(next.procurementRequests, createdProcurement, 'id'),
                };
            }
            return next;
        });
    };

    const runAction = async (callback, { optimistic, onSuccess, pauseLiveFor = 2000 } = {}) => {
        setActionError('');
        livePauseUntilRef.current = Date.now() + pauseLiveFor;
        liveAbortRef.current?.abort();
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
            const cancelled = error instanceof ApiError && error.status === 499;
            const timedOut = error instanceof ApiError && error.status === 408;
            if (snapshot && (cancelled || !timedOut)) {
                setCollections(snapshot);
                writeBootstrapCache(portal, { ...(readBootstrapCache(portal) || {}), ...snapshot });
            }
            if (cancelled) {
                return;
            }
            if (timedOut) {
                liveStampsRef.current = {};
                if (!snapshot) {
                    setActionError(error.message || 'The server took too long to respond.');
                    throw error;
                }
                return;
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
                const current = await fetchCurrentUser(portal);
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
                    expireLocalAuth();
                    setInternalUser(null);
                    setVendorUser(null);
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
                        quotations: [quote, ...prev.quotations.filter((item) => (
                            item.id !== quote.id && !String(item.id || '').startsWith('tmp-')
                        ))],
                        opportunities: quote.procurementId
                            ? prev.opportunities.filter((item) => item.prNumber !== quote.procurementId)
                            : prev.opportunities,
                        procurementRequests: prev.procurementRequests.map((pr) => (
                            pr.id === quote.procurementId
                                ? { ...pr, status: 'Evaluation', canEdit: false, sentToVendors: true }
                                : pr
                        )),
                    }));
                })
                .listen('.opportunity.published', () => {
                    liveStampsRef.current = { ...liveStampsRef.current, opportunities: '', notifications: '' };
                    void api.get('/api/opportunities', { portal }).then((opportunities) => {
                        setCollections((prev) => ({ ...prev, opportunities: opportunities || [] }));
                    }).catch(() => {});
                })
                .listen('.stock.updated', (event) => {
                    const item = event.item;
                    if (!item) {
                        return;
                    }
                    setCollections((prev) => {
                        const inventory = prev.inventory.map((row) => (
                            row.id === item.id || row.itemCode === item.itemCode ? mergeDefined(row, item) : row
                        ));
                        return {
                            ...prev,
                            inventory,
                            storageLocations: syncStorageLocationsFromInventory(prev.storageLocations, inventory),
                        };
                    });
                })
                .listen('.delivery.updated', (event) => {
                    const delivery = event.delivery;
                    if (!delivery?.id) {
                        return;
                    }
                    setCollections((prev) => ({
                        ...prev,
                        deliveries: upsertList(prev.deliveries, delivery, 'id'),
                    }));
                })
                .listen('.inventory-movement.created', (event) => {
                    const rows = Array.isArray(event.movements)
                        ? event.movements
                        : (event.movement ? [event.movement] : []);
                    if (rows.length === 0) {
                        return;
                    }
                    setCollections((prev) => ({
                        ...prev,
                        movements: upsertRecords(prev.movements, rows, 'id'),
                    }));
                })
                .listen('.purchase-order.updated', (event) => {
                    const po = event.purchaseOrder;
                    if (!po?.poNumber) {
                        return;
                    }
                    liveStampsRef.current = { ...liveStampsRef.current, purchaseOrders: '' };
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
            const controller = new AbortController();
            liveAbortRef.current = controller;
            try {
                const params = new URLSearchParams(liveStampsRef.current);
                const data = await api.get(`/api/live?${params.toString()}`, { portal, timeout: 12000, signal: controller.signal });
                if (cancelled || !data) {
                    return;
                }
                if (data.stamps) {
                    liveStampsRef.current = data.stamps;
                }
                const generation = mutationGenerationRef.current;
                applyBootstrapPayload(data, user, { fetchedAt: Date.now(), generation });
                if (collectionKeys.some((key) => Object.prototype.hasOwnProperty.call(data, key))) {
                    const { stamp: _stamp, stamps: _stamps, ...collectionsData } = data;
                    writeBootstrapCache(portal, { ...(readBootstrapCache(portal) || {}), ...collectionsData });
                }
            } catch {
                // Keep the current screen if a live poll fails.
            } finally {
                if (liveAbortRef.current === controller) {
                    liveAbortRef.current = null;
                }
                inFlight = false;
            }
        };

        const startId = window.setTimeout(() => {
            void syncLive();
            intervalId = window.setInterval(syncLive, 2000);
        }, 400);

        document.addEventListener('visibilitychange', syncLive);

        return () => {
            cancelled = true;
            liveAbortRef.current?.abort();
            window.clearTimeout(startId);
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', syncLive);
        };
    }, [user?.id, portal]);

    const completeSession = (payload, targetPortal) => {
        setAuthToken(payload.token, targetPortal);
        invalidateBootstrap();
        moreRequestedRef.current = false;
        liveStampsRef.current = {};
        coreReadyRef.current = false;
        const current = applyUser(withoutToken(payload), targetPortal);
        const cached = readBootstrapCache(targetPortal);
        if (cached) {
            applyBootstrapPayload(cached, current);
        }
        void loadCollections(current, { fresh: true, silent: Boolean(cached) });
        return current;
    };

    const login = async (email, password, targetPortal = portal) => {
        resetCsrf();
        const payload = await api.post('/api/login', { email, password, portal: targetPortal }, { portal: targetPortal });
        const challenge = normalizeOtpChallenge(payload);
        if (challenge) {
            return challenge;
        }
        return completeSession(payload, targetPortal);
    };

    const verifyLoginOtp = async (challengeId, code, targetPortal = portal) => {
        const payload = await api.post('/api/login/otp', { challengeId, code }, { portal: targetPortal });
        return completeSession(payload, targetPortal);
    };

    const resendLoginOtp = async (challengeId, targetPortal = portal) => {
        return api.post('/api/login/otp/resend', { challengeId }, { portal: targetPortal });
    };

    const acceptSession = (payload, targetPortal = portal) => completeSession(payload, targetPortal);

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
            setSidebarOpen(false);
            moreRequestedRef.current = false;
            liveStampsRef.current = {};
            coreReadyRef.current = false;
        }
    };

    const expireAllSessions = async () => {
        await Promise.all(['internal', 'vendor'].map(async (target) => {
            if (!getAuthToken(target)) {
                return;
            }

            try {
                await api.post('/api/logout', {}, { portal: target });
            } catch {
                // Token may already be invalid after shutdown or idle expiry.
            }
        }));

        echoRef.current?.disconnect();
        echoRef.current = null;
        resetCsrf();
        expireLocalAuth();
        setInternalUser(null);
        setVendorUser(null);
        setCollections(emptyCollections);
        setActiveTab('dashboard');
        moreRequestedRef.current = false;
        liveStampsRef.current = {};
        coreReadyRef.current = false;
    };

    const expireAllSessionsRef = useRef(expireAllSessions);
    expireAllSessionsRef.current = expireAllSessions;

    useEffect(() => {
        if (!internalUser && !vendorUser) {
            return undefined;
        }

        const expiring = { current: false };
        const expire = () => {
            if (expiring.current) {
                return;
            }

            expiring.current = true;
            void expireAllSessionsRef.current();
        };

        const onActivity = () => {
            if (shouldExpireSession()) {
                void expire();
                return;
            }

            touchActivity();
        };

        const stopActivity = subscribeToActivity(onActivity);
        const intervalId = window.setInterval(() => {
            if (shouldExpireSession()) {
                void expire();
            }
        }, 15000);

        const onResume = () => {
            if (document.visibilityState !== 'visible') {
                return;
            }

            if (shouldExpireSession()) {
                void expire();
            }
        };

        const onStorage = (event) => {
            if (event.key === SESSION_EXPIRED_KEY && event.newValue) {
                echoRef.current?.disconnect();
                echoRef.current = null;
                setInternalUser(null);
                setVendorUser(null);
                setCollections(emptyCollections);
                setActiveTab('dashboard');
            }
        };

        document.addEventListener('visibilitychange', onResume);
        window.addEventListener('focus', onResume);
        window.addEventListener('storage', onStorage);

        return () => {
            stopActivity();
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onResume);
            window.removeEventListener('focus', onResume);
            window.removeEventListener('storage', onStorage);
        };
    }, [internalUser, vendorUser]);

    const pauseLiveSync = () => {
        livePauseUntilRef.current = Date.now() + 2000;
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
                optimistic: (prev) => {
                    const withDelivery = {
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
                    };

                    return applyInspectionStock(withDelivery, itemsDelivered, inspectionResult);
                },
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
        runAction(
            () => api.post(`/api/inventory-items/${itemId}/move`, { storageLocationId }),
            {
                optimistic: (prev) => {
                    const location = storageLocationId
                        ? prev.storageLocations.find((row) => Number(row.id) === Number(storageLocationId))
                        : null;
                    const inventory = prev.inventory.map((item) => (
                        item.id === itemId
                            ? {
                                ...item,
                                storageLocationId: storageLocationId ? Number(storageLocationId) : null,
                                location: location?.label || 'Unassigned',
                            }
                            : item
                    ));

                    return {
                        ...prev,
                        inventory,
                        storageLocations: syncStorageLocationsFromInventory(prev.storageLocations, inventory),
                    };
                },
            }
        );

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

    const submitSupplierQuotation = (newQuote, { signal } = {}) =>
        runAction(
            () => postQuotation('/api/quotations', newQuote, signal),
            { pauseLiveFor: 8000 },
        );

    const updateSupplierQuotation = (quoteId, quoteData, { signal } = {}) =>
        runAction(
            () => postQuotation(`/api/quotations/${quoteId}`, quoteData, signal, true),
            { pauseLiveFor: 8000 },
        );

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

    const createManualProcurementRequest = (itemCode, quantity, reason, priority, neededInDays) =>
        runAction(() => api.post('/api/procurement-requests', { itemCode, quantity, reason, priority, neededInDays }), {
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
                        neededInDays,
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

    const approveSupplier = (supplierId) =>
        runAction(() => api.post(`/api/suppliers/${supplierId}/approve`), {
            optimistic: (prev) => ({
                ...prev,
                suppliers: prev.suppliers.map((item) => (
                    item.id === supplierId ? { ...item, status: 'Active' } : item
                )),
            }),
            onSuccess: (supplier) => {
                if (!supplier?.id) {
                    return;
                }
                commitCollections((prev) => ({
                    ...prev,
                    suppliers: prev.suppliers.map((item) => (
                        item.id === supplier.id ? { ...item, ...supplier } : item
                    )),
                }));
            },
        });

    const openTab = (tab) => {
        setActiveTab(tab);
        setSidebarOpen(false);
        if (MORE_TABS.has(tab)) {
            loadMoreCollections();
        }
    };

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setSidebarOpen(false);
            }
        };
        const onResize = () => {
            if (window.innerWidth > 1024) {
                setSidebarOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    useEffect(() => {
        document.body.classList.toggle('sidebar-drawer-open', sidebarOpen);
        return () => document.body.classList.remove('sidebar-drawer-open');
    }, [sidebarOpen]);

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
            sidebarOpen,
            setSidebarOpen,
            searchQuery,
            setSearchQuery,
            ...collections,
            activeModal,
            setActiveModal,
            modalData,
            setModalData,
            login,
            verifyLoginOtp,
            resendLoginOtp,
            acceptSession,
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
            approveSupplier,
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);
