import { PERMISSIONS_LIST } from './permissions';

export type EnterpriseRoleType =
  | 'super_admin'
  | 'school_admin'
  | 'principal'
  | 'accountant'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'librarian'
  | 'registrar'
  | 'receptionist'
  | 'hr_manager'
  // Backward compatibility legacy roles
  | 'admin'
  | 'staff'
  | 'finance';

export interface RoleConfig {
  id: EnterpriseRoleType | string;
  name: string;
  description: string;
  defaultPermissions: string[];
  isSystemRole?: boolean;
}

export const SYSTEM_ROLES: RoleConfig[] = [
  {
    id: 'super_admin',
    name: 'Super Administrator',
    description: 'Full unrestricted institutional access across all academic units, system settings, and infrastructure.',
    defaultPermissions: [...PERMISSIONS_LIST],
    isSystemRole: true,
  },
  {
    id: 'school_admin',
    name: 'Institutional Administrator',
    description: 'Full administrative control over institutional operations, staff, students, fees, and settings.',
    defaultPermissions: PERMISSIONS_LIST.filter(p => p !== 'schools.manage'),
    isSystemRole: true,
  },
  {
    id: 'admin',
    name: 'Administrator (Legacy)',
    description: 'Legacy administrator role with full school management permissions.',
    defaultPermissions: PERMISSIONS_LIST.filter(p => p !== 'schools.manage'),
    isSystemRole: true,
  },
  {
    id: 'principal',
    name: 'School Principal',
    description: 'Executive oversight of academic performance, attendance, staff management, and official reporting.',
    defaultPermissions: [
      'dashboard.view',
      'students.view',
      'teachers.view',
      'attendance.view',
      'classes.view',
      'units.view',
      'exams.view',
      'results.view',
      'results.publish',
      'fees.view',
      'finance.view',
      'reports.view',
      'reports.export',
      'chat.view',
      'chat.send',
      'whatsapp.send',
      'hr.manage',
      'audit.view',
    ],
    isSystemRole: true,
  },
  {
    id: 'accountant',
    name: 'Accountant / Bursar',
    description: 'Complete management of fee structures, collections, payment refunds, and financial reporting.',
    defaultPermissions: [
      'dashboard.view',
      'students.view',
      'fees.view',
      'fees.collect',
      'fees.manage',
      'payments.view',
      'payments.refund',
      'finance.view',
      'reports.view',
      'reports.export',
      'chat.view',
    ],
    isSystemRole: true,
  },
  {
    id: 'finance',
    name: 'Finance Officer (Legacy)',
    description: 'Legacy finance role focused on fee collection and expense tracking.',
    defaultPermissions: [
      'dashboard.view',
      'students.view',
      'fees.view',
      'fees.collect',
      'fees.manage',
      'payments.view',
      'finance.view',
      'reports.view',
    ],
    isSystemRole: true,
  },
  {
    id: 'teacher',
    name: 'Teacher / Instructor',
    description: 'Manages assigned class rosters, marks daily attendance, conducts exams, and records student grades.',
    defaultPermissions: [
      'dashboard.view',
      'students.view',
      'attendance.view',
      'attendance.mark',
      'mark_attendance',
      'classes.view',
      'classes.manage',
      'manage_classes',
      'units.view',
      'units.manage',
      'manage_units',
      'exams.view',
      'exams.create',
      'exams.grade',
      'manage_exams',
      'results.view',
      'view_results',
      'fees.view',
      'fees.collect',
      'fees.manage',
      'manage_fees',
      'chat.view',
      'chat.send',
      'whatsapp.send',
      'manage_timetable',
    ],
    isSystemRole: true,
  },
  {
    id: 'student',
    name: 'Student',
    description: 'Access to personal academic timetable, unit materials, online exam portal, grades, and fee ledger.',
    defaultPermissions: [
      'dashboard.view',
      'units.view',
      'classes.view',
      'exams.view',
      'results.view',
      'fees.view',
      'chat.view',
      'chat.send',
    ],
    isSystemRole: true,
  },
  {
    id: 'parent',
    name: 'Parent / Guardian',
    description: 'Monitors linked ward attendance, academic performance, exam transcripts, and fee payment status.',
    defaultPermissions: [
      'dashboard.view',
      'attendance.view',
      'results.view',
      'fees.view',
      'chat.view',
    ],
    isSystemRole: true,
  },
  {
    id: 'librarian',
    name: 'Librarian',
    description: 'Manages the school library catalog, book issues, returns, and student library circulation.',
    defaultPermissions: [
      'dashboard.view',
      'students.view',
      'library.manage',
      'chat.view',
      'reports.view',
    ],
    isSystemRole: true,
  },
  {
    id: 'registrar',
    name: 'Registrar',
    description: 'Handles student admissions, program enrollments, class assignments, and official academic transcripts.',
    defaultPermissions: [
      'dashboard.view',
      'students.view',
      'students.create',
      'students.edit',
      'classes.view',
      'classes.manage',
      'units.view',
      'units.manage',
      'reports.view',
      'reports.export',
    ],
    isSystemRole: true,
  },
  {
    id: 'receptionist',
    name: 'Front Desk / Receptionist',
    description: 'Front desk visitor logs, student lookup, attendance verification, and general communication.',
    defaultPermissions: [
      'dashboard.view',
      'students.view',
      'attendance.view',
      'chat.view',
      'chat.send',
      'whatsapp.send',
    ],
    isSystemRole: true,
  },
  {
    id: 'hr_manager',
    name: 'Human Resource Manager',
    description: 'Manages staff profiles, contracts, attendance, leave requests, and payroll records.',
    defaultPermissions: [
      'dashboard.view',
      'teachers.view',
      'teachers.create',
      'teachers.edit',
      'hr.manage',
      'reports.view',
      'reports.export',
      'users.manage',
    ],
    isSystemRole: true,
  },
  {
    id: 'staff',
    name: 'Support Staff (Legacy)',
    description: 'General support staff with view and management access to staff modules.',
    defaultPermissions: [
      'dashboard.view',
      'students.view',
      'attendance.view',
      'attendance.mark',
      'mark_attendance',
      'classes.view',
      'classes.manage',
      'manage_classes',
      'units.view',
      'units.manage',
      'manage_units',
      'exams.view',
      'exams.create',
      'exams.grade',
      'manage_exams',
      'results.view',
      'view_results',
      'fees.view',
      'fees.collect',
      'fees.manage',
      'manage_fees',
      'chat.view',
      'chat.send',
      'whatsapp.send',
      'manage_timetable',
    ],
    isSystemRole: true,
  },
];

export function getDefaultRolePermissions(roleId: string): string[] {
  const role = SYSTEM_ROLES.find(r => r.id === roleId.toLowerCase().trim());
  return role ? role.defaultPermissions : ['dashboard.view'];
}
