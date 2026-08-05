import React, { useCallback, useMemo } from 'react';
import { useAuth } from '../components/AuthProvider';
import { PermissionContext, PermissionContextType } from './usePermissions';
import {
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermission,
  logAuditEvent,
} from './permissionService';

export interface PermissionProviderProps {
  children: React.ReactNode;
}

export const PermissionProvider: React.FC<PermissionProviderProps> = ({ children }) => {
  const { user, userData, permissions: authPermissions, activeSchoolId } = useAuth();

  const userRole = userData?.role || 'student';
  const userPermissions = authPermissions || [];

  const isSuperAdmin = userRole === 'super_admin';
  const isSchoolAdmin = userRole === 'school_admin' || userRole === 'admin';

  const hasPermissionCallback = useCallback(
    (permission: string) => {
      return checkPermission(userPermissions, userRole, permission);
    },
    [userPermissions, userRole]
  );

  const hasAnyPermissionCallback = useCallback(
    (permissions: string[]) => {
      return checkAnyPermission(userPermissions, userRole, permissions);
    },
    [userPermissions, userRole]
  );

  const hasAllPermissionsCallback = useCallback(
    (permissions: string[]) => {
      return checkAllPermission(userPermissions, userRole, permissions);
    },
    [userPermissions, userRole]
  );

  const logAuditCallback = useCallback(
    async (action: string, details?: any) => {
      await logAuditEvent(
        activeSchoolId || userData?.schoolId,
        {
          uid: user?.uid,
          name: userData?.name,
          email: user?.email || userData?.email,
          role: userRole,
        },
        action,
        details
      );
    },
    [activeSchoolId, user?.uid, user?.email, userData?.name, userData?.email, userData?.schoolId, userRole]
  );

  const value = useMemo<PermissionContextType>(
    () => ({
      permissions: userPermissions,
      role: userRole,
      isSuperAdmin,
      isSchoolAdmin,
      hasPermission: hasPermissionCallback,
      hasAnyPermission: hasAnyPermissionCallback,
      hasAllPermissions: hasAllPermissionsCallback,
      logAudit: logAuditCallback,
    }),
    [
      userPermissions,
      userRole,
      isSuperAdmin,
      isSchoolAdmin,
      hasPermissionCallback,
      hasAnyPermissionCallback,
      hasAllPermissionsCallback,
      logAuditCallback,
    ]
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};
