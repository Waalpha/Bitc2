import fs from 'fs';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function writeIfEmpty(collectionName: string, data: Record<string, any>) {
  ensureDir();
  const filePath = path.join(DB_DIR, `${collectionName}.json`);
  let shouldWrite = false;
  
  if (!fs.existsSync(filePath)) {
    shouldWrite = true;
  } else {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Object.keys(parsed).length === 0) {
        shouldWrite = true;
      }
    } catch {
      shouldWrite = true;
    }
  }

  if (shouldWrite) {
    console.log(`[SEEDER] Seeding collection: ${collectionName}`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

export function seedDatabase() {
  console.log('[SEEDER] Checking database status for auto-seeding...');

  // 1. Classes
  writeIfEmpty('classes', {
    "class_cs101": {
      "name": "Computer Science 101",
      "teacherId": "tech_prof_jones",
      "unitIds": ["unit_programming", "unit_db", "unit_algorithms"],
      "startTime": "08:30",
      "endTime": "16:30",
      "latitude": -1.2921,
      "longitude": 36.8219,
      "radius": 150
    },
    "class_ee201": {
      "name": "Electrical Engineering",
      "teacherId": "tech_dr_smith",
      "unitIds": ["unit_circuits"],
      "startTime": "09:00",
      "endTime": "17:00",
      "latitude": -1.2925,
      "longitude": 36.8225,
      "radius": 150
    },
    "class_it302": {
      "name": "Information Technology",
      "teacherId": "tech_dr_smith",
      "unitIds": ["unit_networks"],
      "startTime": "08:00",
      "endTime": "16:00",
      "latitude": -1.2915,
      "longitude": 36.8210,
      "radius": 150
    }
  });

  // 2. Units
  writeIfEmpty('units', {
    "unit_programming": {
      "name": "Introduction to Programming",
      "classId": "class_cs101",
      "status": "active"
    },
    "unit_db": {
      "name": "Database Systems",
      "classId": "class_cs101",
      "status": "active"
    },
    "unit_algorithms": {
      "name": "Algorithms & Data Structures",
      "classId": "class_cs101",
      "status": "active"
    },
    "unit_circuits": {
      "name": "Circuit Analysis",
      "classId": "class_ee201",
      "status": "active"
    },
    "unit_networks": {
      "name": "Network Security",
      "classId": "class_it302",
      "status": "active"
    }
  });

  // 3. Timetable
  writeIfEmpty('timetable', {
    "slot_1": {
      "classId": "class_cs101",
      "day": "Monday",
      "unitId": "unit_programming",
      "teacherId": "tech_prof_jones",
      "teacherName": "Prof. Jones",
      "unitName": "Introduction to Programming",
      "startTime": "08:30",
      "endTime": "10:30",
      "room": "Lab 1",
      "color": "#3b82f6"
    },
    "slot_2": {
      "classId": "class_cs101",
      "day": "Wednesday",
      "unitId": "unit_db",
      "teacherId": "tech_prof_jones",
      "teacherName": "Prof. Jones",
      "unitName": "Database Systems",
      "startTime": "11:00",
      "endTime": "13:00",
      "room": "Room 204",
      "color": "#10b981"
    },
    "slot_3": {
      "classId": "class_cs101",
      "day": "Friday",
      "unitId": "unit_algorithms",
      "teacherId": "tech_prof_jones",
      "teacherName": "Prof. Jones",
      "unitName": "Algorithms & Data Structures",
      "startTime": "14:00",
      "endTime": "16:00",
      "room": "Main Hall",
      "color": "#f59e0b"
    },
    "slot_4": {
      "classId": "class_ee201",
      "day": "Tuesday",
      "unitId": "unit_circuits",
      "teacherId": "tech_dr_smith",
      "teacherName": "Dr. Smith",
      "unitName": "Circuit Analysis",
      "startTime": "09:00",
      "endTime": "11:00",
      "room": "EE Lab",
      "color": "#8b5cf6"
    },
    "slot_5": {
      "classId": "class_it302",
      "day": "Thursday",
      "unitId": "unit_networks",
      "teacherId": "tech_dr_smith",
      "teacherName": "Dr. Smith",
      "unitName": "Network Security",
      "startTime": "10:00",
      "endTime": "12:00",
      "room": "Security Lab",
      "color": "#ec4899"
    }
  });

  // 4. Settings
  writeIfEmpty('settings', {
    "global": {
      "appTitle": "BITC Academy",
      "schoolName": "Buruburu Institute of Fine Arts & Technology",
      "activeSession": "2025/2026 Semester 1",
      "fontFamily": "Inter",
      "fontSize": "16px",
      "textAlign": "left",
      "isSchoolClosed": false,
      "schoolClosedReason": "",
      "denyAccessOnBalance": false,
      "sessionTimeoutSeconds": 3600,
      "publicAddress": "Buruburu, Mumias Road, Nairobi",
      "publicPhone": "+254 712 345678",
      "publicEmail": "info@bitc.ac.ke",
      "publicHeroTitle": "Transforming Education with Technology",
      "publicHeroDescription": "Welcome to BITC's modern digital learning experience portal.",
      "publicHeroImageUrl": "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1200"
    },
    "hero_legacy": {
      "images": [
        "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1200",
        "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200"
      ]
    },
    "gallery": {
      "images": [
        "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=400",
        "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=400",
        "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=400"
      ]
    }
  });

  // 5. Users
  ensureDir();
  const usersPath = path.join(DB_DIR, 'users.json');
  let users: Record<string, any> = {};
  if (fs.existsSync(usersPath)) {
    try {
      users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    } catch {
      users = {};
    }
  }

  const defaultAccounts: Record<string, any> = {
    "tech_prof_jones": {
      "name": "Prof. Alan Jones",
      "email": "teacher1@school.com",
      "role": "teacher",
      "classIds": ["class_cs101"],
      "createdAt": "2026-05-28T12:00:00.000Z"
    },
    "tech_dr_smith": {
      "name": "Dr. Sarah Smith",
      "email": "teacher2@school.com",
      "role": "teacher",
      "classIds": ["class_ee201", "class_it302"],
      "createdAt": "2026-05-28T12:00:00.000Z"
    },
    "std_john_doe": {
      "name": "John Doe",
      "email": "student1@school.com",
      "role": "student",
      "classIds": ["class_cs101"],
      "admissionNumber": "ADM/2026/001",
      "course": "Computer Science",
      "academicYear": "2026",
      "gender": "Male",
      "phone": "+254 700 111222",
      "address": "Nairobi, Westlands",
      "createdAt": "2026-05-28T12:00:00.000Z"
    },
    "std_jane_smith": {
      "name": "Jane Smith",
      "email": "student2@school.com",
      "role": "student",
      "classIds": ["class_cs101"],
      "admissionNumber": "ADM/2026/002",
      "course": "Computer Science",
      "academicYear": "2026",
      "gender": "Female",
      "phone": "+254 700 333444",
      "address": "Nairobi, Buruburu",
      "createdAt": "2026-05-28T12:00:00.000Z"
    },
    "std_alice_williams": {
      "name": "Alice Williams",
      "email": "student3@school.com",
      "role": "student",
      "classIds": ["class_ee201"],
      "admissionNumber": "ADM/2026/003",
      "course": "Electrical Engineering",
      "academicYear": "2026",
      "gender": "Female",
      "phone": "+254 700 555666",
      "createdAt": "2026-05-28T12:00:00.000Z"
    },
    "std_bob_brown": {
      "name": "Bob Brown",
      "email": "student4@school.com",
      "role": "student",
      "classIds": ["class_it302"],
      "admissionNumber": "ADM/2026/004",
      "course": "Information Technology",
      "academicYear": "2026",
      "gender": "Male",
      "phone": "+254 700 777888",
      "createdAt": "2026-05-28T12:00:00.000Z"
    }
  };

  let usersUpdated = false;
  for (const [uid, udata] of Object.entries(defaultAccounts)) {
    if (!users[uid]) {
      users[uid] = udata;
      usersUpdated = true;
    }
  }

  if (usersUpdated) {
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
    console.log('[SEEDER] Seeded default user roles');
  }

  // 6. Fee Configs
  writeIfEmpty('feeConfigs', {
    "fee_tuition_cs101": {
      "classId": "class_cs101",
      "title": "Semester 1 Tuition Fee",
      "amount": 1500,
      "period": "semester",
      "createdAt": "2026-05-28T12:00:00.000Z"
    },
    "fee_tuition_ee201": {
      "classId": "class_ee201",
      "title": "Semester 1 Tuition Fee",
      "amount": 1800,
      "period": "semester",
      "createdAt": "2026-05-28T12:00:00.000Z"
    },
    "fee_exam_all": {
      "classId": "class_cs101",
      "title": "External Examination Board Fee",
      "amount": 250,
      "period": "semester",
      "createdAt": "2026-05-28T12:00:00.000Z"
    }
  });

  // 7. Fee Balances
  writeIfEmpty('fee_balances', {
    "bal_std_john_doe": {
      "studentId": "std_john_doe",
      "totalAmount": 1750,
      "paidAmount": 1200,
      "balance": 550,
      "lastUpdated": "2026-05-28T12:00:00.000Z",
      "history": [
        {
          "date": "2026-05-28T10:00:00.000Z",
          "amount": 1200,
          "type": "payment",
          "description": "Initial Semester Payment"
        },
        {
          "date": "2026-05-28T09:00:00.000Z",
          "amount": 1500,
          "type": "charge",
          "description": "Semester 1 Tuition Fee"
        },
        {
          "date": "2026-05-28T09:05:00.000Z",
          "amount": 250,
          "type": "charge",
          "description": "External Examination Board Fee"
        }
      ]
    },
    "bal_std_jane_smith": {
      "studentId": "std_jane_smith",
      "totalAmount": 1750,
      "paidAmount": 1750,
      "balance": 0,
      "lastUpdated": "2026-05-28T12:05:00.000Z",
      "history": [
        {
          "date": "2026-05-28T10:30:00.000Z",
          "amount": 1750,
          "type": "payment",
          "description": "Full Fee Payment with Bank Slip"
        },
        {
          "date": "2026-05-28T09:00:00.000Z",
          "amount": 1750,
          "type": "charge",
          "description": "Semester 1 Tuition & Board Fees"
        }
      ]
    },
    "bal_std_alice_williams": {
      "studentId": "std_alice_williams",
      "totalAmount": 1800,
      "paidAmount": 800,
      "balance": 1000,
      "lastUpdated": "2026-05-28T12:10:00.000Z",
      "history": [
        {
          "date": "2026-05-28T11:00:00.000Z",
          "amount": 800,
          "type": "payment",
          "description": "Part payment"
        },
        {
          "date": "2026-05-28T09:00:00.000Z",
          "amount": 1800,
          "type": "charge",
          "description": "Semester 1 Tuition Fee"
        }
      ]
    }
  });

  // 8. Exams
  writeIfEmpty('exams', {
    "exam_programming_1": {
      "title": "Programming Midterm Assignment",
      "type": "Assignment",
      "unitId": "unit_programming",
      "classId": "class_cs101",
      "teacherId": "tech_prof_jones",
      "questions": [
        {
          "id": "q1",
          "text": "What does CSS stand for in web development?",
          "type": "multiple-choice",
          "options": [
            "Computer Style Sheets",
            "Cascading Style Sheets",
            "Creative Style Sheets",
            "Colorful Style Sheets"
          ],
          "correctAnswer": "Cascading Style Sheets"
        },
        {
          "id": "q2",
          "text": "Which tag is used to create a hyperlink in HTML?",
          "type": "multiple-choice",
          "options": ["<link>", "<a>", "<hyper>", "<href>"],
          "correctAnswer": "<a>"
        },
        {
          "id": "q3",
          "text": "Briefly explain the difference between 'let' and 'const' in TypeScript.",
          "type": "text"
        }
      ],
      "published": true,
      "isOffline": false,
      "dueDate": "2026-06-15T23:59:59.000Z",
      "examDate": "2026-06-15",
      "maxMarks": 40,
      "passingMarks": 20,
      "duration": 65,
      "createdAt": "2026-05-28T12:00:00.000Z"
    },
    "exam_db_1": {
      "title": "Introduction to Database Systems Quiz",
      "type": "Quiz",
      "unitId": "unit_db",
      "classId": "class_cs101",
      "teacherId": "tech_prof_jones",
      "questions": [
        {
          "id": "q11",
          "text": "What does SQL stand for?",
          "type": "multiple-choice",
          "options": [
            "Structured Query Language",
            "Standard Query Language",
            "Server Query Language",
            "Simple Query Language"
          ],
          "correctAnswer": "Structured Query Language"
        },
        {
          "id": "q12",
          "text": "Which SQL statement is used to remove lines from a table?",
          "type": "multiple-choice",
          "options": ["REMOVE", "DELETE", "DROP", "TRUNCATE"],
          "correctAnswer": "DELETE"
        }
      ],
      "published": true,
      "isOffline": false,
      "dueDate": "2026-06-10T12:00:00.000Z",
      "examDate": "2026-06-10",
      "maxMarks": 20,
      "passingMarks": 10,
      "duration": 30,
      "createdAt": "2026-05-28T12:00:00.000Z"
    }
  });

  // 9. Exam Results & Marks
  writeIfEmpty('marks', {
    "mark_1": {
      "classId": "class_cs101",
      "unitId": "unit_programming",
      "studentId": "std_john_doe",
      "marksObtained": 35,
      "maxMarks": 40,
      "examType": "Assignment",
      "remarks": "Excellent programming approach",
      "markedBy": "tech_prof_jones",
      "date": "2026-05-28T14:00:00.000Z"
    },
    "mark_2": {
      "classId": "class_cs101",
      "unitId": "unit_programming",
      "studentId": "std_jane_smith",
      "marksObtained": 38,
      "maxMarks": 40,
      "examType": "Assignment",
      "remarks": "Perfect solution architecture",
      "markedBy": "tech_prof_jones",
      "date": "2026-05-28T14:00:00.000Z"
    }
  });

  // 10. Attendance logs
  writeIfEmpty('attendance', {
    "att_2026_05_28": {
      "classId": "class_cs101",
      "date": "2026-05-28",
      "records": {
        "std_john_doe": "present",
        "std_jane_smith": "present"
      },
      "biometricLogs": {
        "std_john_doe": {
          "checkIn": {
            "time": "2026-05-28T08:14:22.000Z",
            "method": "qr"
          }
        },
        "std_jane_smith": {
          "checkIn": {
            "time": "2026-05-28T08:21:44.000Z",
            "method": "biometric"
          }
        }
      }
    }
  });

  console.log('[SEEDER] Database auto-seeding review completed successfully.');
}
