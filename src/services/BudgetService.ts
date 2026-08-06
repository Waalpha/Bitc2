import { budgetRepository } from '../repositories/BudgetRepository';
import { expenseRepository } from '../repositories/ExpenseRepository';
import { Budget } from '../types/finance.types';
import { LoggerService } from './loggerService';

export class BudgetService {
  static async createBudget(
    schoolId: string,
    data: Omit<Budget, 'id' | 'schoolId' | 'spentAmount' | 'remainingAmount'>
  ): Promise<Budget> {
    LoggerService.info('Creating annual/department budget', { schoolId, category: data.category, allocated: data.allocatedAmount });

    return await budgetRepository.create({
      ...data,
      schoolId,
      spentAmount: 0,
      remainingAmount: data.allocatedAmount,
    });
  }

  static async getBudgetVsActualReport(academicYear: string, schoolId?: string) {
    const budgets = await budgetRepository.findByYear(academicYear, schoolId);
    const expenses = await expenseRepository.findAll(schoolId);

    return budgets.map(b => {
      const categoryExpenses = expenses.filter(e => (e.category || '').toLowerCase() === (b.category || '').toLowerCase() && e.status === 'Approved');
      const spent = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
      const remaining = b.allocatedAmount - spent;
      const variancePercentage = b.allocatedAmount > 0 ? ((spent - b.allocatedAmount) / b.allocatedAmount) * 100 : 0;

      return {
        ...b,
        spentAmount: spent,
        remainingAmount: remaining,
        variancePercentage: Number(variancePercentage.toFixed(2)),
      };
    });
  }
}
