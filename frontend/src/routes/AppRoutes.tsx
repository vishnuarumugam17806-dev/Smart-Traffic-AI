import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../layouts/Layout';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { LiveTraffic } from '../pages/LiveTraffic';
import { Cameras } from '../pages/Cameras';
import { CameraDetails } from '../pages/CameraDetails';
import { Intersections } from '../pages/Intersections';
import { Signals } from '../pages/Signals';
import { EmergencyEvents } from '../pages/EmergencyEvents';
import { Incidents } from '../pages/Incidents';
import { Violations } from '../pages/Violations';
import { TrafficAnalytics } from '../pages/TrafficAnalytics';
import { Predictions } from '../pages/Predictions';
import { HeatMap } from '../pages/HeatMap';
import { WhatIfSimulator } from '../pages/WhatIfSimulator';
import { Reports } from '../pages/Reports';
import { AIAssistant } from '../pages/AIAssistant';
import { Notifications } from '../pages/Notifications';
import { SystemMonitoring } from '../pages/SystemMonitoring';
import { AdminUsers } from '../pages/AdminUsers';
import { Settings } from '../pages/Settings';
import { ANPRMonitoring } from '../pages/ANPRMonitoring';
import { VehicleSearch } from '../pages/VehicleSearch';
import { Trajectories } from '../pages/Trajectories';
import { OriginDestination } from '../pages/OriginDestination';
import { Bottlenecks } from '../pages/Bottlenecks';
import { Alerts } from '../pages/Alerts';
import { Blacklist } from '../pages/Blacklist';
import { RouteAnomalies } from '../pages/RouteAnomalies';
import { LinkDeviceCamera } from '../pages/LinkDeviceCamera';
import { MobileCamera } from '../pages/MobileCamera';
import { FieldCapture } from '../pages/FieldCapture';
import { RecordedVideo } from '../pages/RecordedVideo';
import { CameraWall } from '../pages/CameraWall';
import { useStore } from '../store/useStore';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useStore();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
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
        <Route path="live-traffic" element={<LiveTraffic />} />
        <Route path="cameras" element={<Cameras />} />
        <Route path="cameras/:id" element={<CameraDetails />} />
        <Route path="devices" element={<LinkDeviceCamera />} />
        <Route path="field-capture" element={<FieldCapture />} />
        <Route path="recordings" element={<RecordedVideo />} />
        <Route path="camera-wall" element={<CameraWall />} />
        <Route path="intersections" element={<Intersections />} />
        <Route path="signals" element={<Signals />} />
        <Route path="emergency" element={<EmergencyEvents />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="violations" element={<Violations />} />
        <Route path="anpr" element={<ANPRMonitoring />} />
        <Route path="vehicle-search" element={<VehicleSearch />} />
        <Route path="trajectories" element={<Trajectories />} />
        <Route path="heatmap" element={<HeatMap />} />
        <Route path="analytics" element={<TrafficAnalytics />} />
        <Route path="predictions" element={<Predictions />} />
        <Route path="simulator" element={<WhatIfSimulator />} />
        <Route path="origin-destination" element={<OriginDestination />} />
        <Route path="bottlenecks" element={<Bottlenecks />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="blacklist" element={<Blacklist />} />
        <Route path="route-anomalies" element={<RouteAnomalies />} />
        <Route path="reports" element={<Reports />} />
        <Route path="ai-assistant" element={<AIAssistant />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="system" element={<SystemMonitoring />} />
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
