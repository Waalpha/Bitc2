import { logAuditEvent, AuditLogUser } from '../security/permissionService';

export class LoggerService {
  private static isDev = process.env.NODE_ENV !== 'production';

  static info(message: string, context?: any) {
    if (this.isDev) {
      console.log(`[INFO] [${new Date().toISOString()}] ${message}`, context || '');
    }
  }

  static warn(message: string, context?: any) {
    if (this.isDev) {
      console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, context || '');
    }
  }

  static error(message: string, error?: any, context?: any) {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, error || '', context || '');
  }

  static async audit(
    schoolId: string | undefined,
    user: AuditLogUser | null | undefined,
    action: string,
    details?: any
  ): Promise<void> {
    this.info(`Audit Event: ${action}`, { schoolId, user: user?.email, details });
    await logAuditEvent(schoolId, user, action, details);
  }
}
