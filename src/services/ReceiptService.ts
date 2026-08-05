import { paymentRepository } from '../repositories/PaymentRepository';
import { invoiceRepository } from '../repositories/InvoiceRepository';
import { timelineRepository } from '../repositories/TimelineRepository';
import { auditRepository } from '../repositories/AuditRepository';
import { notificationRepository } from '../repositories/NotificationRepository';
import { Payment, PaymentAllocation } from '../types/finance.types';
import { LoggerService } from './loggerService';

export class ReceiptService {
  static generateReceiptNumber(prefix = 'RCT'): string {
    const year = new Date().getFullYear();
    const seq = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}/${year}/${seq}`;
  }

  static async processPaymentAndReceipt(
    schoolId: string,
    studentId: string,
    amount: number,
    paymentMethod: Payment['paymentMethod'],
    allocations: PaymentAllocation[],
    receivedBy = 'Cashier',
    invoiceId?: string,
    bankReference?: string,
    chequeNumber?: string,
    description?: string
  ): Promise<Payment> {
    const receiptNumber = this.generateReceiptNumber();
    LoggerService.info('Processing student payment & receipt generation', { schoolId, studentId, amount, receiptNumber });

    const payment: Payment = await paymentRepository.create({
      schoolId,
      studentId,
      amount,
      paymentMethod,
      receiptNumber,
      receivedBy,
      invoiceId,
      allocations,
      bankReference,
      chequeNumber,
      description: description || `Payment received via ${paymentMethod.toUpperCase()}`,
      date: new Date().toISOString(),
      status: 'completed',
    });

    // Update invoice balance if invoiceId provided
    if (invoiceId) {
      const invoice = await invoiceRepository.findById(invoiceId);
      if (invoice) {
        const newPaid = invoice.paidAmount + amount;
        const newBalance = Math.max(0, invoice.totalAmount - newPaid);
        const newStatus = newBalance === 0 ? 'Paid' : 'Partially Paid';
        await invoiceRepository.update(invoiceId, {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          status: newStatus,
        });
      }
    }

    // Audit Log
    await auditRepository.create({
      action: 'ISSUE_RECEIPT',
      userId: receivedBy,
      resource: 'Receipts',
      details: { receiptNumber, studentId, amount, paymentMethod },
      timestamp: new Date().toISOString(),
      schoolId,
    });

    // Timeline Event
    await timelineRepository.create({
      studentId,
      schoolId,
      type: 'Fee Payment',
      title: `Fee Payment Received (${receiptNumber})`,
      description: `Payment of KES ${amount.toLocaleString()} received via ${paymentMethod}. Receipt #${receiptNumber}`,
      timestamp: new Date().toISOString(),
      createdBy: receivedBy,
    });

    // Notification
    await notificationRepository.create({
      schoolId,
      userId: studentId,
      title: 'Payment Receipt Issued',
      message: `Your payment of KES ${amount.toLocaleString()} has been received. Receipt #${receiptNumber}`,
      type: 'success',
    });

    return payment;
  }
}
