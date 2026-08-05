import { departmentRepository } from '../repositories/DepartmentRepository';
import { courseRepository } from '../repositories/CourseRepository';
import { Department, Course } from '../types/academic.types';
import { LoggerService } from './loggerService';

export class DepartmentService {
  static async createDepartment(schoolId: string, data: Omit<Department, 'id' | 'schoolId'>): Promise<Department> {
    LoggerService.info('Creating department', { schoolId, code: data.code, name: data.name });
    return await departmentRepository.create({ ...data, schoolId });
  }

  static async getDepartments(schoolId?: string): Promise<Department[]> {
    return await departmentRepository.findAll(schoolId);
  }

  static async createCourse(schoolId: string, data: Omit<Course, 'id' | 'schoolId'>): Promise<Course> {
    LoggerService.info('Creating course', { schoolId, code: data.code, name: data.name });
    return await courseRepository.create({ ...data, schoolId });
  }

  static async getCoursesByDepartment(departmentId: string, schoolId?: string): Promise<Course[]> {
    return await courseRepository.findByDepartment(departmentId, schoolId);
  }
}
