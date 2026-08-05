import { studentDocumentRepository } from '../repositories/StudentDocumentRepository';
import { StudentDocument, DocumentType } from '../types/student.types';
import { LoggerService } from './loggerService';

export class StudentDocumentService {
  static async uploadDocument(
    studentId: string,
    schoolId: string,
    data: Omit<StudentDocument, 'id' | 'studentId' | 'schoolId' | 'uploadDate' | 'status'>
  ): Promise<StudentDocument> {
    LoggerService.info('Uploading student document metadata', { studentId, type: data.type });

    return await studentDocumentRepository.create({
      ...data,
      studentId,
      schoolId,
      uploadDate: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
      version: data.version || '1.0',
      status: 'verified',
    });
  }

  static async getStudentDocuments(studentId: string, schoolId?: string): Promise<StudentDocument[]> {
    return await studentDocumentRepository.findByStudent(studentId, schoolId);
  }
}
