import { ValidationError } from '../lib/errors';

export interface AdmissionValidationData {
  name?: string;
  email?: string;
  phone?: string;
  course?: string;
  nationalId?: string;
}

export class AdmissionValidator {
  static validate(data: AdmissionValidationData): void {
    const errors: Record<string, string> = {};

    if (!data.name || data.name.trim().length < 2) {
      errors.name = 'Applicant full name is required.';
    }

    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Valid email address is required.';
    }

    if (!data.course || data.course.trim().length === 0) {
      errors.course = 'Degree/Diploma course selection is required.';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Student admission validation failed', errors);
    }
  }
}
