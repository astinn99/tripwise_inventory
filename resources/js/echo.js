import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { ensureCsrf, getAuthToken } from './services/api';

window.Pusher = Pusher;

function readCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : '';
}

export async function createEcho() {
    const key = import.meta.env.VITE_REVERB_APP_KEY || 'pureride-local-key';

    await ensureCsrf();

    const token = getAuthToken();

    return new Echo({
        broadcaster: 'reverb',
        key,
        wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
        wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
        wssPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
        forceTLS: (import.meta.env.VITE_REVERB_SCHEME || window.location.protocol.replace(':', '')) === 'https',
        enabledTransports: ['ws', 'wss'],
        authEndpoint: '/broadcasting/auth',
        auth: {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': readCookie('XSRF-TOKEN'),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        },
        withCredentials: true,
    });
}
