import { db, isFirebaseReady } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { AuditLog } from '../types';

/**
 * Creates an audit log entry in the auditLogs collection.
 */
export async function logAuditEvent(
  schoolId: string,
  userId: string,
  action: string,
  module: string,
  description: string
): Promise<string | null> {
  if (!isFirebaseReady) return null;
  
  try {
    const auditData: Omit<AuditLog, 'id'> = {
      schoolId: schoolId || 'bitc',
      userId: userId || 'system',
      action,
      module,
      description,
      timestamp: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'auditLogs'), auditData);
    return docRef.id;
  } catch (err: any) {
    console.warn('[AUDIT LOG WARNING] Failed to record audit log:', err?.message || err);
    return null;
  }
}
