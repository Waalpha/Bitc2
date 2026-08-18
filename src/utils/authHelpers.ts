import { User as AppUser } from '../types';

/**
 * Helper function to extract user role from user document or custom claims.
 */
export function getUserRole(user?: AppUser | null, customClaims?: Record<string, any>): string {
  if (customClaims?.role) return customClaims.role;
  if (user?.role) return user.role;
  return 'student';
}

/**
 * Helper function to extract user schoolId from user document or custom claims.
 */
export function getUserSchool(user?: AppUser | null, customClaims?: Record<string, any>): string {
  if (customClaims?.schoolId) return customClaims.schoolId;
  if (user?.schoolId) return user.schoolId;
  return 'bitc'; // Default fallback school ID
}

/**
 * Check if the user is a super admin with access across schools.
 */
export function isSuperAdmin(user?: AppUser | null, customClaims?: Record<string, any>): boolean {
  const role = getUserRole(user, customClaims);
  const email = user?.email?.toLowerCase();
  return role === 'super_admin' || email === 'davmuchiri48@gmail.com' || email === 'daudimuchiri4@gmail.com';
}

/**
 * Check if the user is a school admin or super admin.
 */
export function isSchoolAdmin(user?: AppUser | null, customClaims?: Record<string, any>): boolean {
  const role = getUserRole(user, customClaims);
  return role === 'school_admin' || role === 'admin' || isSuperAdmin(user, customClaims);
}

/**
 * Check if the user is a principal or administrator.
 */
export function isPrincipal(user?: AppUser | null, customClaims?: Record<string, any>): boolean {
  const role = getUserRole(user, customClaims);
  return role === 'principal' || isSchoolAdmin(user, customClaims);
}

/**
 * Check if the user is an accountant or staff with finance permissions.
 */
export function isAccountant(user?: AppUser | null, customClaims?: Record<string, any>): boolean {
  const role = getUserRole(user, customClaims);
  return role === 'accountant' || role === 'staff' || isSchoolAdmin(user, customClaims);
}

/**
 * Check if the user is a teacher.
 */
export function isTeacher(user?: AppUser | null, customClaims?: Record<string, any>): boolean {
  const role = getUserRole(user, customClaims);
  return role === 'teacher' || isSchoolAdmin(user, customClaims);
}
