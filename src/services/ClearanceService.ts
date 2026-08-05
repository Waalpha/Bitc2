import { clearanceRepository } from '../repositories/ClearanceRepository';
import { ClearanceRecord } from '../types/student.types';
import { LoggerService } from './loggerService';

export class ClearanceService {
  static async getStudentClearance(studentId: string, schoolId?: string): Promise<ClearanceRecord> {
    const existing = await clearanceRepository.findByStudent(studentId, schoolId);
    if (existing) return existing;

    LoggerService.info('Initializing student clearance record', { studentId });
    return await clearanceRepository.create({
      studentId,
      schoolId,
      financeCleared: false,
      libraryCleared: true,
      hostelCleared: true,
      departmentCleared: false,
      registrarCleared: false,
      principalCleared: false,
    });
  }

  static async updateDepartmentClearance(
    clearanceId: string,
    departmentKey: 'financeCleared' | 'libraryCleared' | 'hostelCleared' | 'departmentCleared' | 'registrarCleared' | 'principalCleared',
    cleared: boolean
  ): Promise<void> {
    LoggerService.info('Updating department clearance state', { clearanceId, departmentKey, cleared });
    await clearanceRepository.update(clearanceId, { [departmentKey]: cleared });
  }
}
