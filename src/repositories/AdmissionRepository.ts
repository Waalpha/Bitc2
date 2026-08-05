import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { AdmissionApplication } from '../types/student.types';

export class AdmissionRepository extends BaseRepository<AdmissionApplication> {
  constructor() {
    super(COLLECTIONS.ADMISSIONS);
  }

  async findByEmail(email: string, schoolId?: string): Promise<AdmissionApplication | null> {
    const list = await this.findAll(schoolId);
    return list.find(a => a.email.toLowerCase() === email.toLowerCase()) || null;
  }
}

export const admissionRepository = new AdmissionRepository();
