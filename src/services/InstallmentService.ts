import { installmentPlanRepository } from '../repositories/InstallmentPlanRepository';
import { auditRepository } from '../repositories/AuditRepository';
import { InstallmentSchedule } from '../types/finance.types';
import { LoggerService } from './loggerService';

export class InstallmentService {
  static async createInstallmentPlan(
    schoolId: string,
    studentId: string,
    totalAmount: number,
    installmentsCount: number,
    firstDueDate: string,
    invoiceId?: string,
    createdById = 'Finance Officer'
  ): Promise<InstallmentSchedule> {
    LoggerService.info('Creating installment plan for student', { schoolId, studentId, totalAmount, installmentsCount });

    const perInstallment = Math.round(totalAmount / installmentsCount);
    const installments: InstallmentSchedule['installments'] = [];

    const startDate = new Date(firstDueDate);
    for (let i = 0; i < installmentsCount; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      installments.push({
        dueDate: dueDate.toISOString().split('T')[0],
        amount: i === installmentsCount - 1 ? totalAmount - perInstallment * (installmentsCount - 1) : perInstallment,
        paidAmount: 0,
        status: 'Pending',
      });
    }

    const plan = await installmentPlanRepository.create({
      schoolId,
      studentId,
      invoiceId,
      totalAmount,
      outstandingAmount: totalAmount,
      installments,
    });

    await auditRepository.create({
      action: 'CREATE_INSTALLMENT_PLAN',
      userId: createdById,
      resource: 'InstallmentPlans',
      details: { studentId, totalAmount, installmentsCount },
      timestamp: new Date().toISOString(),
      schoolId,
    });

    return plan;
  }

  static async getStudentPlan(studentId: string, schoolId?: string): Promise<InstallmentSchedule | null> {
    return await installmentPlanRepository.findByStudent(studentId, schoolId);
  }
}
