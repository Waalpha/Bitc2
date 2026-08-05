import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { StudentDocument } from '../types/student.types';

export class StudentDocumentRepository extends BaseRepository<StudentDocument> {
  constructor() {
    super(COLLECTIONS.STUDENT_DOCUMENTS);
  }

  async findByStudent(studentId: string, schoolId?: string): Promise<StudentDocument[]> {
    const list = await this.findAll(schoolId);
    return list.filter(d => d.studentId === studentId);
  }
}

export const studentDocumentRepository = new StudentDocumentRepository();
