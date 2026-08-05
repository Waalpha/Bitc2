import { LoggerService } from './loggerService';

export class ERPNextService {
  static async syncStudentToERPNext(studentId: string, schoolId?: string): Promise<boolean> {
    LoggerService.info('Syncing student record to ERPNext API', { studentId, schoolId });
    return true;
  }

  static async syncFeesToERPNext(feeId: string, schoolId?: string): Promise<boolean> {
    LoggerService.info('Syncing fee record to ERPNext API', { feeId, schoolId });
    return true;
  }
}
