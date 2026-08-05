import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';

export interface AttendanceRecord {
  id?: string;
  schoolId?: string;
  studentId: string;
  unitCode: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  markedBy?: string;
  notes?: string;
}

export class AttendanceRepository extends BaseRepository<AttendanceRecord> {
  constructor() {
    super(COLLECTIONS.ATTENDANCE);
  }

  async findByStudent(studentId: string, schoolId?: string): Promise<AttendanceRecord[]> {
    const records = await this.findAll(schoolId);
    return records.filter(r => r.studentId === studentId);
  }
}

export const attendanceRepository = new AttendanceRepository();
