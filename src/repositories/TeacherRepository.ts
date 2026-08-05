import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { User } from '../types';

export class TeacherRepository extends BaseRepository<User> {
  constructor() {
    super(COLLECTIONS.TEACHERS);
  }

  async findByDepartment(department: string, schoolId?: string): Promise<User[]> {
    const teachers = await this.findAll(schoolId);
    return teachers.filter(t => t.department?.toLowerCase() === department.toLowerCase());
  }
}

export const teacherRepository = new TeacherRepository();
