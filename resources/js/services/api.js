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

async function request(path, options = {}) {
    await ensureCsrf();

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

    const { portal, ...fetchOptions } = options;

    const response = await fetch(path, {
        credentials: 'include',
        ...fetchOptions,
        headers,
        body: options.body === undefined
            ? undefined
            : (isFormData ? options.body : JSON.stringify(options.body)),
    });

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
