import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { Budget } from '../types/finance.types';

export class BudgetRepository extends BaseRepository<Budget> {
  constructor() {
    super(COLLECTIONS.BUDGETS);
  }

  async findByDepartment(departmentId: string, schoolId?: string): Promise<Budget[]> {
    const budgets = await this.findAll(schoolId);
    return budgets.filter(b => b.departmentId === departmentId);
  }

  async findByYear(academicYear: string, schoolId?: string): Promise<Budget[]> {
    const budgets = await this.findAll(schoolId);
    return budgets.filter(b => b.academicYear === academicYear);
  }
}

export const budgetRepository = new BudgetRepository();
