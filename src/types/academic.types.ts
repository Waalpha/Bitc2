export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type StudyMode = 'Morning' | 'Evening' | 'Weekend' | 'Online' | 'Hybrid';

export type ProgramLevel = 'Certificate' | 'Diploma' | 'Higher Diploma' | 'Short Course' | 'Professional Course';

export interface Department {
  id: string;
  schoolId?: string;
  code: string;
  name: string;
  hodId?: string;
  hodName?: string;
  description?: string;
  status?: 'active' | 'suspended';
}

export interface Course {
  id: string;
  schoolId?: string;
  code: string;
  name: string;
  departmentId: string;
  departmentName?: string;
  level: ProgramLevel;
  durationYears?: number;
  totalCredits?: number;
  status?: 'active' | 'suspended';
}

export interface Classroom {
  id: string;
  schoolId?: string;
  building: string;
  floor: string;
  roomNumber: string;
  capacity: number;
  facilities?: string[];
}

export interface LecturerProfile {
  id: string;
  userId: string;
  schoolId?: string;
  employmentStatus: 'Full-Time' | 'Part-Time' | 'Adjunct';
  departmentId?: string;
  officeRoom?: string;
  qualifications?: string[];
  teachingLoadMax?: number;
  assignedUnitIds?: string[];
}

export interface GraduationRecord {
  id: string;
  schoolId?: string;
  studentId: string;
  studentName: string;
  regNo: string;
  courseId: string;
  courseName?: string;
  gpa: number;
  weightedGpa: number;
  eligibilityStatus: 'Eligible' | 'Pending Clearance' | 'Ineligible';
  clearanceCompleted: boolean;
  certificateIssued: boolean;
  graduationYear: string;
}

export interface TimetableEntry {
  id: string;
  schoolId?: string;
  classId: string;
  day: DayOfWeek;
  unitId: string;
  teacherId: string;
  teacherName?: string;
  unitName?: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  room?: string;
  classroomId?: string;
  color?: string;
}

export interface TimetableConflict {
  type: 'TEACHER_CONFLICT' | 'ROOM_CONFLICT' | 'CLASS_CONFLICT';
  message: string;
  conflictingEntries: TimetableEntry[];
}

export interface Class {
  id: string;
  schoolId?: string;
  name: string;
  teacherId: string;
  studyMode?: StudyMode;
  classroomId?: string;
  unitIds?: string[];
  startTime?: string;
  endTime?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export interface Unit {
  id: string;
  schoolId?: string;
  code?: string;
  name: string;
  classId: string;
  creditHours?: number;
  departmentId?: string;
  courseId?: string;
  semesterId?: string;
  lecturerId?: string;
  prerequisites?: string[];
  status?: 'active' | 'completed' | 'archived' | 'suspended';
}

export interface PublicUnit {
  id: string;
  schoolId?: string;
  name: string;
  description: string;
  duration: string;
  fee: string;
  category: string;
  imageUrl?: string;
  requirements?: string[];
}

export interface SchoolCalendar {
  id: string;
  schoolId?: string;
  date: string; // YYYY-MM-DD
  status: 'open' | 'closed';
  reason?: string;
}

export interface AcademicYear {
  id: string;
  schoolId?: string;
  name: string; // e.g. "2026/2027"
  startDate: string;
  endDate: string;
  isActive?: boolean;
  status?: 'active' | 'completed' | 'upcoming';
}

export interface Semester {
  id: string;
  schoolId?: string;
  academicYearId?: string;
  name: string; // e.g., "Semester 1" or "Term 1"
  type?: 'semester' | 'term';
  startDate: string;
  endDate: string;
  isActive?: boolean;
  status?: 'active' | 'completed' | 'upcoming';
}
