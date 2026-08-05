import { collection, addDoc } from 'firebase/firestore';
import { db, isFirebaseReady } from '../firebase';
import { getDefaultRolePermissions } from './roles';
import { LEGACY_PERMISSION_ALIASES } from './permissions';

export interface AuditLogUser {
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
}

export interface AuditLogEntry {
  id?: string;
  schoolId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  resource?: string;
  details?: Record<string, any> | string;
  timestamp: string;
}

/**
 * Checks if a given user (with role and assigned permissions) possesses a specific permission.
 */
export function hasPermission(
  userPermissions: string[] | undefined,
  userRole: string | undefined,
  requiredPermission: string
): boolean {
  if (!userRole) return false;

  const normalizedRole = userRole.toLowerCase().trim();

  // Super Admin & School Admins have full access override
  if (['super_admin', 'school_admin', 'admin'].includes(normalizedRole)) {
    return true;
  }

  // Resolve effective user permissions (custom permissions take precedence; otherwise role defaults)
  const effectivePermissions = (userPermissions && userPermissions.length > 0)
    ? userPermissions
    : getDefaultRolePermissions(normalizedRole);

  // Direct exact match
  if (effectivePermissions.includes(requiredPermission)) {
    return true;
  }

  // Alias checks (new standard permission string <-> legacy string bidirectional lookup)
  for (const [legacyKey, newPermissions] of Object.entries(LEGACY_PERMISSION_ALIASES)) {
    // If requirement is a legacy string and user has the corresponding new permission
    if (requiredPermission === legacyKey) {
      if (newPermissions.some(np => effectivePermissions.includes(np))) {
        return true;
      }
    }

    // If requirement is a new permission and user has the legacy string
    if (newPermissions.includes(requiredPermission)) {
      if (effectivePermissions.includes(legacyKey)) {
        return true;
      }
    }
  }

  // Settings manage alias fallback
  if (requiredPermission === 'settings.manage' || requiredPermission === 'system_settings') {
    if (effectivePermissions.includes('settings.manage') || effectivePermissions.includes('system_settings')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if user has ANY of the specified permissions.
 */
export function hasAnyPermission(
  userPermissions: string[] | undefined,
  userRole: string | undefined,
  permissions: string[]
): boolean {
  if (permissions.length === 0) return true;
  return permissions.some(perm => hasPermission(userPermissions, userRole, perm));
}

/**
 * Check if user has ALL of the specified permissions.
 */
export function hasAllPermissions(
  userPermissions: string[] | undefined,
  userRole: string | undefined,
  permissions: string[]
): boolean {
  if (permissions.length === 0) return true;
  return permissions.every(perm => hasPermission(userPermissions, userRole, perm));
}

/**
 * Logs important system and security actions to the `auditLogs` Firestore collection.
 */
export async function logAuditEvent(
  schoolId: string | undefined,
  user: AuditLogUser | null | undefined,
  action: string,
  details?: any
): Promise<void> {
  try {
    if (!isFirebaseReady) {
      console.log('[Audit Log - Dev Mock]', { schoolId, user, action, details });
      return;
    }

    const tenantId = schoolId || 'bitc';
    const logData: AuditLogEntry = {
      schoolId: tenantId,
      userId: user?.uid || 'anonymous',
      userName: user?.name || user?.email || 'System User',
      userEmail: user?.email || '',
      userRole: user?.role || 'guest',
      action,
      details: details ? (typeof details === 'object' ? details : { message: String(details) }) : {},
      timestamp: new Date().toISOString(),
    };

    await addDoc(collection(db, 'auditLogs'), logData);
  } catch (err) {
    console.error('Failed to create audit log entry:', err);
  }
}
