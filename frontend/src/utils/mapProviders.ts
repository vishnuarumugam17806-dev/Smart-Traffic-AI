/**
 * VIGITRA AI - Unified Map Providers & Google Maps Integration Engine
 * Handles Google Maps (Roadmap, Satellite Hybrid, Traffic, Terrain)
 * alongside CartoDB and OpenStreetMap fallback layers.
 */

export type MapStyleId = 'google-roadmap' | 'google-hybrid' | 'google-traffic' | 'google-terrain' | 'cartodb-dark' | 'osm-standard';

export interface MapStyleOption {
  id: MapStyleId;
  name: string;
  category: 'google' | 'standard';
  subtext: string;
  icon: string;
  attribution: string;
  maxZoom: number;
}

export const MAP_STYLE_OPTIONS: MapStyleOption[] = [
  {
    id: 'google-roadmap',
    name: 'Google Maps Roadmap',
    category: 'google',
    subtext: 'High-clarity streets & vector landmarks',
    icon: '🗺️',
    attribution: '&copy; Google Maps',
    maxZoom: 20
  },
  {
    id: 'google-hybrid',
    name: 'Google Satellite Hybrid',
    category: 'google',
    subtext: 'High-res satellite photography + street overlay',
    icon: '🛰️',
    attribution: '&copy; Google Imagery',
    maxZoom: 20
  },
  {
    id: 'google-traffic',
    name: 'Google Live Traffic',
    category: 'google',
    subtext: 'Google Maps real-time color-coded congestion',
    icon: '🚦',
    attribution: '&copy; Google Traffic & Maps',
    maxZoom: 20
  },
  {
    id: 'google-terrain',
    name: 'Google Terrain',
    category: 'google',
    subtext: 'Topographical elevations & contours',
    icon: '⛰️',
    attribution: '&copy; Google Maps',
    maxZoom: 20
  },
  {
    id: 'cartodb-dark',
    name: 'CartoDB Dark Matter',
    category: 'standard',
    subtext: 'Command Center dark surveillance styling',
    icon: '🌙',
    attribution: '&copy; CartoDB & OpenStreetMap',
    maxZoom: 19
  },
  {
    id: 'osm-standard',
    name: 'OpenStreetMap',
    category: 'standard',
    subtext: 'Standard public community GIS layer',
    icon: '🌐',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }
];

export const getGoogleMapsApiKey = (): string => {
  return (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
};

export const getDefaultMapStyleId = (): MapStyleId => {
  const envProvider = ((import.meta as any).env?.VITE_MAP_PROVIDER || '').toLowerCase();
  const hasGoogleKey = Boolean(getGoogleMapsApiKey());

  if (hasGoogleKey || envProvider === 'googlemaps' || envProvider === 'google') {
    return 'google-roadmap';
  }
  if (envProvider === 'cartodb') {
    return 'cartodb-dark';
  }
  return 'google-roadmap';
};

export const getTileUrlForStyle = (styleId: MapStyleId, apiKey?: string): { url: string; subdomains?: string[] } => {
  const key = apiKey || getGoogleMapsApiKey();
  const keyParam = key ? `&key=${encodeURIComponent(key)}` : '';

  switch (styleId) {
    case 'google-roadmap':
      // lyrs=m : Google standard roadmap
      return { url: `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}${keyParam}` };
    case 'google-hybrid':
      // lyrs=y : Google hybrid (satellite + road labels)
      return { url: `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}${keyParam}` };
    case 'google-traffic':
      // lyrs=m,traffic : Google roadmap with real-time traffic overlay
      return { url: `https://mt1.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}${keyParam}` };
    case 'google-terrain':
      // lyrs=p : Google terrain
      return { url: `https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}${keyParam}` };
    case 'cartodb-dark':
      return {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        subdomains: ['a', 'b', 'c', 'd']
      };
    case 'osm-standard':
    default:
      return {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c']
      };
  }
};

/**
 * Dynamically loads the official Google Maps JavaScript API SDK if not already loaded.
 */
let googleSdkPromise: Promise<void> | null = null;
export const loadGoogleMapsSdk = (apiKey?: string): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.maps) return Promise.resolve();
  if (googleSdkPromise) return googleSdkPromise;

  const key = apiKey || getGoogleMapsApiKey();
  if (!key) {
    return Promise.reject(new Error('Google Maps API key is not configured.'));
  }

  googleSdkPromise = new Promise((resolve, reject) => {
    const scriptId = 'google-maps-sdk-script';
    if (document.getElementById(scriptId)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,geometry,visualization&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });

  return googleSdkPromise;
};

/**
 * Creates Google Maps navigation URL for a given latitude/longitude.
 */
export const createGoogleMapsDirectionsUrl = (lat: number, lng: number, label?: string): string => {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}${label ? `&query_place_id=${encodeURIComponent(label)}` : ''}`;
};
