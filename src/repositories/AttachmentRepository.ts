import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { AttachmentRecord } from '../types/student.types';

export class AttachmentRepository extends BaseRepository<AttachmentRecord> {
  constructor() {
    super(COLLECTIONS.ATTACHMENTS);
  }

  async findByStudent(studentId: string, schoolId?: string): Promise<AttachmentRecord | null> {
    const list = await this.findAll(schoolId);
    return list.find(a => a.studentId === studentId) || null;
  }
}

export const attachmentRepository = new AttachmentRepository();
