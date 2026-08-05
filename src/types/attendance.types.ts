export type AttendanceCategory =
  | 'daily'
  | 'lesson'
  | 'practical'
  | 'clinical_attachment'
  | 'industrial_attachment';

export type AttendanceVerificationMethod = 'qr' | 'biometric' | 'gps' | 'manual';

export interface AttendanceRecord {
  id: string;
  schoolId?: string;
  classId: string;
  unitId?: string;
  date: string;
  category?: AttendanceCategory;
  verificationMethod?: AttendanceVerificationMethod;
  latitude?: number;
  longitude?: number;
  qrCode?: string;
  records: { [studentId: string]: 'present' | 'absent' | 'late' | 'excused' };
  biometricLogs?: { 
    [studentId: string]: { 
      checkIn?: { time: string; method: AttendanceVerificationMethod; supervisorId?: string; lat?: number; lng?: number };
      checkOut?: { time: string; method: AttendanceVerificationMethod; supervisorId?: string; refused?: boolean; reason?: string };
      leaveOut?: { time: string; method: AttendanceVerificationMethod; supervisorId?: string; reason?: string; returnDate?: string };
    } 
  };
}

export interface ExamAttendance {
  id: string;
  schoolId?: string;
  examId: string;
  studentId: string;
  status: 'present' | 'absent' | 'excused';
  markedAt: string;
}
