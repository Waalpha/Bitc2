import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { AlumniProfile } from '../types/student.types';

export class AlumniRepository extends BaseRepository<AlumniProfile> {
  constructor() {
    super(COLLECTIONS.ALUMNI);
  }

  async findByStudent(studentId: string, schoolId?: string): Promise<AlumniProfile | null> {
    const list = await this.findAll(schoolId);
    return list.find(a => a.studentId === studentId) || null;
  }
}

export const alumniRepository = new AlumniRepository();
