export type AdmissionStage =
  | 'Application Submitted'
  | 'Document Verification'
  | 'Interview'
  | 'Entrance Exam'
  | 'Approved'
  | 'Rejected'
  | 'Waiting List'
  | 'Enrolled';

export type LifecycleStatus =
  | 'Applicant'
  | 'Active'
  | 'Deferred'
  | 'Suspended'
  | 'Transferred'
  | 'Graduated'
  | 'Withdrawn'
  | 'Alumni';

export type DocumentType =
  | 'Passport Photo'
  | 'National ID'
  | 'Birth Certificate'
  | 'KCSE Certificate'
  | 'Leaving Certificate'
  | 'Recommendation Letter'
  | 'Medical Form'
  | 'Attachment Letter'
  | 'Internship Report'
  | 'Certificates'
  | 'Transcripts'
  | 'Other';

export interface StudentDocument {
  id: string;
  studentId?: string;
  schoolId?: string;
  name: string;
  url: string;
  type?: DocumentType | string;
  uploadDate?: string;
  uploadedAt?: string;
  expiryDate?: string;
  uploadedBy?: string;
  version?: string;
  status?: 'pending' | 'verified' | 'rejected' | 'expired';
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface GuardianInfo {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface Student {
  id: string;
  schoolId?: string;
  userId?: string;
  admissionNumber?: string;
  regNo?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  gender?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  religion?: string;
  caste?: string;
  bloodGroup?: string;
  address?: string;
  departmentId?: string;
  departmentName?: string;
  course?: string;
  courseId?: string;
  programLevel?: 'Certificate' | 'Diploma' | 'Higher Diploma' | 'Short Course' | 'Professional Course';
  classId?: string;
  currentSemester?: string;
  currentYear?: number | string;
  academicYear?: string;
  expectedGraduationDate?: string;
  guardianId?: string;
  guardianInfo?: GuardianInfo;
  emergencyContacts?: EmergencyContact[];
  documents?: StudentDocument[];
  lifecycleStatus?: LifecycleStatus;
  status?: 'active' | 'inactive' | 'suspended' | 'graduated' | 'transferred' | 'deactivated' | 'disqualified' | LifecycleStatus;
  createdAt?: string;
}

export interface AdmissionApplication {
  id: string;
  schoolId?: string;
  studentName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  course?: string;
  courseId?: string;
  unitId?: string;
  stage: AdmissionStage;
  status: 'pending' | 'approved' | 'rejected' | AdmissionStage;
  submittedAt: string;
  notes?: string;
  admissionNumber?: string;
  history?: Array<{ stage: string; timestamp: string; updatedBy?: string; notes?: string }>;
}

export interface AcademicProgress {
  studentId: string;
  schoolId?: string;
  currentAcademicYear: string;
  currentSemester: string;
  completedUnits: string[];
  pendingUnits: string[];
  retakes: string[];
  supplementaryExams: string[];
  creditsEarned: number;
  creditsRemaining: number;
  gpa: number;
  graduationEligibility: boolean;
}

export interface AttachmentRecord {
  id: string;
  studentId: string;
  schoolId?: string;
  hostOrganization: string;
  department: string;
  supervisorName: string;
  supervisorEmail: string;
  supervisorPhone: string;
  weeklyLogbook?: Array<{ weekNumber: number; summary: string; supervisorApproval: boolean }>;
  attendanceDays?: number;
  evaluationScore?: number;
  finalReportUrl?: string;
  completionStatus: 'In Progress' | 'Completed' | 'Pending Review' | 'Failed';
}

export interface AlumniProfile {
  id: string;
  studentId: string;
  schoolId?: string;
  fullName: string;
  regNo: string;
  course: string;
  graduationYear: string;
  employer?: string;
  jobTitle?: string;
  country?: string;
  furtherEducation?: string;
  professionalRegistration?: string;
}

export interface TimelineEvent {
  id: string;
  studentId: string;
  schoolId?: string;
  type: 'Admission' | 'Fee Payment' | 'Attendance' | 'Exam' | 'Result' | 'Warning' | 'Suspension' | 'Graduation' | 'Certificate';
  title: string;
  description: string;
  timestamp: string;
  createdBy?: string;
  category?: string;
}

export interface ClearanceRecord {
  id: string;
  studentId: string;
  schoolId?: string;
  financeCleared: boolean;
  libraryCleared: boolean;
  hostelCleared: boolean;
  departmentCleared: boolean;
  registrarCleared: boolean;
  principalCleared: boolean;
  remarks?: string;
  issuedAt?: string;
  certificateUrl?: string;
}

export interface IssuedCertificate {
  id: string;
  studentId: string;
  schoolId?: string;
  certType: 'Certificate of Completion' | 'Diploma' | 'Transcript' | 'Recommendation Letter' | 'Bonafide Letter' | 'Attachment Letter';
  certNumber: string;
  studentName: string;
  course: string;
  issueDate: string;
  qrCodeUrl: string;
  digitalSignature?: string;
  verified: boolean;
}

