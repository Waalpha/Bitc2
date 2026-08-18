export type AppUserRole =
  | 'super_admin'
  | 'school_admin'
  | 'principal'
  | 'accountant'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'admin'
  | 'registrar'
  | 'staff'
  | 'finance';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  schoolId?: string;
}

export const PERMISSIONS = [
  { id: 'settings.manage', name: 'Manage System Settings', description: 'Can modify application settings, branding, institutional options, and configurations' },
  { id: 'system_settings', name: 'System Settings (Legacy)', description: 'Can modify app title, logo, and styles' },
  { id: 'manage_users', name: 'Manage Users', description: 'Can view, edit, and delete users' },
  { id: 'manage_classes', name: 'Manage Classes', description: 'Can create and delete classes' },
  { id: 'manage_units', name: 'Manage Units', description: 'Can create and delete units' },
  { id: 'manage_exams', name: 'Manage Exams', description: 'Can create and publish exams' },
  { id: 'mark_attendance', name: 'Mark Attendance', description: 'Can record student attendance' },
  { id: 'view_reports', name: 'View Reports', description: 'Can view system-wide reports' },
  { id: 'view_students', name: 'View Students', description: 'Can view the student directory' },
  { id: 'manage_fees', name: 'Manage Fees', description: 'Can manage student fee balances' },
  { id: 'view_finance', name: 'View Finance', description: 'Can view income and expense charts' },
  { id: 'manage_timetable', name: 'Manage Timetable', description: 'Can create, modify, and auto-generate the school timetable' },
  { id: 'manage_whatsapp', name: 'Manage WhatsApp', description: 'Can send WhatsApp updates and manage broadcast settings' },
  { id: 'manage_chat', name: 'Manage Chat', description: 'Can manage chat groups and community channels' },
  { id: 'student_admission', name: 'Student Admission', description: 'Can admit, enroll, and assign programs to new students' },
  { id: 'manage_marks', name: 'Manage Marks', description: 'Can grade submissions, upload results sheets, and publish marks' },
  { id: 'view_results', name: 'View Results', description: 'Can view student academic performance sheets' },
] as const;

export type PermissionId = typeof PERMISSIONS[number]['id'];

