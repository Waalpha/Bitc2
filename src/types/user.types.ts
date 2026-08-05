export interface User {
  id?: string;
  uid: string;
  name: string;
  email: string;
  role: string; // Dynamic role
  schoolId?: string; // Multi-tenant school ID reference
  phone?: string;
  photoUrl?: string;
  createdAt: string;
  classIds?: string[];
  disabled?: boolean;
  biometricId?: string;
  biometricRawId?: string;
  biometricLinkedAt?: string;
  status?: string;
  lifecycleStatus?: string;
  departmentId?: string;
  courseId?: string;
  // Admission & Profile Fields (Backward compatibility)
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
  religion?: string;
  caste?: string;
  admissionNumber?: string;
  admissionDate?: string;
  academicYear?: string;
  course?: string;
  roll?: string;
  group?: string;
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
  regNo?: string;
  department?: string;
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
