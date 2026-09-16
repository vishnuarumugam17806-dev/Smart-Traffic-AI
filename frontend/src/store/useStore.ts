import { create } from 'zustand';
import { User, Intersection, Camera, Signal, TrafficMeasurement, EmergencyEvent, Incident, Violation, Alert } from '../types';
import { FALLBACK_ALERTS } from '../api/mockFallback';

const initialAlerts: Alert[] = (FALLBACK_ALERTS as any[]).map((a, idx) => ({
  ...a,
  severity: (a.severity || 'HIGH') as any,
  status: a.status || 'NEW',
  is_read: false
}));

interface AppState {
  user: User | null;
  token: string | null;
  intersections: Intersection[];
  cameras: Camera[];
  signals: Signal[];
  measurements: TrafficMeasurement[];
  emergencyEvents: EmergencyEvent[];
  incidents: Incident[];
  violations: Violation[];
  alerts: Alert[];
  unreadAlertsCount: number;
  activeLiveUpdate: any | null;
  isConnected: boolean;
  setUser: (user: User | null, token: string | null) => void;
  setIntersections: (data: Intersection[]) => void;
  setCameras: (data: Camera[]) => void;
  setSignals: (data: Signal[]) => void;
  setMeasurements: (data: TrafficMeasurement[]) => void;
  setEmergencyEvents: (data: EmergencyEvent[]) => void;
  setIncidents: (data: Incident[]) => void;
  setViolations: (data: Violation[]) => void;
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  markAlertAsRead: (id: number) => void;
  markAllAlertsAsRead: () => void;
  dismissAlert: (id: number) => void;
  setActiveLiveUpdate: (update: any) => void;
  setIsConnected: (status: boolean) => void;
  logout: () => void;
}

export const useStore = create<AppState>((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  intersections: [],
  cameras: [],
  signals: [],
  measurements: [],
  emergencyEvents: [],
  incidents: [],
  violations: [],
  alerts: initialAlerts,
  unreadAlertsCount: initialAlerts.length,
  activeLiveUpdate: null,
  isConnected: false,

  setUser: (user, token) => {
    if (user && token) {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
    set({ user, token });
  },

  setIntersections: (intersections) => set({ intersections }),
  setCameras: (cameras) => set({ cameras }),
  setSignals: (signals) => set({ signals }),
  setMeasurements: (measurements) => set({ measurements }),
  setEmergencyEvents: (emergencyEvents) => set({ emergencyEvents }),
  setIncidents: (incidents) => set({ incidents }),
  setViolations: (violations) => set({ violations }),
  setAlerts: (alerts) => set({
    alerts,
    unreadAlertsCount: alerts.filter(a => !a.is_read).length
  }),
  addAlert: (newAlert) => set((state) => {
    const exists = state.alerts.some(a => a.id === newAlert.id);
    if (exists) return state;
    const updated = [newAlert, ...state.alerts];
    return {
      alerts: updated,
      unreadAlertsCount: updated.filter(a => !a.is_read).length
    };
  }),
  markAlertAsRead: (id) => set((state) => {
    const updated = state.alerts.map(a => a.id === id ? { ...a, is_read: true } : a);
    return {
      alerts: updated,
      unreadAlertsCount: updated.filter(a => !a.is_read).length
    };
  }),
  markAllAlertsAsRead: () => set((state) => {
    const updated = state.alerts.map(a => ({ ...a, is_read: true }));
    return {
      alerts: updated,
      unreadAlertsCount: 0
    };
  }),
  dismissAlert: (id) => set((state) => {
    const updated = state.alerts.filter(a => a.id !== id);
    return {
      alerts: updated,
      unreadAlertsCount: updated.filter(a => !a.is_read).length
    };
  }),
  setActiveLiveUpdate: (activeLiveUpdate) => set({ activeLiveUpdate }),
  setIsConnected: (isConnected) => set({ isConnected }),

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));
