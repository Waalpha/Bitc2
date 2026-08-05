import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { AcademicYear } from '../types/academic.types';

export class AcademicYearRepository extends BaseRepository<AcademicYear> {
  constructor() {
    super(COLLECTIONS.ACADEMIC_YEARS);
  }

  async findActive(schoolId?: string): Promise<AcademicYear | null> {
    const all = await this.findAll(schoolId);
    return all.find(y => y.isActive || y.status === 'active') || null;
  }

  async setActiveYear(id: string, schoolId?: string): Promise<void> {
    const all = await this.findAll(schoolId);
    for (const year of all) {
      if (year.id === id) {
        await this.update(year.id, { isActive: true, status: 'active' });
      } else if (year.isActive || year.status === 'active') {
        await this.update(year.id, { isActive: false, status: 'completed' });
      }
    }
  }
}

export const academicYearRepository = new AcademicYearRepository();
