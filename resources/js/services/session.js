const BROWSER_COOKIE = 'tripwise_browser_session';
const ACTIVITY_KEY = 'tripwise_last_activity';
export const SESSION_EXPIRED_KEY = 'tripwise_session_expired';
export const IDLE_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

let lastTouchWrite = 0;

function readCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : '';
}

function cookieFlags() {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    return `; path=/; SameSite=Lax${secure}`;
}

export function beginBrowserSession() {
    document.cookie = `${BROWSER_COOKIE}=1${cookieFlags()}`;
    touchActivity(true);
}

export function endBrowserSession() {
    document.cookie = `${BROWSER_COOKIE}=; max-age=0${cookieFlags()}`;
    try {
        localStorage.removeItem(ACTIVITY_KEY);
    } catch {
        // Ignore quota / privacy errors.
    }
}

export function hasBrowserSession() {
    return Boolean(readCookie(BROWSER_COOKIE));
}

export function touchActivity(force = false) {
    const now = Date.now();
    if (!force && now - lastTouchWrite < 4000) {
        return;
    }

    lastTouchWrite = now;
    try {
        localStorage.setItem(ACTIVITY_KEY, String(now));
    } catch {
        // Ignore quota / privacy errors.
    }
}

export function lastActivityAt() {
    const raw = Number(localStorage.getItem(ACTIVITY_KEY) || 0);
    return Number.isFinite(raw) ? raw : 0;
}

export function isIdleExpired() {
    const last = lastActivityAt();
    if (!last) {
        return true;
    }

    return Date.now() - last >= IDLE_MS;
}

export function shouldExpireSession() {
    return !hasBrowserSession() || isIdleExpired();
}

export function subscribeToActivity(onActivity) {
    const handle = () => onActivity();
    ACTIVITY_EVENTS.forEach((event) => {
        window.addEventListener(event, handle, { passive: true });
    });

    return () => {
        ACTIVITY_EVENTS.forEach((event) => {
            window.removeEventListener(event, handle);
        });
    };
}
