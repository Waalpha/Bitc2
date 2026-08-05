import { ValidationError } from '../lib/errors';

export interface StudentValidationData {
  name?: string;
  regNo?: string;
  email?: string;
  course?: string;
  yearOfStudy?: number | string;
  phone?: string;
}

export class StudentValidator {
  static validate(data: StudentValidationData): void {
    const errors: Record<string, string> = {};

    if (!data.name || data.name.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters long.';
    }

    if (!data.regNo || data.regNo.trim().length === 0) {
      errors.regNo = 'Registration number is required.';
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Invalid email address format.';
    }

    if (data.phone && !/^\+?[0-9\s\-]{7,15}$/.test(data.phone)) {
      errors.phone = 'Invalid phone number format.';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Student validation failed', errors);
    }
  }
}
