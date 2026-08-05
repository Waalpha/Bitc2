import admin from 'firebase-admin';

export interface DecoupleResult {
  collection: string;
  processed: number;
  created: number;
  skipped: number;
  errors: number;
}

/**
 * Migration script to decouple flat 'users' documents into dedicated
 * 'students' and 'parents' collections for clean multi-tenant domain separation.
 * 
 * - Preserves user account documents in 'users' for Firebase Auth mapping.
 * - Extracts student-specific profile data into the 'students' collection (doc ID = student profile ID or UID).
 * - Extracts parent-specific data into the 'parents' collection.
 * - Retains links via `userId` and `schoolId`.
 * - Executed idempotently.
 */
export async function decoupleStudentsAndParents(
  firestoreAdmin?: admin.firestore.Firestore,
  defaultSchoolId = "bitc"
): Promise<DecoupleResult[]> {
  const results: DecoupleResult[] = [
    { collection: 'students', processed: 0, created: 0, skipped: 0, errors: 0 },
    { collection: 'parents', processed: 0, created: 0, skipped: 0, errors: 0 }
  ];

  if (!firestoreAdmin) {
    console.log("[DECOUPLING MIGRATION] Firestore Admin SDK not active. Skipping execution.");
    return results;
  }

  console.log("[DECOUPLING MIGRATION] Starting extraction of students and parents...");

  try {
    // 1. Process Student Users
    const studentUsersSnap = await firestoreAdmin
      .collection('users')
      .where('role', '==', 'student')
      .get();

    results[0].processed = studentUsersSnap.size;

    if (!studentUsersSnap.empty) {
      let batch = firestoreAdmin.batch();
      let batchCount = 0;

      for (const userDoc of studentUsersSnap.docs) {
        const u = userDoc.data();
        const uid = userDoc.id;
        const schoolId = u.schoolId || defaultSchoolId;
        const studentDocRef = firestoreAdmin.collection('students').doc(uid);

        const existingStudentDoc = await studentDocRef.get();
        if (!existingStudentDoc.exists) {
          const studentPayload = {
            id: uid,
            userId: uid,
            schoolId: schoolId,
            admissionNumber: u.admissionNumber || u.studentId || `ADM-${uid.slice(0, 6).toUpperCase()}`,
            firstName: u.firstName || (u.name ? u.name.split(' ')[0] : 'Student'),
            lastName: u.lastName || (u.name ? u.name.split(' ').slice(1).join(' ') : ''),
            gender: u.gender || '',
            dateOfBirth: u.dateOfBirth || '',
            email: u.email || '',
            phone: u.phone || u.emergencyPhone || '',
            photoUrl: u.photoUrl || '',
            religion: u.religion || '',
            caste: u.caste || '',
            bloodGroup: u.bloodGroup || '',
            address: u.address || u.guardianAddress || '',
            course: u.course || '',
            classId: (u.classIds && u.classIds.length > 0) ? u.classIds[0] : '',
            academicYear: u.academicYear || u.year || new Date().getFullYear().toString(),
            guardianId: u.guardianEmail || u.fatherPhone || u.motherPhone || '',
            status: u.disabled ? 'inactive' : 'active',
            createdAt: u.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          batch.set(studentDocRef, studentPayload, { merge: true });
          results[0].created++;
          batchCount++;

          if (batchCount >= 400) {
            await batch.commit();
            batch = firestoreAdmin.batch();
            batchCount = 0;
          }
        } else {
          results[0].skipped++;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    }

    // 2. Process Parent Users
    const parentUsersSnap = await firestoreAdmin
      .collection('users')
      .where('role', '==', 'parent')
      .get();

    results[1].processed = parentUsersSnap.size;

    if (!parentUsersSnap.empty) {
      let batch = firestoreAdmin.batch();
      let batchCount = 0;

      for (const parentDoc of parentUsersSnap.docs) {
        const p = parentDoc.data();
        const uid = parentDoc.id;
        const schoolId = p.schoolId || defaultSchoolId;
        const parentDocRef = firestoreAdmin.collection('parents').doc(uid);

        const existingParentDoc = await parentDocRef.get();
        if (!existingParentDoc.exists) {
          const parentPayload = {
            id: uid,
            userId: uid,
            schoolId: schoolId,
            name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Parent',
            phone: p.phone || p.guardianPhone || p.fatherPhone || p.motherPhone || '',
            email: p.email || '',
            occupation: p.guardianOccupation || p.fatherOccupation || p.motherOccupation || '',
            address: p.address || p.guardianAddress || '',
            studentIds: p.studentIds || (p.studentId ? [p.studentId] : []),
            relation: p.guardianRelation || 'guardian',
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          batch.set(parentDocRef, parentPayload, { merge: true });
          results[1].created++;
          batchCount++;

          if (batchCount >= 400) {
            await batch.commit();
            batch = firestoreAdmin.batch();
            batchCount = 0;
          }
        } else {
          results[1].skipped++;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    }

    console.log("[DECOUPLING MIGRATION] Decoupling completed successfully:", results);
  } catch (err: any) {
    console.error("[DECOUPLING MIGRATION ERROR]:", err.message || err);
    results[0].errors++;
    results[1].errors++;
  }

  return results;
}
