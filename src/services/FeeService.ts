import { feeRepository, FeeStructure } from '../repositories/FeeRepository';
import { paymentRepository, PaymentTransaction } from '../repositories/PaymentRepository';
import { PaymentValidator } from '../validators/payment.validator';
import { LoggerService } from './loggerService';

export class FeeService {
  static async collectFee(schoolId: string, paymentData: Omit<PaymentTransaction, 'id' | 'schoolId' | 'date' | 'status'>): Promise<PaymentTransaction> {
    PaymentValidator.validate(paymentData);
    LoggerService.info('Collecting fee payment', { schoolId, studentId: paymentData.studentId, amount: paymentData.amount });

    return await paymentRepository.create({
      ...paymentData,
      schoolId,
      date: new Date().toISOString(),
      status: 'completed',
    });
  }

  static async getStudentPayments(studentId: string, schoolId?: string): Promise<PaymentTransaction[]> {
    return await paymentRepository.findByStudent(studentId, schoolId);
  }

  static async getFeeStructures(schoolId?: string): Promise<FeeStructure[]> {
    return await feeRepository.findAll(schoolId);
  }
}
