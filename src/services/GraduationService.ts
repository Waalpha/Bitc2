import { graduationRepository } from '../repositories/GraduationRepository';
import { studentRepository } from '../repositories/StudentRepository';
import { paymentRepository } from '../repositories/PaymentRepository';
import { GraduationRecord } from '../types/academic.types';
import { LoggerService } from './loggerService';

export class GraduationService {
  static async checkEligibility(studentId: string, schoolId?: string): Promise<{
    eligible: boolean;
    gpa: number;
    feeCleared: boolean;
    academicCleared: boolean;
    reasons: string[];
  }> {
    LoggerService.info('Checking graduation eligibility for student', { studentId, schoolId });

    const student = await studentRepository.findById(studentId);
    const payments = await paymentRepository.findByStudent(studentId, schoolId);

    const reasons: string[] = [];
    const simulatedGpa = 3.25; // Sample calculation
    let feeCleared = true;

    if (!student) {
      return { eligible: false, gpa: 0, feeCleared: false, academicCleared: false, reasons: ['Student record not found'] };
    }

    if (simulatedGpa < 2.0) {
      reasons.push('GPA below minimum graduation threshold (2.0)');
    }

    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
    if (totalPaid < 1000) { // Sample fee threshold check
      feeCleared = false;
      reasons.push('Outstanding fee balance pending clearance');
    }

    const eligible = reasons.length === 0;

    return {
      eligible,
      gpa: simulatedGpa,
      feeCleared,
      academicCleared: simulatedGpa >= 2.0,
      reasons,
    };
  }

  static async issueClearance(studentId: string, schoolId?: string): Promise<GraduationRecord> {
    LoggerService.info('Issuing graduation clearance', { studentId, schoolId });
    const student = await studentRepository.findById(studentId);

    const record: Omit<GraduationRecord, 'id'> = {
      schoolId,
      studentId,
      studentName: student?.name || 'Unknown',
      regNo: student?.regNo || 'N/A',
      courseId: student?.courseId || 'general',
      courseName: student?.course || 'General Program',
      gpa: 3.25,
      weightedGpa: 3.30,
      eligibilityStatus: 'Eligible',
      clearanceCompleted: true,
      certificateIssued: true,
      graduationYear: new Date().getFullYear().toString(),
    };

    return await graduationRepository.create(record);
  }
}
