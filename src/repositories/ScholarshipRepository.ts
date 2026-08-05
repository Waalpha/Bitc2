import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { ScholarshipOrDiscount } from '../types/finance.types';

export class ScholarshipRepository extends BaseRepository<ScholarshipOrDiscount> {
  constructor() {
    super(COLLECTIONS.SCHOLARSHIPS);
  }

  async findByStudent(studentId: string, schoolId?: string): Promise<ScholarshipOrDiscount[]> {
    const list = await this.findAll(schoolId);
    return list.filter(s => s.studentId === studentId);
  }
}

export const scholarshipRepository = new ScholarshipRepository();
