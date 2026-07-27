export interface User {
  uid: string;
  name: string;
  email: string;
  role: string; // Dynamic role
  classIds?: string[];
  disabled?: boolean;
  biometricId?: string;
  biometricRawId?: string;
  biometricLinkedAt?: string;
  createdAt: string;
  schoolId?: string; // Multi-tenant school ID reference
  // Admission Fields
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
  religion?: string;
  caste?: string;
  photoUrl?: string;
  admissionNumber?: string;
  admissionDate?: string;
  academicYear?: string;
  course?: string; // Renamed from section
  roll?: string;
  group?: string;
  phone?: string;
  bloodGroup?: string;
  category?: string;
  fcmTokens?: string[];
  lastActive?: string;
  earlyCheckoutAllowed?: boolean;
  year?: string;
  specialization?: string;
  residence?: string;
  idNumber?: string;
  studentId?: string;
  validUntil?: string;
  nationality?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  address?: string;
  // Parent & Guardian Fields
  fatherName?: string;
  fatherPhone?: string;
  fatherOccupation?: string;
  motherName?: string;
  motherPhone?: string;
  motherOccupation?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianPhone?: string;
  guardianOccupation?: string;
  guardianAddress?: string;
  guardianEmail?: string;
  // Attachment & Rotation Details
  attachmentLetterUrl?: string;
  attachmentLetterName?: string;
  rotationHostOrg?: string;
  rotationDepartment?: string;
  rotationStartDate?: string;
  rotationEndDate?: string;
  rotationSupervisor?: string;
  rotationSupervisorContact?: string;
  rotationStatus?: 'none' | 'pending' | 'active' | 'completed';
  rotationNotes?: string;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface TimetableEntry {
  id: string;
  classId: string;
  day: DayOfWeek;
  unitId: string;
  teacherId: string;
  teacherName?: string; // Cache teacher name for easier rendering
  unitName?: string; // Cache unit name
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  room?: string;
  color?: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export const PERMISSIONS = [
  { id: 'manage_users', name: 'Manage Users', description: 'Can view, edit, and delete users' },
  { id: 'manage_classes', name: 'Manage Classes', description: 'Can create and delete classes' },
  { id: 'manage_units', name: 'Manage Units', description: 'Can create and delete units' },
  { id: 'manage_exams', name: 'Manage Exams', description: 'Can create and publish exams' },
  { id: 'mark_attendance', name: 'Mark Attendance', description: 'Can record student attendance' },
  { id: 'view_reports', name: 'View Reports', description: 'Can view system-wide reports' },
  { id: 'view_students', name: 'View Students', description: 'Can view the student directory' },
  { id: 'manage_fees', name: 'Manage Fees', description: 'Can manage student fee balances' },
  { id: 'view_finance', name: 'View Finance', description: 'Can view income and expense charts' },
  { id: 'system_settings', name: 'System Settings', description: 'Can modify app title, logo, and styles' },
  { id: 'manage_timetable', name: 'Manage Timetable', description: 'Can create, modify, and auto-generate the school timetable' },
  { id: 'manage_whatsapp', name: 'Manage WhatsApp', description: 'Can send WhatsApp updates and manage broadcast settings' },
  { id: 'manage_chat', name: 'Manage Chat', description: 'Can manage chat groups and community channels' },
  { id: 'student_admission', name: 'Student Admission', description: 'Can admit, enroll, and assign programs to new students' },
  { id: 'manage_marks', name: 'Manage Marks', description: 'Can grade submissions, upload results sheets, and publish marks' },
  { id: 'view_results', name: 'View Results', description: 'Can view student academic performance sheets' },
] as const;

export interface Class {
  id: string;
  name: string;
  teacherId: string;
  unitIds?: string[]; // Renamed from units
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  latitude?: number;
  longitude?: number;
  radius?: number; // Geofence Radius in meters
}

export interface Unit {
  id: string;
  name: string;
  classId: string;
  status: 'active' | 'completed';
}

export type ExamType = 'Midterm' | 'Final' | 'Quiz' | 'Assignment' | 'Practical' | 'Physical';

export interface Question {
  id: string;
  text: string;
  type: 'multiple-choice' | 'text';
  options?: string[];
  correctAnswer?: string;
}

export interface Exam {
  id: string;
  title: string;
  type: ExamType;
  unitId: string;
  classId: string;
  teacherId: string;
  questions: Question[];
  published: boolean;
  isOffline?: boolean;
  dueDate?: string;
  examDate?: string;
  location?: string;
  maxMarks: number;
  passingMarks: number;
  duration?: number; // In minutes
  createdAt: string;
}

export interface Submission {
  id: string;
  examId: string;
  studentId: string;
  answers: { questionId: string; answer: string }[];
  grade?: number;
  feedback?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf' | 'word' | 'video';
  submittedAt: string;
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  date: string;
  records: { [studentId: string]: 'present' | 'absent' | 'late' | 'excused' };
  biometricLogs?: { 
    [studentId: string]: { 
      checkIn?: { time: string; method: 'qr' | 'biometric' | 'gps' | 'manual'; supervisorId?: string };
      checkOut?: { time: string; method: 'qr' | 'biometric' | 'gps' | 'manual'; supervisorId?: string; refused?: boolean; reason?: string };
      leaveOut?: { time: string; method: 'qr' | 'biometric' | 'gps' | 'manual'; supervisorId?: string; reason?: string; returnDate?: string };
    } 
  };
}

export interface ExamAttendance {
  id: string;
  examId: string;
  studentId: string;
  status: 'present' | 'absent' | 'excused';
  markedAt: string;
}

export interface Grade {
  id: string;
  label: string; // e.g., 'A', 'B', 'C'
  minPercentage: number;
  maxPercentage: number;
  comment?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'exam' | 'grade' | 'announcement' | 'deadline' | 'fee' | 'broadcast' | 'chat' | 'attendance';
  read: boolean;
  createdAt: string;
  senderId?: string;
  link?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf' | 'word' | 'video';
}

export interface FeeBalance {
  id: string;
  studentId: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  lastUpdated: string;
  installmentPlanTotal?: number;
  installmentPlanRate?: number;
  history?: { 
    date: string; 
    amount: number; 
    type: 'payment' | 'charge'; 
    description: string;
    attachmentUrl?: string;
    attachmentName?: string;
  }[];
}

export interface FeeType {
  id: string;
  name: string;
  description?: string;
}

export interface FeeGroup {
  id: string;
  name: string;
  description?: string;
}

export interface ClassFee {
  id: string;
  classId: string;
  title: string;
  amount: number;
  period: 'semester' | 'yearly' | 'monthly';
  feeType?: string;
  feeGroup?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
  recordedBy: string;
}

export interface SchoolCalendar {
  id: string;
  date: string; // YYYY-MM-DD
  status: 'open' | 'closed';
  reason?: string;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt: string;
  type: 'direct' | 'group';
  name?: string;
  classId?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  createdAt: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'pdf' | 'word' | 'file' | 'video';
  attachmentName?: string;
  attachmentSize?: number;
  readBy?: string[];
}

export interface AppSettings {
  appTitle: string;
  schoolName?: string;
  logoUrl?: string;
  stampUrl?: string;
  stampPosition?: 'left' | 'center' | 'right';
  fontFamily: string;
  fontSize: string;
  textAlign: 'left' | 'center' | 'right';
  isSchoolClosed?: boolean;
  schoolClosedReason?: string;
  schoolReopenDate?: string;
  allowGateAccessWithFees?: boolean;
  // Public Portal Settings
  publicAddress?: string;
  publicPhone?: string;
  publicEmail?: string;
  publicLocationEmbed?: string;
  publicHeroTitle?: string;
  publicHeroDescription?: string;
  publicHeroImageUrl?: string;
  publicHeroImages?: string[];
  publicHeroFont?: string;
  publicHeroAlign?: 'left' | 'center' | 'right';
  publicHeroTitleSize?: string;
  publicHeroDescriptionSize?: string;
  publicHeroTitleBold?: boolean;
  publicHeroTitleItalic?: boolean;
  publicHeroDescriptionBold?: boolean;
  publicHeroDescriptionItalic?: boolean;
  publicHeroPhotoOpacity?: number;
  publicLogoUrl?: string;
  publicPrimaryColor?: string;
  publicSecondaryColor?: string;
  publicAccentColor?: string;
  // Public Portal Sections
  portalAboutUs?: string;
  aboutTitle?: string;
  aboutImageUrl?: string;
  portalGallery?: string[];
  sessionTimeoutSeconds?: number;
  activeSession?: string;
  denyAccessOnBalance?: boolean;
  // Landing Page CMS additions
  portalNoticeEnabled?: boolean;
  portalNoticeText?: string;
  portalNoticeLink?: string;
  portalStat1Number?: string;
  portalStat1Label?: string;
  portalStat1Sub?: string;
  portalStat2Number?: string;
  portalStat2Label?: string;
  portalStat2Sub?: string;
  portalStat3Number?: string;
  portalStat3Label?: string;
  portalStat3Sub?: string;
  portalStat4Number?: string;
  portalStat4Label?: string;
  portalStat4Sub?: string;
  portalTestimonials?: {
    name: string;
    role: string;
    workplace: string;
    quote: string;
    rating: number;
    avatar: string;
  }[];
  isPenaltyEnabled?: boolean;
  penaltyDay?: number;
  penaltyAmount?: number;
}

export interface StyledText {
  text: string;
  fontSize?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
}

export interface LandingSettings {
  logoUrl?: string;
  featuresTitle: StyledText;
  featuresSubtitle: StyledText;
  features: {
    title: StyledText;
    description: StyledText;
    iconName: string;
  }[];
  stats: {
    label: string;
    value: string;
  }[];
  ctaTitle: StyledText;
  ctaSubtitle: StyledText;
  ctaButtonText: string;
}

export interface PublicUnit {
  id: string;
  name: string;
  description: string;
  duration: string;
  fee: string;
  category: string;
  imageUrl?: string;
  requirements?: string[];
}

export interface AdmissionApplication {
  id: string;
  studentName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  unitId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  notes?: string;
}

export interface School {
  id: string; // Document ID: e.g. "bitc", "greenwood"
  name: string;
  appTitle: string;
  logoUrl?: string;
  createdAt: string;
}
