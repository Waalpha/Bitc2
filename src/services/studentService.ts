import { db, isFirebaseReady } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc } from 'firebase/firestore';
import { User, Student } from '../types';

/**
 * Converts a legacy merged User object (containing admission fields) into a clean Student entity.
 */
export function legacyUserToStudent(user: User): Student {
  const uid = user.uid || user.studentId || '';
  return {
    id: uid,
    userId: uid,
    schoolId: user.schoolId || 'bitc',
    admissionNumber: user.admissionNumber || user.studentId || `ADM-${uid.slice(0, 6).toUpperCase()}`,
    firstName: user.firstName || (user.name ? user.name.split(' ')[0] : 'Student'),
    lastName: user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : ''),
    gender: user.gender || '',
    dateOfBirth: user.dateOfBirth || '',
    email: user.email || '',
    phone: user.phone || user.emergencyPhone || '',
    photoUrl: user.photoUrl || '',
    religion: user.religion || '',
    caste: user.caste || '',
    bloodGroup: user.bloodGroup || '',
    address: user.address || user.guardianAddress || '',
    course: user.course || '',
    classId: (user.classIds && user.classIds.length > 0) ? user.classIds[0] : '',
    academicYear: user.academicYear || user.year || new Date().getFullYear().toString(),
    guardianId: user.guardianEmail || user.fatherPhone || user.motherPhone || '',
    status: user.disabled ? 'inactive' : 'active',
    createdAt: user.createdAt || new Date().toISOString()
  };
}

/**
 * Strips student-specific fields from a legacy User object to produce a sanitized Auth User.
 */
export function sanitizeAuthUser(user: User): User {
  return {
    uid: user.uid,
    name: user.name,
    email: user.email,
    role: user.role || 'student',
    schoolId: user.schoolId || 'bitc',
    phone: user.phone || '',
    photoUrl: user.photoUrl || '',
    createdAt: user.createdAt || new Date().toISOString(),
    disabled: !!user.disabled,
    classIds: user.classIds || []
  };
}

/**
 * Fetches a Student record along with their linked Auth User profile.
 * Falls back to extracting student fields from `users` if dedicated `students` record doesn't exist yet.
 */
export async function getStudentWithAuthUser(studentId: string): Promise<{ student: Student; user?: User } | null> {
  if (!isFirebaseReady) return null;

  try {
    // 1. Attempt lookup in dedicated 'students' collection
    const studentDocRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentDocRef);

    let studentData: Student | null = null;
    if (studentSnap.exists()) {
      studentData = { id: studentSnap.id, ...studentSnap.data() } as Student;
    }

    // 2. Fetch linked Auth User from 'users'
    const targetUserId = studentData?.userId || studentId;
    const userDocRef = doc(db, 'users', targetUserId);
    const userSnap = await getDoc(userDocRef);

    let userData: User | undefined = undefined;
    if (userSnap.exists()) {
      userData = { uid: userSnap.id, ...userSnap.data() } as User;
    }

    // 3. Fallback: If no dedicated student record exists, derive from legacy user
    if (!studentData && userData) {
      studentData = legacyUserToStudent(userData);
    }

    if (!studentData) return null;

    return {
      student: studentData,
      user: userData ? sanitizeAuthUser(userData) : undefined
    };
  } catch (err: any) {
    console.error(`[STUDENT SERVICE ERROR] Failed to fetch student ${studentId}:`, err);
    return null;
  }
}

/**
 * Queries students belonging to a specific school and optionally a specific class.
 */
export async function getSchoolStudents(schoolId: string, classId?: string): Promise<Student[]> {
  if (!isFirebaseReady) return [];

  try {
    const studentsRef = collection(db, 'students');
    let q = query(studentsRef, where('schoolId', '==', schoolId || 'bitc'));

    if (classId) {
      q = query(q, where('classId', '==', classId));
    }

    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
    }

    // Fallback query on legacy 'users' collection
    const usersRef = collection(db, 'users');
    let userQ = query(usersRef, where('schoolId', '==', schoolId || 'bitc'), where('role', '==', 'student'));
    if (classId) {
      userQ = query(userQ, where('classIds', 'array-contains', classId));
    }

    const userSnap = await getDocs(userQ);
    return userSnap.docs.map(doc => legacyUserToStudent({ uid: doc.id, ...doc.data() } as User));
  } catch (err: any) {
    console.error(`[STUDENT SERVICE ERROR] Failed to query school students:`, err);
    return [];
  }
}
