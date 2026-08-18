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

    const { portal, timeout = 12000, ...fetchOptions } = options;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);

    let response;
    try {
        response = await fetch(path, {
            credentials: 'include',
            ...fetchOptions,
            signal: fetchOptions.signal ?? controller.signal,
            headers,
            body: options.body === undefined
                ? undefined
                : (isFormData ? options.body : JSON.stringify(options.body)),
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new ApiError('The server took too long to respond. Check the database connection.', 408);
        }
        throw error;
    } finally {
        window.clearTimeout(timer);
    }

    if (response.status === 204) {
        return null;
    }

    const payload = await response.json().catch(() => ({
        success: false,
        message: 'Unexpected server response',
        errors: {},
    }));

    if (!response.ok || payload.success === false) {
        throw new ApiError(
            payload.message || 'Request failed',
            response.status,
            payload.errors || {}
        );
    }

    return payload.data;
}

export const api = {
    get: (path, options = {}) => request(path, options),
    post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options = {}) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
};
