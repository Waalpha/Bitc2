export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EXCUSED = 'excused',
}

export enum FeeStatus {
  PAID = 'paid',
  PENDING = 'pending',
  PARTIAL = 'partial',
  OVERDUE = 'overdue',
}

export enum ExamType {
  MAIN = 'Main Examination',
  CAT1 = 'Continuous Assessment 1',
  CAT2 = 'Continuous Assessment 2',
  SUPPLEMENTARY = 'Supplementary Exam',
  SPECIAL = 'Special Exam',
  ASSIGNMENT = 'Assignment',
}

export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  SUCCESS = 'success',
  URGENT = 'urgent',
}

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other',
}

export enum StudentStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  GRADUATED = 'graduated',
  DEACTIVATED = 'deactivated',
  DISQUALIFIED = 'disqualified',
}
