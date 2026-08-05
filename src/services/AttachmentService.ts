import { attachmentRepository } from '../repositories/AttachmentRepository';
import { AttachmentRecord } from '../types/student.types';
import { LoggerService } from './loggerService';

export class AttachmentService {
  static async registerAttachment(
    studentId: string,
    schoolId: string,
    data: Omit<AttachmentRecord, 'id' | 'studentId' | 'schoolId' | 'completionStatus'>
  ): Promise<AttachmentRecord> {
    LoggerService.info('Registering student attachment/internship', { studentId, org: data.hostOrganization });

    return await attachmentRepository.create({
      ...data,
      studentId,
      schoolId,
      completionStatus: 'In Progress',
      weeklyLogbook: data.weeklyLogbook || [],
    });
  }

  static async submitLogbookEntry(
    studentId: string,
    weekNumber: number,
    summary: string,
    schoolId?: string
  ): Promise<void> {
    const record = await attachmentRepository.findByStudent(studentId, schoolId);
    if (!record || !record.id) return;

    const logbook = record.weeklyLogbook || [];
    logbook.push({ weekNumber, summary, supervisorApproval: false });

    await attachmentRepository.update(record.id, { weeklyLogbook: logbook });
  }
}
