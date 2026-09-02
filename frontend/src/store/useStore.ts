import { create } from 'zustand';
import { User, Intersection, Camera, Signal, TrafficMeasurement, EmergencyEvent, Incident, Violation } from '../types';

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
  setActiveLiveUpdate: (activeLiveUpdate) => set({ activeLiveUpdate }),
  setIsConnected: (isConnected) => set({ isConnected }),

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));
