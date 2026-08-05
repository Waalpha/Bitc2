import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { Semester } from '../types/academic.types';

export class SemesterRepository extends BaseRepository<Semester> {
  constructor() {
    super(COLLECTIONS.SEMESTERS);
  }

  async findByAcademicYear(academicYearId: string, schoolId?: string): Promise<Semester[]> {
    const semesters = await this.findAll(schoolId);
    return semesters.filter(s => s.academicYearId === academicYearId);
  }

  async findActive(schoolId?: string): Promise<Semester | null> {
    const semesters = await this.findAll(schoolId);
    return semesters.find(s => s.isActive || s.status === 'active') || null;
  }
}

export const semesterRepository = new SemesterRepository();
