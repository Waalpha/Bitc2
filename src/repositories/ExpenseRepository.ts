import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { Expense } from '../types/finance.types';

export class ExpenseRepository extends BaseRepository<Expense> {
  constructor() {
    super(COLLECTIONS.EXPENSES);
  }

  async findByCategory(category: string, schoolId?: string): Promise<Expense[]> {
    const expenses = await this.findAll(schoolId);
    return expenses.filter(e => e.category.toLowerCase() === category.toLowerCase());
  }

  async findByDepartment(departmentId: string, schoolId?: string): Promise<Expense[]> {
    const expenses = await this.findAll(schoolId);
    return expenses.filter(e => e.departmentId === departmentId);
  }
}

export const expenseRepository = new ExpenseRepository();
