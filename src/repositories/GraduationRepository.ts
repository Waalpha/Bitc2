import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { GraduationRecord } from '../types/academic.types';

export class GraduationRepository extends BaseRepository<GraduationRecord> {
  constructor() {
    super(COLLECTIONS.GRADUATION);
  }

  async findByStudent(studentId: string, schoolId?: string): Promise<GraduationRecord | null> {
    const list = await this.findAll(schoolId);
    return list.find(g => g.studentId === studentId) || null;
  }
}

export const graduationRepository = new GraduationRepository();
