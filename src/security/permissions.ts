export const PERMISSIONS_LIST = [
  // Dashboard & General
  'dashboard.view',

  // Student Management
  'students.view',
  'students.create',
  'students.edit',
  'students.delete',

  // Teacher & Staff Management
  'teachers.view',
  'teachers.create',
  'teachers.edit',

  // Attendance Management
  'attendance.view',
  'attendance.mark',

  // Classes & Curriculum
  'classes.view',
  'classes.manage',

  // Academic Units
  'units.view',
  'units.manage',

  // Examination & Assessment
  'exams.view',
  'exams.create',
  'exams.publish',
  'exams.grade',

  // Academic Results & Transcripts
  'results.view',
  'results.publish',

  // Fees & Billing
  'fees.view',
  'fees.collect',
  'fees.manage',

  // Payments & Financial Transactions
  'payments.view',
  'payments.refund',

  // Financial Reports & Analytics
  'finance.view',

  // General Reporting
  'reports.view',
  'reports.export',

  // Communication & Messaging
  'chat.view',
  'chat.send',
  'whatsapp.send',
  'notifications.manage',

  // Specialized Enterprise Modules
  'library.manage',
  'hostel.manage',
  'transport.manage',
  'inventory.manage',
  'hr.manage',

  // Administration & Tenant Settings
  'settings.manage',
  'erpnext.manage',
  'schools.manage',
  'users.manage',
  'roles.manage',
  'audit.view',
] as const;

export type Permission = typeof PERMISSIONS_LIST[number] | string;

export interface PermissionDefinition {
  id: string;
  name: string;
  category: 'Core' | 'Students' | 'Staff' | 'Academics' | 'Exams' | 'Finance' | 'Communication' | 'Modules' | 'System';
  description: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Core
  { id: 'dashboard.view', name: 'View Dashboard', category: 'Core', description: 'Access to system dashboard widgets and overview analytics' },
  
  // Students
  { id: 'students.view', name: 'View Students', category: 'Students', description: 'View student profiles, directories, and academic records' },
  { id: 'students.create', name: 'Create / Admit Students', category: 'Students', description: 'Perform student admissions and enrollments' },
  { id: 'students.edit', name: 'Edit Students', category: 'Students', description: 'Update student bio data, program details, and statuses' },
  { id: 'students.delete', name: 'Delete / Archive Students', category: 'Students', description: 'Remove or archive student records' },

  // Staff
  { id: 'teachers.view', name: 'View Teachers', category: 'Staff', description: 'View teaching staff directories and assignments' },
  { id: 'teachers.create', name: 'Add Teachers / Staff', category: 'Staff', description: 'Onboard new teaching staff and assign departments' },
  { id: 'teachers.edit', name: 'Edit Teachers / Staff', category: 'Staff', description: 'Modify staff profiles, ranks, and compensation info' },

  // Attendance
  { id: 'attendance.view', name: 'View Attendance', category: 'Academics', description: 'View daily and course-level attendance logs' },
  { id: 'attendance.mark', name: 'Mark Attendance', category: 'Academics', description: 'Record student attendance and check-in status' },

  // Departments, Classes & Units
  { id: 'departments.view', name: 'View Departments', category: 'Academics', description: 'View academic departments and course programs' },
  { id: 'departments.manage', name: 'Manage Departments', category: 'Academics', description: 'Create, edit, or delete academic departments and programs' },
  { id: 'classes.view', name: 'View Classes', category: 'Academics', description: 'View class rosters, rooms, and timetables' },
  { id: 'classes.manage', name: 'Manage Classes', category: 'Academics', description: 'Create, edit, or delete class groups and schedules' },
  { id: 'units.view', name: 'View Units / Subjects', category: 'Academics', description: 'View syllabus units and course catalog' },
  { id: 'units.manage', name: 'Manage Units', category: 'Academics', description: 'Create and assign academic units and subjects' },

  // Exams & Results
  { id: 'exams.view', name: 'View Exams', category: 'Exams', description: 'View examination schedules and papers' },
  { id: 'exams.create', name: 'Create Exams', category: 'Exams', description: 'Draft and schedule new examinations and quizzes' },
  { id: 'exams.publish', name: 'Publish Exams', category: 'Exams', description: 'Publish exams to student portals' },
  { id: 'exams.grade', name: 'Grade & Enter Marks', category: 'Exams', description: 'Enter student exam scores and grading registers' },
  { id: 'results.view', name: 'View Results', category: 'Exams', description: 'View student transcripts and performance reports' },
  { id: 'results.publish', name: 'Publish Results', category: 'Exams', description: 'Publish final grade sheets and transcripts' },

  // Finance & Fees
  { id: 'fees.view', name: 'View Fees', category: 'Finance', description: 'View fee structures, balances, and ledger history' },
  { id: 'fees.collect', name: 'Collect Fees', category: 'Finance', description: 'Process fee payments and issue official receipts' },
  { id: 'fees.manage', name: 'Manage Fee Structures', category: 'Finance', description: 'Configure tuition rates, discounts, and fee categories' },
  { id: 'payments.view', name: 'View Payments', category: 'Finance', description: 'View incoming transaction feeds and bank syncs' },
  { id: 'payments.refund', name: 'Process Refunds', category: 'Finance', description: 'Issue and authorize fee refunds' },
  { id: 'finance.view', name: 'View Financial Analytics', category: 'Finance', description: 'Access revenue charts, cashflow, and expense balances' },

  // Reports
  { id: 'reports.view', name: 'View System Reports', category: 'System', description: 'Access institutional compliance and summary reports' },
  { id: 'reports.export', name: 'Export Data & Reports', category: 'System', description: 'Export PDF and Excel reports' },

  // Communication
  { id: 'chat.view', name: 'Access Community Chat', category: 'Communication', description: 'Participate in group chats and channels' },
  { id: 'chat.send', name: 'Send Chat Messages', category: 'Communication', description: 'Post messages to community groups' },
  { id: 'whatsapp.send', name: 'Send WhatsApp Broadcasts', category: 'Communication', description: 'Trigger automated WhatsApp announcements' },
  { id: 'notifications.manage', name: 'Manage Push Notifications', category: 'Communication', description: 'Broadcast FCM push notifications to mobile/web' },

  // Specialized Modules
  { id: 'library.manage', name: 'Library Management', category: 'Modules', description: 'Manage book catalog, loans, and returns' },
  { id: 'hostel.manage', name: 'Hostel Management', category: 'Modules', description: 'Manage dormitories, bed allocations, and maintenance' },
  { id: 'transport.manage', name: 'Transport Management', category: 'Modules', description: 'Manage bus routes, drivers, and student pickups' },
  { id: 'inventory.manage', name: 'Inventory & Assets', category: 'Modules', description: 'Track school assets, supplies, and equipment' },
  { id: 'hr.manage', name: 'HR & Payroll Management', category: 'Modules', description: 'Manage staff contracts, payroll, leaves, and attendance' },

  // Administration
  { id: 'settings.manage', name: 'System Settings', category: 'System', description: 'Modify institutional parameters, branding, and academic terms' },
  { id: 'erpnext.manage', name: 'ERPNext Integration', category: 'System', description: 'Configure ERPNext API keys, sync schedules, and webhooks' },
  { id: 'schools.manage', name: 'Campus / Branches Management', category: 'System', description: 'Configure institution campuses and branches' },
  { id: 'users.manage', name: 'User Management', category: 'System', description: 'Create, deactivate, and manage user accounts and scopes' },
  { id: 'roles.manage', name: 'Role & Permission Matrix', category: 'System', description: 'Create and assign custom roles and security scopes' },
  { id: 'audit.view', name: 'View Security Audit Logs', category: 'System', description: 'Inspect system audit trails, logins, and security events' },
];

/**
 * Legacy permission alias map to support seamless backward compatibility.
 */
export const LEGACY_PERMISSION_ALIASES: Record<string, string[]> = {
  view_students: ['students.view'],
  student_admission: ['students.create'],
  manage_classes: ['classes.manage', 'classes.view'],
  manage_units: ['units.manage', 'units.view'],
  manage_exams: ['exams.create', 'exams.view', 'exams.grade'],
  mark_attendance: ['attendance.mark', 'attendance.view'],
  view_reports: ['reports.view'],
  manage_fees: ['fees.manage', 'fees.collect', 'fees.view'],
  view_finance: ['finance.view'],
  system_settings: ['settings.manage'],
  manage_timetable: ['classes.manage', 'classes.view'],
  manage_whatsapp: ['whatsapp.send'],
  manage_chat: ['chat.send', 'chat.view'],
  manage_marks: ['exams.grade'],
  view_results: ['results.view'],
};
