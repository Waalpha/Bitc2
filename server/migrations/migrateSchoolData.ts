import admin from 'firebase-admin';

export interface MigrationResult {
  collection: string;
  total: number;
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * Migration script to add default schoolId ("bitc") to existing collections
 * for multi-tenant support without overwriting existing schoolId values.
 */
export async function migrateSchoolData(
  firestoreAdmin?: admin.firestore.Firestore,
  defaultSchoolId = "bitc"
): Promise<MigrationResult[]> {
  const collectionsToMigrate = [
    'users',
    'classes',
    'units',
    'fees',
    'feeConfigs',
    'exams',
    'submissions',
    'attendance',
    'notifications',
    'chat_rooms',
    'chat_messages',
    'expenses'
  ];

  const results: MigrationResult[] = [];
  console.log(`[MULTI-TENANT MIGRATION] Starting migration with default schoolId: "${defaultSchoolId}"...`);

  if (!firestoreAdmin) {
    console.log("[MULTI-TENANT MIGRATION] Firestore Admin SDK not active. Skipping remote migration.");
    return results;
  }

  // Ensure default school document exists
  try {
    const schoolRef = firestoreAdmin.collection('schools').doc(defaultSchoolId);
    const schoolSnap = await schoolRef.get();
    if (!schoolSnap.exists) {
      await schoolRef.set({
        id: defaultSchoolId,
        name: "Breakthrough International Training College",
        code: defaultSchoolId.toUpperCase(),
        logoUrl: "",
        contactInformation: {
          email: "info@bitc.ac.ke",
          phone: "+254700000000",
          address: "Nairobi, Kenya"
        },
        subscriptionPlan: "enterprise",
        activeStatus: true,
        createdAt: new Date().toISOString()
      });
      console.log(`[MULTI-TENANT MIGRATION] Provisioned default school document "${defaultSchoolId}".`);
    }
  } catch (err: any) {
    console.warn(`[MULTI-TENANT MIGRATION] Could not verify/create default school:`, err.message || err);
  }

  for (const colName of collectionsToMigrate) {
    let total = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    try {
      const snap = await firestoreAdmin.collection(colName).get();
      total = snap.size;

      if (!snap.empty) {
        let batch = firestoreAdmin.batch();
        let batchCount = 0;

        for (const doc of snap.docs) {
          const data = doc.data();
          if (!data || !data.schoolId) {
            batch.update(doc.ref, { 
              schoolId: defaultSchoolId,
              updatedAt: new Date().toISOString()
            });
            updated++;
            batchCount++;

            // Batch size cap (500 limit in Firestore)
            if (batchCount >= 400) {
              await batch.commit();
              batch = firestoreAdmin.batch();
              batchCount = 0;
            }
          } else {
            skipped++;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }
      }
      console.log(`[MULTI-TENANT MIGRATION] ${colName}: Total=${total}, Updated=${updated}, Skipped=${skipped}, Errors=${errors}`);
    } catch (err: any) {
      console.error(`[MULTI-TENANT MIGRATION ERROR] Collection "${colName}":`, err.message || err);
      errors++;
    }

    results.push({ collection: colName, total, updated, skipped, errors });
  }

  console.log("[MULTI-TENANT MIGRATION] Migration complete.");
  return results;
}
