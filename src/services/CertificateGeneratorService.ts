import { certificateRepository } from '../repositories/CertificateRepository';
import { IssuedCertificate } from '../types/student.types';
import { LoggerService } from './loggerService';

export class CertificateGeneratorService {
  static generateCertNumber(type: string): string {
    const prefix = type.substring(0, 3).toUpperCase();
    const seq = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${seq}`;
  }

  static async issueCertificate(
    studentId: string,
    schoolId: string,
    studentName: string,
    course: string,
    certType: IssuedCertificate['certType']
  ): Promise<IssuedCertificate> {
    const certNumber = this.generateCertNumber(certType);
    const verificationUrl = `https://school-erp.app/verify/certificate/${certNumber}`;

    LoggerService.info('Generating official certificate/letter', { studentId, certType, certNumber });

    return await certificateRepository.create({
      studentId,
      schoolId,
      studentName,
      course,
      certType,
      certNumber,
      issueDate: new Date().toISOString(),
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`,
      digitalSignature: `SIG_${Date.now()}_DIGITAL_KEY`,
      verified: true,
    });
  }

  static async verifyCertificateByNumber(certNumber: string): Promise<IssuedCertificate | null> {
    return await certificateRepository.findByNumber(certNumber);
  }
}
