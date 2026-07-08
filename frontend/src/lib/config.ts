// In development: VITE_API_URL is not set, so API_BASE is '' and Vite proxy handles /api → localhost:4000
// In production: VITE_API_URL is set to the Railway backend URL (e.g. https://debugroom-backend.up.railway.app)
export const API_BASE = import.meta.env.VITE_API_URL ?? '';
export const SOCKET_URL = import.meta.env.VITE_API_URL ?? '/';
