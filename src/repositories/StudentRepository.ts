import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { User } from '../types';

export class StudentRepository extends BaseRepository<User> {
  constructor() {
    super(COLLECTIONS.STUDENTS);
  }

  async findByRegNo(regNo: string, schoolId?: string): Promise<User | null> {
    const students = await this.findAll(schoolId);
    return students.find(s => (s.regNo || '').toLowerCase() === (regNo || '').toLowerCase()) || null;
  }

  async findByCourse(course: string, schoolId?: string): Promise<User[]> {
    const students = await this.findAll(schoolId);
    return students.filter(s => (s.course || '').toLowerCase() === (course || '').toLowerCase());
  }
}

export const studentRepository = new StudentRepository();
