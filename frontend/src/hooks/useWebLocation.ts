import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../api/client';

export interface WebCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  speed?: number | null;
}

export type LocationPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'loading';

export interface WebLocationState {
  coords: WebCoordinates | null;
  locationName: string;
  permissionStatus: LocationPermissionState;
  lastUpdated: string | null;
  error: string | null;
  isWatching: boolean;
  isManualOverride: boolean;
  setManualLocation: (customName: string, customCoords?: { latitude: number; longitude: number }) => void;
  resetToGpsLocation: () => Promise<void>;
  requestLocationPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
}

const STORAGE_KEY = 'vigitra_web_user_location';

export const useWebLocation = (): WebLocationState => {
  const [coords, setCoords] = useState<WebCoordinates | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.coords) return parsed.coords;
      }
    } catch (e) {}
    return null;
  });

  const [locationName, setLocationName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isManualOverride && parsed.locationName) return parsed.locationName;
        if (parsed.coords && parsed.locationName) return parsed.locationName;
      }
    } catch (e) {}
    return 'Detecting device location...';
  });

  const [isManualOverride, setIsManualOverride] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return !!parsed.isManualOverride;
      }
    } catch (e) {}
    return false;
  });

  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.permissionStatus) {
          const s = parsed.permissionStatus.toLowerCase();
          if (s === 'granted' || s === 'denied' || s === 'prompt') return s as LocationPermissionState;
        }
      }
    } catch (e) {}
    return 'prompt';
  });
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const isManualRef = useRef<boolean>(isManualOverride);

  useEffect(() => {
    isManualRef.current = isManualOverride;
  }, [isManualOverride]);

  // Sync location with backend
  const syncLocationToBackend = useCallback(async (
    c: WebCoordinates,
    label: string,
    status: string = 'GRANTED'
  ) => {
    const now = Date.now();
    if (now - lastSyncTimeRef.current < 3000) return;
    lastSyncTimeRef.current = now;

    const iso = new Date().toISOString();
    try {
      await apiClient.post('/web/location', {
        user_id: 'WEB-OPERATOR-LIVE',
        latitude: c.latitude,
        longitude: c.longitude,
        accuracy_meters: c.accuracy,
        address_label: label,
        permission_status: status,
        timestamp: iso
      });
    } catch (err) {
      // Graceful offline fallback
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        coords: c,
        locationName: label,
        timestamp: iso,
        permissionStatus: status,
        isManualOverride: isManualRef.current
      }));
    } catch (e) {}
  }, []);

  // Reverse geocode coords to readable device location
  const resolveLocationName = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
        { signal: controller.signal, headers: { 'Accept-Language': 'en' } }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const road = data.address?.road || data.address?.pedestrian || data.address?.suburb || data.address?.neighbourhood || '';
        const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || data.address?.state || '';
        const country = data.address?.country || '';
        const parts = [road, city, country].filter(Boolean);
        if (parts.length > 0) {
          return `${parts.join(', ')} (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`;
        }
      }
    } catch (e) {
      // Fallback
    }

    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `Device GPS (${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir})`;
  }, []);

  // Handler for successful geolocation update
  const handlePositionSuccess = useCallback(async (pos: GeolocationPosition) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = Math.round(pos.coords.accuracy || 10);
    const newCoords: WebCoordinates = {
      latitude: lat,
      longitude: lng,
      accuracy,
      altitude: pos.coords.altitude,
      speed: pos.coords.speed
    };

    setCoords(newCoords);
    setPermissionStatus('granted');
    setError(null);
    const nowIso = new Date().toISOString();
    setLastUpdated(nowIso);

    if (!isManualRef.current) {
      const name = await resolveLocationName(lat, lng);
      setLocationName(name);
      syncLocationToBackend(newCoords, name, 'GRANTED');
    } else {
      // Keep manual locationName, just update GPS coordinates
      syncLocationToBackend(newCoords, locationName, 'GRANTED');
    }
  }, [locationName, resolveLocationName, syncLocationToBackend]);

  // Handler for position error
  const handlePositionError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setPermissionStatus('denied');
      setError('Location permission was denied. Please allow location access in your browser settings.');
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      setError('Location information is unavailable on this device/network.');
    } else if (err.code === err.TIMEOUT) {
      setError('Location request timed out. Retrying...');
    }
  }, []);

  // Mutable Admin Location Setter
  const setManualLocation = useCallback((customName: string, customCoords?: { latitude: number; longitude: number }) => {
    const trimmed = customName.trim();
    if (!trimmed) return;

    setLocationName(trimmed);
    setIsManualOverride(true);
    isManualRef.current = true;
    setError(null);
    const nowIso = new Date().toISOString();
    setLastUpdated(nowIso);

    const activeCoords: WebCoordinates = customCoords ? {
      latitude: customCoords.latitude,
      longitude: customCoords.longitude,
      accuracy: 5
    } : (coords || {
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 10
    });

    setCoords(activeCoords);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        coords: activeCoords,
        locationName: trimmed,
        timestamp: nowIso,
        permissionStatus: 'granted',
        isManualOverride: true
      }));
    } catch (e) {}

    syncLocationToBackend(activeCoords, trimmed, 'GRANTED');
  }, [coords, syncLocationToBackend]);

  // Reset to GPS Location
  const resetToGpsLocation = useCallback(async () => {
    setIsManualOverride(false);
    isManualRef.current = false;
    await requestLocationPermission();
  }, []);

  // Request browser location permission
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (!('geolocation' in navigator)) {
      setPermissionStatus('unsupported');
      setError('Geolocation is not supported by your browser.');
      return false;
    }

    setPermissionStatus('loading');
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setIsManualOverride(false);
          isManualRef.current = false;
          await handlePositionSuccess(pos);
          startWatching();
          resolve(true);
        },
        (err) => {
          handlePositionError(err);
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 5000
        }
      );
    });
  }, [handlePositionSuccess, handlePositionError]);

  // Start watching position
  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    if (watchIdRef.current !== null) return;

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePositionSuccess,
        handlePositionError,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000
        }
      );
      setIsWatching(true);
    } catch (e) {
      console.warn('Geolocation watch error:', e);
    }
  }, [handlePositionSuccess, handlePositionError]);

  const refreshLocation = useCallback(async () => {
    await requestLocationPermission();
  }, [requestLocationPermission]);

  // Automatically check and query device location on mount
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPermissionStatus('unsupported');
      setError('Geolocation is not supported by your browser.');
      return;
    }

    // Immediately trigger device location query if not in manual override
    if (!isManualRef.current) {
      setPermissionStatus('loading');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await handlePositionSuccess(pos);
          startWatching();
        },
        (err) => {
          handlePositionError(err);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }
      );
    }

    // Check and monitor Permissions API if supported
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then((permissionDesc) => {
          if (permissionDesc.state === 'granted') {
            setPermissionStatus('granted');
            if (!isManualRef.current) {
              navigator.geolocation.getCurrentPosition(handlePositionSuccess, handlePositionError, { enableHighAccuracy: true });
              startWatching();
            }
          } else if (permissionDesc.state === 'denied') {
            setPermissionStatus('denied');
          } else {
            setPermissionStatus('prompt');
          }

          permissionDesc.onchange = () => {
            if (permissionDesc.state === 'granted') {
              setPermissionStatus('granted');
              navigator.geolocation.getCurrentPosition(handlePositionSuccess, handlePositionError, { enableHighAccuracy: true });
              startWatching();
            } else if (permissionDesc.state === 'denied') {
              setPermissionStatus('denied');
            } else {
              setPermissionStatus('prompt');
            }
          };
        })
        .catch(() => {});
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [handlePositionSuccess, handlePositionError, startWatching]);

  return {
    coords,
    locationName,
    permissionStatus,
    lastUpdated,
    error,
    isWatching,
    isManualOverride,
    setManualLocation,
    resetToGpsLocation,
    requestLocationPermission,
    refreshLocation
  };
};
