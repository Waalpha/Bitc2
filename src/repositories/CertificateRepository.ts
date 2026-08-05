import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { IssuedCertificate } from '../types/student.types';

export class CertificateRepository extends BaseRepository<IssuedCertificate> {
  constructor() {
    super(COLLECTIONS.CERTIFICATES);
  }

  async findByNumber(certNumber: string): Promise<IssuedCertificate | null> {
    const list = await this.findAll();
    return list.find(c => c.certNumber === certNumber) || null;
  }

  async findByStudent(studentId: string, schoolId?: string): Promise<IssuedCertificate[]> {
    const list = await this.findAll(schoolId);
    return list.filter(c => c.studentId === studentId);
  }
}

export const certificateRepository = new CertificateRepository();
