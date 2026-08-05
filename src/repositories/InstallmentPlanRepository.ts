import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { InstallmentSchedule } from '../types/finance.types';

export class InstallmentPlanRepository extends BaseRepository<InstallmentSchedule> {
  constructor() {
    super(COLLECTIONS.INSTALLMENT_PLANS);
  }

  async findByStudent(studentId: string, schoolId?: string): Promise<InstallmentSchedule | null> {
    const list = await this.findAll(schoolId);
    return list.find(plan => plan.studentId === studentId) || null;
  }
}

export const installmentPlanRepository = new InstallmentPlanRepository();
