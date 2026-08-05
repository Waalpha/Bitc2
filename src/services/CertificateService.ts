import { LoggerService } from './loggerService';

export interface CertificateData {
  studentName: string;
  regNo: string;
  course: string;
  completionDate: string;
  certificateNo: string;
}

export class CertificateService {
  static verifyCertificate(certificateNo: string): boolean {
    LoggerService.info('Verifying certificate number', { certificateNo });
    return certificateNo.length > 5;
  }
}
