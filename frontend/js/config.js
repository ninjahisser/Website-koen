// API Configuration
// Toggle between local development and production
const USE_LOCAL_API = true; // Use local Flask API during development

const LOCAL_API_URL = 'http://127.0.0.1:5000/api';
const PRODUCTION_API_URL = 'https://SethVdB.pythonanywhere.com/api';

const API_BASE_URL = USE_LOCAL_API ? LOCAL_API_URL : PRODUCTION_API_URL;

const LOCAL_BACKEND_URL = 'http://127.0.0.1:5000';
const PRODUCTION_BACKEND_URL = 'https://SethVdB.pythonanywhere.com';
const BACKEND_BASE_URL = USE_LOCAL_API ? LOCAL_BACKEND_URL : PRODUCTION_BACKEND_URL;

// Resolve relative /images/ paths to the correct backend host
function resolveMediaUrl(src) {
    if (!src) return src;
    if (src.startsWith('/')) return BACKEND_BASE_URL + src;
    return src;
}

console.log('Using API:', API_BASE_URL);
