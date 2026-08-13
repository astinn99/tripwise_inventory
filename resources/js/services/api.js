function readCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : '';
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

    const headers = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': readCookie('XSRF-TOKEN'),
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
    };

    const response = await fetch(path, {
        credentials: 'include',
        ...options,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    delete: (path) => request(path, { method: 'DELETE' }),
};
