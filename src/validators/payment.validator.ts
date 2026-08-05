import { ValidationError } from '../lib/errors';

export interface PaymentValidationData {
  studentId?: string;
  amount?: number;
  paymentMethod?: string;
  referenceNumber?: string;
}

export class PaymentValidator {
  static validate(data: PaymentValidationData): void {
    const errors: Record<string, string> = {};

    if (!data.studentId) {
      errors.studentId = 'Student selection is required.';
    }

    if (data.amount === undefined || data.amount <= 0 || isNaN(data.amount)) {
      errors.amount = 'Payment amount must be greater than 0.';
    }

    if (!data.paymentMethod) {
      errors.paymentMethod = 'Payment method is required.';
    }

    if (!data.referenceNumber || data.referenceNumber.trim().length === 0) {
      errors.referenceNumber = 'Transaction reference number is required.';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Payment validation failed', errors);
    }
  }
}
