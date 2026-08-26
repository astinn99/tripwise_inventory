function readCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : '';
}

const TOKEN_KEYS = {
    internal: 'tripwise_internal_token',
    vendor: 'tripwise_vendor_token',
};

export function currentPortal() {
    return window.location.pathname.startsWith('/vendor') ? 'vendor' : 'internal';
}

export function getAuthToken(portal = currentPortal()) {
    return localStorage.getItem(TOKEN_KEYS[portal]) || '';
}

export function setAuthToken(token, portal = currentPortal()) {
    if (token) {
        localStorage.setItem(TOKEN_KEYS[portal], token);
        return;
    }

    localStorage.removeItem(TOKEN_KEYS[portal]);
    setCachedUser(null, portal);
    clearBootstrapCache(portal);
}

const USER_KEYS = {
    internal: 'tripwise_internal_user',
    vendor: 'tripwise_vendor_user',
};

export function getCachedUser(portal = currentPortal()) {
    try {
        const raw = localStorage.getItem(USER_KEYS[portal]);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function setCachedUser(user, portal = currentPortal()) {
    if (user) {
        localStorage.setItem(USER_KEYS[portal], JSON.stringify(user));
        return;
    }

    localStorage.removeItem(USER_KEYS[portal]);
}

export class ApiError extends Error {
    constructor(message, status = 500, errors = {}) {
        super(message);
        this.status = status;
        this.errors = errors;
    }
}

let csrfReady = false;

export async function ensureCsrf() {
    if (csrfReady) {
        return;
    }

    await fetch('/sanctum/csrf-cookie', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    csrfReady = true;
}

export function resetCsrf() {
    csrfReady = false;
}

let bootstrapRequest = null;

export function invalidateBootstrap() {
    bootstrapRequest = null;
}

const BOOTSTRAP_CACHE_PREFIX = 'tripwise_bootstrap_';

export function readBootstrapCache(portal = currentPortal()) {
    try {
        const raw = localStorage.getItem(BOOTSTRAP_CACHE_PREFIX + portal);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function writeBootstrapCache(portal, data) {
    try {
        localStorage.setItem(BOOTSTRAP_CACHE_PREFIX + portal, JSON.stringify(data));
    } catch {
        // Ignore quota errors.
    }
}

export function clearBootstrapCache(portal = currentPortal()) {
    localStorage.removeItem(BOOTSTRAP_CACHE_PREFIX + portal);
}

export function getBootstrap(options = {}) {
    const { fresh = false, ...requestOptions } = options;
    if (fresh) {
        invalidateBootstrap();
    }

    if (!bootstrapRequest) {
        bootstrapRequest = request('/api/bootstrap', requestOptions).finally(() => {
            window.setTimeout(() => {
                bootstrapRequest = null;
            }, 50);
        });
    }

    return bootstrapRequest;
}

export function getBootstrapMore(options = {}) {
    return request('/api/bootstrap?phase=more', options);
}

async function request(path, options = {}) {
    const token = getAuthToken(options.portal || currentPortal());
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': readCookie('XSRF-TOKEN'),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
    };

    const { portal, timeout = 20000, signal: externalSignal, ...fetchOptions } = options;
    const controller = new AbortController();
    let timedOut = false;
    const timer = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeout);

    const abortFromCaller = () => controller.abort();
    if (externalSignal) {
        if (externalSignal.aborted) {
            window.clearTimeout(timer);
            throw new ApiError('Upload cancelled.', 499);
        }
        externalSignal.addEventListener('abort', abortFromCaller, { once: true });
    }

    let response;
    try {
        response = await fetch(path, {
            credentials: 'include',
            ...fetchOptions,
            signal: controller.signal,
            headers,
            body: options.body === undefined
                ? undefined
                : (isFormData ? options.body : JSON.stringify(options.body)),
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            if (timedOut) {
                throw new ApiError('The server took too long to respond. Check the database connection.', 408);
            }
            throw new ApiError('Upload cancelled.', 499);
        }
        throw error;
    } finally {
        window.clearTimeout(timer);
        externalSignal?.removeEventListener('abort', abortFromCaller);
    }

    if (response.status === 204) {
        return null;
    }

    const payload = await parseJsonPayload(response);

    if (!response.ok || payload.success === false) {
        const details = Object.values(payload.errors || {}).flat().filter(Boolean);
        throw new ApiError(
            response.status === 413
                ? 'The upload is too large for the server. Please attach smaller files and try again.'
                : (details.length ? details.join(' ') : (payload.message || 'Request failed')),
            response.status,
            payload.errors || {}
        );
    }

    return payload.data;
}

async function parseJsonPayload(response) {
    const text = await response.text();
    if (!text) {
        return {
            success: response.ok,
            message: response.ok ? '' : 'Unexpected server response',
            data: null,
            errors: {},
        };
    }

    try {
        return JSON.parse(text);
    } catch {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end > start) {
            try {
                return JSON.parse(text.slice(start, end + 1));
            } catch {
                // Fall through to the generic error.
            }
        }

        return {
            success: false,
            message: 'Unexpected server response',
            errors: {},
        };
    }
}

export async function fileToBase64(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return btoa(binary);
}

export async function openProtectedFile(path) {
    const token = getAuthToken();
    const response = await fetch(path, {
        credentials: 'include',
        headers: {
            Accept: '*/*',
            'X-Requested-With': 'XMLHttpRequest',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (!response.ok) {
        throw new ApiError('Unable to open this file.', response.status);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
}

export const api = {
    get: (path, options = {}) => request(path, options),
    post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options = {}) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
};
