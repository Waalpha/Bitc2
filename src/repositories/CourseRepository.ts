import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { Course } from '../types/academic.types';

export class CourseRepository extends BaseRepository<Course> {
  constructor() {
    super(COLLECTIONS.COURSES);
  }

  async findByDepartment(departmentId: string, schoolId?: string): Promise<Course[]> {
    const courses = await this.findAll(schoolId);
    return courses.filter(c => c.departmentId === departmentId);
  }
}

export const courseRepository = new CourseRepository();
