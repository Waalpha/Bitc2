import { invoiceRepository } from '../repositories/InvoiceRepository';
import { paymentRepository } from '../repositories/PaymentRepository';
import { expenseRepository } from '../repositories/ExpenseRepository';
import { creditDebitNoteRepository } from '../repositories/CreditDebitNoteRepository';
import { auditRepository } from '../repositories/AuditRepository';
import { timelineRepository } from '../repositories/TimelineRepository';
import { FinancialSummary, CreditDebitNote } from '../types/finance.types';
import { LoggerService } from './loggerService';

export class EnterpriseFinanceService {
  static async getDashboardSummary(schoolId?: string): Promise<FinancialSummary> {
    LoggerService.info('Generating enterprise finance dashboard summary', { schoolId });

    const [invoices, payments, expenses] = await Promise.all([
      invoiceRepository.findAll(schoolId),
      paymentRepository.findAll(schoolId),
      expenseRepository.findAll(schoolId),
    ]);

    const expectedRevenue = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const collectedRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const outstandingBalances = Math.max(0, expectedRevenue - collectedRevenue);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netIncome = collectedRevenue - totalExpenses;

    // Build sample monthly trends
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrends = months.map(m => ({
      month: m,
      income: Math.round(collectedRevenue / 12 + Math.random() * 5000),
      expenses: Math.round(totalExpenses / 12 + Math.random() * 2000),
    }));

    return {
      expectedRevenue,
      collectedRevenue,
      outstandingBalances,
      totalExpenses,
      netIncome,
      monthlyTrends,
    };
  }

  static async issueCreditDebitNote(
    schoolId: string,
    studentId: string,
    studentName: string,
    type: 'Credit Note' | 'Debit Note',
    amount: number,
    reason: string,
    issuedBy = 'Finance Officer'
  ): Promise<CreditDebitNote> {
    const year = new Date().getFullYear();
    const prefix = type === 'Credit Note' ? 'CN' : 'DN';
    const noteNumber = `${prefix}/${year}/${Math.floor(10000 + Math.random() * 90000)}`;

    LoggerService.info('Issuing Credit/Debit Note', { schoolId, studentId, type, noteNumber, amount });

    const note = await creditDebitNoteRepository.create({
      schoolId,
      studentId,
      studentName,
      type,
      noteNumber,
      amount,
      reason,
      issueDate: new Date().toISOString(),
      issuedBy,
    });

    await auditRepository.create({
      action: 'ISSUE_CREDIT_DEBIT_NOTE',
      userId: issuedBy,
      resource: 'CreditDebitNotes',
      details: { noteNumber, studentId, type, amount, reason },
      timestamp: new Date().toISOString(),
      schoolId,
    });

    await timelineRepository.create({
      studentId,
      schoolId,
      type: 'Fee Payment',
      title: `${type} Issued (${noteNumber})`,
      description: `${type} for KES ${amount.toLocaleString()} issued. Reason: ${reason}`,
      timestamp: new Date().toISOString(),
      createdBy: issuedBy,
    });

    return note;
  }
}
