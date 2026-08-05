import { invoiceRepository } from '../repositories/InvoiceRepository';
import { timelineRepository } from '../repositories/TimelineRepository';
import { auditRepository } from '../repositories/AuditRepository';
import { Invoice, InvoiceItem } from '../types/finance.types';
import { LoggerService } from './loggerService';

export class InvoiceService {
  static generateInvoiceNumber(prefix = 'INV'): string {
    const year = new Date().getFullYear();
    const seq = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}/${year}/${seq}`;
  }

  static async createInvoice(
    schoolId: string,
    studentId: string,
    studentName: string,
    regNo: string,
    items: InvoiceItem[],
    dueDate: string,
    academicYear?: string,
    semester?: string,
    createdById = 'Finance'
  ): Promise<Invoice> {
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const invoiceNumber = this.generateInvoiceNumber();

    LoggerService.info('Creating student invoice', { schoolId, studentId, invoiceNumber, totalAmount });

    const invoice: Invoice = await invoiceRepository.create({
      schoolId,
      invoiceNumber,
      studentId,
      studentName,
      regNo,
      academicYear,
      semester,
      items,
      totalAmount,
      paidAmount: 0,
      balanceAmount: totalAmount,
      issueDate: new Date().toISOString(),
      dueDate,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    });

    // Audit log
    await auditRepository.create({
      action: 'CREATE_INVOICE',
      userId: createdById,
      resource: 'Invoices',
      details: { invoiceNumber, studentId, totalAmount },
      timestamp: new Date().toISOString(),
      schoolId,
    });

    // Timeline event
    await timelineRepository.create({
      studentId,
      schoolId,
      type: 'Fee Payment',
      title: `Invoice Generated (${invoiceNumber})`,
      description: `New invoice for amount KES ${totalAmount.toLocaleString()} generated. Due on ${dueDate}`,
      timestamp: new Date().toISOString(),
      createdBy: createdById,
    });

    return invoice;
  }

  static async getStudentInvoices(studentId: string, schoolId?: string): Promise<Invoice[]> {
    return await invoiceRepository.findByStudent(studentId, schoolId);
  }

  static async markStatus(
    invoiceId: string,
    status: Invoice['status'],
    updatedById = 'Finance'
  ): Promise<void> {
    const invoice = await invoiceRepository.findById(invoiceId);
    if (!invoice) return;

    await invoiceRepository.update(invoiceId, { status });

    await auditRepository.create({
      action: 'UPDATE_INVOICE_STATUS',
      userId: updatedById,
      resource: 'Invoices',
      details: { invoiceId, invoiceNumber: invoice.invoiceNumber, oldStatus: invoice.status, newStatus: status },
      timestamp: new Date().toISOString(),
      schoolId: invoice.schoolId,
    });
  }
}
