import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { Department } from '../types/academic.types';

export class DepartmentRepository extends BaseRepository<Department> {
  constructor() {
    super(COLLECTIONS.DEPARTMENTS);
  }

  async findByCode(code: string, schoolId?: string): Promise<Department | null> {
    const depts = await this.findAll(schoolId);
    return depts.find(d => d.code.toLowerCase() === code.toLowerCase()) || null;
  }
}

export const departmentRepository = new DepartmentRepository();
