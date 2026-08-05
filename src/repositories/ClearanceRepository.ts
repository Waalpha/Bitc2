import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { ClearanceRecord } from '../types/student.types';

export class ClearanceRepository extends BaseRepository<ClearanceRecord> {
  constructor() {
    super(COLLECTIONS.CLEARANCES);
  }

  async findByStudent(studentId: string, schoolId?: string): Promise<ClearanceRecord | null> {
    const list = await this.findAll(schoolId);
    return list.find(c => c.studentId === studentId) || null;
  }
}

export const clearanceRepository = new ClearanceRepository();
