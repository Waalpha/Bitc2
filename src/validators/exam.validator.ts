import { ValidationError } from '../lib/errors';

export interface ExamValidationData {
  title?: string;
  unitCode?: string;
  unitName?: string;
  date?: string;
  totalMarks?: number;
}

export class ExamValidator {
  static validate(data: ExamValidationData): void {
    const errors: Record<string, string> = {};

    if (!data.title || data.title.trim().length === 0) {
      errors.title = 'Exam title is required.';
    }

    if (!data.unitCode || data.unitCode.trim().length === 0) {
      errors.unitCode = 'Unit code is required.';
    }

    if (!data.date) {
      errors.date = 'Exam date is required.';
    }

    if (data.totalMarks !== undefined && (data.totalMarks <= 0 || isNaN(data.totalMarks))) {
      errors.totalMarks = 'Total marks must be a positive number.';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Exam validation failed', errors);
    }
  }
}
