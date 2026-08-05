import { scholarshipRepository } from '../repositories/ScholarshipRepository';
import { auditRepository } from '../repositories/AuditRepository';
import { timelineRepository } from '../repositories/TimelineRepository';
import { ScholarshipOrDiscount } from '../types/finance.types';
import { LoggerService } from './loggerService';

export class ScholarshipService {
  static async applyDiscountOrScholarship(
    schoolId: string,
    studentId: string,
    studentName: string,
    data: Omit<ScholarshipOrDiscount, 'id' | 'schoolId' | 'studentId' | 'studentName' | 'status'>,
    appliedBy = 'Finance Officer'
  ): Promise<ScholarshipOrDiscount> {
    LoggerService.info('Applying discount/scholarship to student', { schoolId, studentId, name: data.name });

    const record = await scholarshipRepository.create({
      ...data,
      schoolId,
      studentId,
      studentName,
      status: 'Active',
    });

    await auditRepository.create({
      action: 'APPLY_DISCOUNT_SCHOLARSHIP',
      userId: appliedBy,
      resource: 'Scholarships',
      details: { studentId, type: data.type, name: data.name, appliedAmount: data.appliedAmount },
      timestamp: new Date().toISOString(),
      schoolId,
    });

    await timelineRepository.create({
      studentId,
      schoolId,
      type: 'Fee Payment',
      title: `Financial Award/Discount Applied`,
      description: `${data.type} (${data.name}) of KES ${data.appliedAmount.toLocaleString()} applied to account.`,
      timestamp: new Date().toISOString(),
      createdBy: appliedBy,
    });

    return record;
  }

  static async getStudentScholarships(studentId: string, schoolId?: string): Promise<ScholarshipOrDiscount[]> {
    return await scholarshipRepository.findByStudent(studentId, schoolId);
  }
}
