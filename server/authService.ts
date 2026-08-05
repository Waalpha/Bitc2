import admin from 'firebase-admin';

export interface CustomClaims {
  role: string;
  schoolId: string;
}

/**
 * Sets custom user claims for multi-tenant role and school identification.
 */
export async function setUserClaims(uid: string, role: string, schoolId: string): Promise<boolean> {
  if (!admin.apps.length) {
    console.warn("[AUTH SERVICE] Firebase Admin not initialized. Skipping custom claim update.");
    return false;
  }
  try {
    await admin.auth().setCustomUserClaims(uid, { role, schoolId });
    console.log(`[AUTH SERVICE] Updated claims for user ${uid}: role=${role}, schoolId=${schoolId}`);
    return true;
  } catch (err: any) {
    console.error(`[AUTH SERVICE ERROR] Failed to set claims for user ${uid}:`, err.message || err);
    return false;
  }
}

/**
 * Retrieves custom claims for a given user UID.
 */
export async function getUserClaims(uid: string): Promise<CustomClaims | null> {
  if (!admin.apps.length) return null;
  try {
    const userRecord = await admin.auth().getUser(uid);
    const claims = userRecord.customClaims as CustomClaims | undefined;
    return claims || null;
  } catch (err: any) {
    console.error(`[AUTH SERVICE ERROR] Failed to fetch claims for user ${uid}:`, err.message || err);
    return null;
  }
}

/**
 * Returns user role from claims or defaults to 'student'.
 */
export function getUserRole(claims?: CustomClaims | null): string {
  return claims?.role || 'student';
}

/**
 * Returns user schoolId from claims or defaults to 'bitc'.
 */
export function getUserSchool(claims?: CustomClaims | null): string {
  return claims?.schoolId || 'bitc';
}
