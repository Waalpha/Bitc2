import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { usePermissions } from '../security';
import { InactivityTimer } from '../components/InactivityTimer';
import { Layout } from '../components/Layout';
import { AppUserRole } from '../types/permission.types';

// ==========================================
// 1. DisabledAccountGuard
// ==========================================
export interface DisabledAccountGuardProps {
  children: React.ReactNode;
}

export const DisabledAccountGuard: React.FC<DisabledAccountGuardProps> = ({ children }) => {
  const { userData, logout } = useAuth();

  if (userData?.disabled) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="bg-white border border-red-100 max-w-md w-full rounded-2xl p-8 shadow-xl text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-3xl">
            🚫
          </div>
          <h2 className="text-xl font-bold text-gray-900">Profile Deactivated</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Your profile (<strong>{userData.name}</strong>) was automatically deactivated because you accumulated more than 7 absences from class.
          </p>
          <div className="p-3 bg-red-50/50 rounded-xl border border-red-100/50 text-xs text-red-700 font-medium">
            Threshold Breach: &gt; 7 Absences recorded
          </div>
          <p className="text-xs text-gray-400">
            Please contact the school administration or your class supervisor to appeal or reactivate your account.
          </p>
          <button
            onClick={() => logout()}
            className="mt-2 w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-red-100 uppercase tracking-widest text-xs"
          >
            Log Out of Account
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// ==========================================
// 2. PermissionGuard
// ==========================================
export interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  fallbackPath?: string;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  permissions = [],
  requireAll = false,
  fallbackPath = '/dashboard',
}) => {
  const { hasPermission } = usePermissions();

  const allPermissions = [
    ...(permission ? [permission] : []),
    ...permissions,
  ];

  if (allPermissions.length === 0) {
    return <>{children}</>;
  }

  const hasAccess = requireAll
    ? allPermissions.every((p) => hasPermission(p))
    : allPermissions.some((p) => hasPermission(p));

  if (!hasAccess) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

// ==========================================
// 3. RoleGuard
// ==========================================
export interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: AppUserRole[] | string[];
  requiredRole?: AppUserRole | string;
  excludeRole?: AppUserRole | string;
  requireAdminPortal?: boolean;
  fallbackPath?: string;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  requiredRole,
  excludeRole,
  requireAdminPortal,
  fallbackPath = '/dashboard',
}) => {
  const { role: currentRole, isSuperAdmin, isSchoolAdmin } = usePermissions();

  if (requireAdminPortal && (currentRole === 'student' || currentRole === 'parent')) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (excludeRole && currentRole === excludeRole) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (requiredRole) {
    const isMatchingRole =
      currentRole === requiredRole ||
      ((requiredRole === 'admin' || requiredRole === 'school_admin') && (isSuperAdmin || isSchoolAdmin));

    if (!isMatchingRole) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const isAllowed =
      currentRole &&
      (allowedRoles.includes(currentRole as any) ||
        (allowedRoles.includes('admin') && (isSuperAdmin || isSchoolAdmin)));

    if (!isAllowed) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <>{children}</>;
};

// ==========================================
// 4. ProtectedRoute
// ==========================================
export interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAllPermissions?: boolean;
  requiredRole?: AppUserRole | string;
  allowedRoles?: AppUserRole[] | string[];
  excludeRole?: AppUserRole | string;
  requireAdminPortal?: boolean;
  disableLayout?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permission,
  permissions,
  requireAllPermissions,
  requiredRole,
  allowedRoles,
  excludeRole,
  requireAdminPortal,
  disableLayout = false,
}) => {
  const { user, userData, loading, isAuthReady } = useAuth();

  if (!isAuthReady || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !userData) {
    return <Navigate to="/" replace />;
  }

  const protectedContent = (
    <DisabledAccountGuard>
      <RoleGuard
        allowedRoles={allowedRoles}
        requiredRole={requiredRole}
        excludeRole={excludeRole}
        requireAdminPortal={requireAdminPortal}
      >
        <PermissionGuard
          permission={permission}
          permissions={permissions}
          requireAll={requireAllPermissions}
        >
          {children}
        </PermissionGuard>
      </RoleGuard>
    </DisabledAccountGuard>
  );

  if (disableLayout) {
    return <InactivityTimer>{protectedContent}</InactivityTimer>;
  }

  return (
    <InactivityTimer>
      <Layout>{protectedContent}</Layout>
    </InactivityTimer>
  );
};
