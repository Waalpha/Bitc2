export const ROUTES = {
  PUBLIC: {
    HOME: '/',
    AUTH: '/auth',
    STUDENT_VERIFY: '/student/verify/*',
    CERTIFICATE_VERIFY: '/verify/certificate/*',
  },
  DASHBOARD: '/dashboard',
  STUDENTS: {
    LIST: '/students',
    ADMISSION: '/students/admission',
    CATEGORIES: '/students/categories',
  },
  ACADEMICS: {
    CLASSES: '/classes',
    UNITS: '/units',
    MY_UNITS: '/my-units',
    TIMETABLE: '/timetable',
    TRANSCRIPTS: '/transcripts',
  },
  EXAMS: {
    LIST: '/exams',
    ATTENDANCE: '/exams/attendance',
    MARKS: '/marks',
    RESULTS: '/results',
  },
  FINANCE: {
    FEES: '/fees',
  },
  ADMIN: {
    SETTINGS: '/admin',
    HR: '/hr',
  },
  COMMUNICATION: {
    WHATSAPP: '/whatsapp',
    CHAT: '/chat',
  },
  PROFILE: '/profile',
} as const;
