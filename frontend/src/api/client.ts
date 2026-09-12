import axios from 'axios';

// Detect if running in production on Render or on localhost
const isRenderProd = typeof window !== 'undefined' && window.location.hostname.includes('onrender.com');
const PROD_BACKEND = 'https://vigitra-backend.onrender.com/api/v1';
const LOCAL_BACKEND = 'http://localhost:8000/api/v1';

// If env var is missing or relative '/api/v1' on static render host, route directly to Render backend!
let rawBase = import.meta.env.VITE_API_BASE_URL;
if (!rawBase || rawBase === '/api/v1' || rawBase.startsWith('/')) {
  rawBase = isRenderProd ? PROD_BACKEND : LOCAL_BACKEND;
}

export const API_BASE_URL = rawBase;
export const BACKEND_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export const resolveVideoUrl = (url?: string): string => {
  if (!url) return '/videos/sample_traffic_urban.mp4';
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/storage/')) {
    return `${BACKEND_URL}${url}`;
  }
  return url;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 25000, // 25s timeout to handle free-tier cloud wake-ups gracefully
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    // If static host or Cloudflare returned HTML string instead of JSON API response
    if (typeof response.data === 'string' && (response.data.includes('<!doctype html>') || response.data.includes('<!DOCTYPE html>'))) {
      return Promise.reject(new Error('Received HTML response instead of JSON API. Backend may be waking up.'));
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);
