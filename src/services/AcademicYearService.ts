import { academicYearRepository } from '../repositories/AcademicYearRepository';
import { semesterRepository } from '../repositories/SemesterRepository';
import { AcademicYear, Semester } from '../types/academic.types';
import { LoggerService } from './loggerService';

export class AcademicYearService {
  static async createAcademicYear(
    schoolId: string,
    data: Omit<AcademicYear, 'id' | 'schoolId'>
  ): Promise<AcademicYear> {
    LoggerService.info('Creating academic year', { schoolId, name: data.name });
    const created = await academicYearRepository.create({ ...data, schoolId });
    if (data.isActive) {
      await academicYearRepository.setActiveYear(created.id, schoolId);
    }
    return created;
  }

  static async getActiveAcademicYear(schoolId?: string): Promise<AcademicYear | null> {
    return await academicYearRepository.findActive(schoolId);
  }

  static async addSemester(
    schoolId: string,
    data: Omit<Semester, 'id' | 'schoolId'>
  ): Promise<Semester> {
    LoggerService.info('Adding semester/term', { schoolId, name: data.name });
    return await semesterRepository.create({ ...data, schoolId });
  }

  static async getSemesters(academicYearId: string, schoolId?: string): Promise<Semester[]> {
    return await semesterRepository.findByAcademicYear(academicYearId, schoolId);
  }
}
