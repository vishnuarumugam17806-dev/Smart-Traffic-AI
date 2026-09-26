/**
 * Application Routing with route-level code splitting.
 * Heavy analytical, GIS, and media pages are dynamically imported via React.lazy
 * to optimize initial load times and minimize bundle size.
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../layouts/Layout';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { useStore } from '../store/useStore';

// Code-split heavy pages to eliminate 500kB+ monolithic bundle warning
const Cameras = lazy(() => import('../pages/Cameras').then((m) => ({ default: m.Cameras })));
const CameraDetails = lazy(() => import('../pages/CameraDetails').then((m) => ({ default: m.CameraDetails })));
const Signals = lazy(() => import('../pages/Signals').then((m) => ({ default: m.Signals })));
const Predictions = lazy(() => import('../pages/Predictions').then((m) => ({ default: m.Predictions })));
const HeatMap = lazy(() => import('../pages/HeatMap').then((m) => ({ default: m.HeatMap })));
const Settings = lazy(() => import('../pages/Settings').then((m) => ({ default: m.Settings })));
const ANPRMonitoring = lazy(() => import('../pages/ANPRMonitoring').then((m) => ({ default: m.ANPRMonitoring })));
const Trajectories = lazy(() => import('../pages/Trajectories').then((m) => ({ default: m.Trajectories })));
const Alerts = lazy(() => import('../pages/Alerts').then((m) => ({ default: m.Alerts })));
const LinkDeviceCamera = lazy(() => import('../pages/LinkDeviceCamera').then((m) => ({ default: m.LinkDeviceCamera })));
const MobileCamera = lazy(() => import('../pages/MobileCamera').then((m) => ({ default: m.MobileCamera })));
const RecordedVideo = lazy(() => import('../pages/RecordedVideo').then((m) => ({ default: m.RecordedVideo })));
const TrafficForecast = lazy(() => import('../pages/TrafficForecast').then((m) => ({ default: m.TrafficForecast })));

const RouteLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[50vh] w-full">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-3 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
      <span className="text-xs font-medium text-slate-500 tracking-wide uppercase">
        Loading module...
      </span>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useStore((state) => state.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/mobile-camera" element={<MobileCamera />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="cameras" element={<Cameras />} />
          <Route path="cameras/:id" element={<CameraDetails />} />
          <Route path="heatmap" element={<HeatMap />} />
          <Route path="trajectories" element={<Trajectories />} />
          <Route path="anpr" element={<ANPRMonitoring />} />
          <Route path="signals" element={<Signals />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="predictions" element={<Predictions />} />
          <Route path="forecast" element={<TrafficForecast />} />
          <Route path="recordings" element={<RecordedVideo />} />
          <Route path="devices" element={<LinkDeviceCamera />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};
