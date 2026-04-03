// API Configuration
// Use localhost during development, otherwise use the current site origin.
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const LOCAL_API_URL = 'http://127.0.0.1:5000/api';
const PRODUCTION_API_URL = `${window.location.origin}/api`;

const API_BASE_URL = isLocalHost ? LOCAL_API_URL : PRODUCTION_API_URL;

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
