import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { Invoice } from '../types/finance.types';

export class InvoiceRepository extends BaseRepository<Invoice> {
  constructor() {
    super(COLLECTIONS.INVOICES);
  }

  async findByStudent(studentId: string, schoolId?: string): Promise<Invoice[]> {
    const invoices = await this.findAll(schoolId);
    return invoices.filter(inv => inv.studentId === studentId);
  }

  async findByInvoiceNumber(invoiceNumber: string, schoolId?: string): Promise<Invoice | null> {
    const invoices = await this.findAll(schoolId);
    return invoices.find(inv => inv.invoiceNumber === invoiceNumber) || null;
  }
}

export const invoiceRepository = new InvoiceRepository();
