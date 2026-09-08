import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../layouts/Layout';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { Cameras } from '../pages/Cameras';
import { CameraDetails } from '../pages/CameraDetails';
import { Signals } from '../pages/Signals';
import { Predictions } from '../pages/Predictions';
import { HeatMap } from '../pages/HeatMap';
import { Settings } from '../pages/Settings';
import { ANPRMonitoring } from '../pages/ANPRMonitoring';
import { Trajectories } from '../pages/Trajectories';
import { Alerts } from '../pages/Alerts';
import { LinkDeviceCamera } from '../pages/LinkDeviceCamera';
import { MobileCamera } from '../pages/MobileCamera';
import { RecordedVideo } from '../pages/RecordedVideo';
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
        <Route path="cameras" element={<Cameras />} />
        <Route path="cameras/:id" element={<CameraDetails />} />
        <Route path="heatmap" element={<HeatMap />} />
        <Route path="trajectories" element={<Trajectories />} />
        <Route path="anpr" element={<ANPRMonitoring />} />
        <Route path="signals" element={<Signals />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="predictions" element={<Predictions />} />
        <Route path="recordings" element={<RecordedVideo />} />
        <Route path="devices" element={<LinkDeviceCamera />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

