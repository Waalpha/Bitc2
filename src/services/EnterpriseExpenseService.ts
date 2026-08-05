import { expenseRepository } from '../repositories/ExpenseRepository';
import { auditRepository } from '../repositories/AuditRepository';
import { Expense } from '../types/finance.types';
import { LoggerService } from './loggerService';

export class EnterpriseExpenseService {
  static async recordExpense(
    schoolId: string,
    data: Omit<Expense, 'id' | 'schoolId' | 'status'>
  ): Promise<Expense> {
    LoggerService.info('Recording enterprise expense', { schoolId, title: data.title, amount: data.amount });

    const expense = await expenseRepository.create({
      ...data,
      schoolId,
      status: 'Pending Approval',
    });

    await auditRepository.create({
      action: 'RECORD_EXPENSE',
      userId: data.recordedBy,
      resource: 'Expenses',
      details: { title: data.title, amount: data.amount, category: data.category },
      timestamp: new Date().toISOString(),
      schoolId,
    });

    return expense;
  }

  static async updateApprovalStatus(
    expenseId: string,
    status: 'Approved' | 'Rejected' | 'Paid',
    approvedBy: string
  ): Promise<void> {
    const existing = await expenseRepository.findById(expenseId);
    if (!existing) return;

    LoggerService.info('Updating expense approval status', { expenseId, status, approvedBy });

    await expenseRepository.update(expenseId, {
      status,
      approvedBy,
      approvalDate: new Date().toISOString(),
    });

    await auditRepository.create({
      action: 'UPDATE_EXPENSE_APPROVAL',
      userId: approvedBy,
      resource: 'Expenses',
      details: { expenseId, oldStatus: existing.status, newStatus: status },
      timestamp: new Date().toISOString(),
      schoolId: existing.schoolId,
    });
  }

  static async getExpenses(schoolId?: string): Promise<Expense[]> {
    return await expenseRepository.findAll(schoolId);
  }
}
