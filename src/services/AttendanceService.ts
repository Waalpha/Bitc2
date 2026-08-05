import { attendanceRepository, AttendanceRecord } from '../repositories/AttendanceRepository';
import { LoggerService } from './loggerService';

export class AttendanceService {
  static async markAttendance(
    schoolId: string,
    studentId: string,
    unitCode: string,
    date: string,
    status: 'present' | 'absent' | 'late' | 'excused',
    markedBy: string
  ): Promise<AttendanceRecord> {
    LoggerService.info('Marking attendance', { schoolId, studentId, unitCode, status });
    return await attendanceRepository.create({
      schoolId,
      studentId,
      unitCode,
      date,
      status,
      markedBy,
    });
  }

  static async getStudentAttendance(studentId: string, schoolId?: string): Promise<AttendanceRecord[]> {
    return await attendanceRepository.findByStudent(studentId, schoolId);
  }
}
