import { BaseRepository } from './BaseRepository';
import { COLLECTIONS } from '../constants/collections';
import { Payment } from '../types/finance.types';

export interface PaymentTransaction extends Payment {
  referenceNumber?: string;
}

export class PaymentRepository extends BaseRepository<PaymentTransaction> {
  constructor() {
    super(COLLECTIONS.PAYMENTS);
  }

  async findByStudent(studentId: string, schoolId?: string): Promise<PaymentTransaction[]> {
    const payments = await this.findAll(schoolId);
    return payments.filter(p => p.studentId === studentId);
  }
}

export const paymentRepository = new PaymentRepository();

