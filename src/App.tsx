import React from 'react';
import { HashRouter as Router } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { PermissionProvider } from './security';
import { NotificationManager } from './components/NotificationManager';
import { LiveLessonManager } from './components/LiveLessonManager';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppRoutes } from './routes';

export { ProtectedRoute, PermissionGuard, RoleGuard, DisabledAccountGuard } from './routes';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PermissionProvider>
          <NotificationManager />
          <LiveLessonManager />
          <Router>
            <AppRoutes />
          </Router>
        </PermissionProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

