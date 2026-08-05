import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { ProtectedRoute } from './guards';
import { Dashboard } from '../pages/Dashboard';
import { publicRoutes } from './public.routes';
import { studentRoutes } from './student.routes';
import { teacherRoutes } from './teacher.routes';
import { adminRoutes } from './admin.routes';

export * from './guards';
export * from './public.routes';
export * from './student.routes';
export * from './teacher.routes';
export * from './admin.routes';

export const NavigateWrapper: React.FC = () => {
  const { userData } = useAuth();
  const fallback = userData?.role === 'student' ? '/dashboard' : '/dashboard';
  return <Navigate to={fallback} replace />;
};

export const AppRoutes: React.FC = () => {
  const allModularRoutes = [
    ...publicRoutes,
    ...studentRoutes,
    ...teacherRoutes,
    ...adminRoutes,
  ];

  return (
    <Routes>
      {/* Dashboard route */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Render all modular routes */}
      {allModularRoutes.map((r, index) => (
        <Route key={r.path || index} path={r.path} element={r.element} />
      ))}

      {/* Catch-all fallback route */}
      <Route path="*" element={<NavigateWrapper />} />
    </Routes>
  );
};

export default AppRoutes;
