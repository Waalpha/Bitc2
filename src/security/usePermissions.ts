import { createContext, useContext } from 'react';
import { EnterpriseRoleType } from './roles';

export interface PermissionContextType {
  permissions: string[];
  role: EnterpriseRoleType | string;
  isSuperAdmin: boolean;
  isSchoolAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  logAudit: (action: string, details?: any) => Promise<void>;
}

export const PermissionContext = createContext<PermissionContextType>({
  permissions: [],
  role: 'student',
  isSuperAdmin: false,
  isSchoolAdmin: false,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  logAudit: async () => {},
});

export function usePermissions(): PermissionContextType {
  return useContext(PermissionContext);
}
