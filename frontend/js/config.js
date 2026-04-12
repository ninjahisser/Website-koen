// API Configuration
// Use localhost during development, otherwise use the current site origin.
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const LOCAL_API_URL = 'http://127.0.0.1:5000/api';
const PRODUCTION_API_URL = `${window.location.origin}/api`;

const API_BASE_URL = isLocalHost ? LOCAL_API_URL : PRODUCTION_API_URL;

// Backward compatibility for older CMS page checks.
const USE_LOCAL_API = isLocalHost;

const LOCAL_BACKEND_URL = 'http://127.0.0.1:5000';
const PRODUCTION_BACKEND_URL = window.location.origin;
const BACKEND_BASE_URL = isLocalHost ? LOCAL_BACKEND_URL : PRODUCTION_BACKEND_URL;

// Resolve relative /images/ paths to the correct backend host
function resolveMediaUrl(src) {
    if (!src) return src;
    if (src.startsWith('/')) return BACKEND_BASE_URL + src;
    return src;
}

console.log('Using API:', API_BASE_URL);

function getPresenceClientId() {
    const storageKey = 'website_presence_client_id';
    let clientId = '';
    try {
        clientId = localStorage.getItem(storageKey) || '';
    } catch (error) {
        clientId = '';
    }

    if (!clientId) {
        clientId = `c_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
        try {
            localStorage.setItem(storageKey, clientId);
        } catch (error) {
            // Ignore localStorage write errors.
        }
    }
    return clientId;
}

function sendPresencePing(pageName = 'unknown') {
    const payload = {
        clientId: getPresenceClientId(),
        page: pageName
    };
    fetch(`${API_BASE_URL}/presence/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
    }).catch(() => {
        // Presence is best-effort only.
    });
}

function startPresenceTracking(pageName = 'unknown') {
    sendPresencePing(pageName);
    setInterval(() => {
        sendPresencePing(pageName);
    }, 30000);
}
