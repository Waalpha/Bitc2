import fs from "fs";
import path from "path";
import zlib from "zlib";
import admin from "firebase-admin";
import { v2 as cloudinary } from "cloudinary";
import nodemailer from "nodemailer";

const COLLECTIONS_TO_BACKUP = [
  'users', 'classes', 'attendance', 'fees', 'feeConfigs', 
  'timetable', 'exams', 'exam_results', 'marks', 'chats', 
  'notifications', 'fee_balances', 'units', 'settings'
];

function getStorageBucketName(): string | undefined {
  if (process.env.VITE_FIREBASE_STORAGE_BUCKET) {
    return process.env.VITE_FIREBASE_STORAGE_BUCKET;
  }
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.storageBucket || config.storage_bucket;
    } catch {
      // ignore
    }
  }
  return undefined;
}

async function sendFailureEmail(errorMessage: string, errorStack?: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "backup-system@school.com";
  const to = process.env.BACKUP_NOTIFICATION_EMAIL;

  if (!to) {
    console.warn("[BACKUP_EMAIL] BACKUP_NOTIFICATION_EMAIL not configured. Cannot send failure email.");
    return;
  }

  if (!host || !user || !pass) {
    console.warn("[BACKUP_EMAIL] SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) not fully configured. Cannot send real email.");
    console.log(`[BACKUP_EMAIL_SIMULATION] Sending backup failure email to ${to}: ${errorMessage}`);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    await transporter.sendMail({
      from,
      to,
      subject: `⚠️ Backup Failure Alert - ${new Date().toLocaleDateString()}`,
      text: `Daily backup failed on ${new Date().toISOString()}.\n\nError: ${errorMessage}\n\nStack:\n${errorStack || 'N/A'}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e11d48; border-radius: 8px; max-width: 600px; margin: auto;">
          <h2 style="color: #e11d48; margin-top: 0;">⚠️ Daily Backup Failed</h2>
          <p>The daily automatic backup failed at <strong>${new Date().toLocaleString()}</strong>.</p>
          <div style="background-color: #fef2f2; border-left: 4px solid #e11d48; padding: 15px; margin: 20px 0; font-family: monospace; font-size: 14px; white-space: pre-wrap; word-break: break-all;">
            <strong>Error:</strong> ${errorMessage}
          </div>
          <p style="font-size: 12px; color: #64748b;">Please check the server logs for more details. This is an automated system notification.</p>
        </div>
      `
    });
    console.log(`[BACKUP_EMAIL] Failure email sent successfully to ${to}`);
  } catch (emailErr) {
    console.error("[BACKUP_EMAIL] Failed to send backup failure email:", emailErr);
  }
}

export async function runBackup(): Promise<{ success: boolean; filename?: string; error?: string }> {
  console.log("[BACKUP] Starting automated system backup...");
  const timestamp = new Date();
  // Format: backup_YYYY-MM-DD_HH-mm-ss
  const formattedDate = timestamp.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
  const filename = `backup_${formattedDate}.json.gz`;

  try {
    // 1. Export Firestore Data
    const firestoreData: any = {};
    let isRemoteActive = false;

    // Check if firebase admin is initialized and has a firestore instance
    try {
      if (admin.apps.length > 0) {
        const firestoreAdmin = admin.firestore();
        console.log("[BACKUP] Extracting real-time Firestore collections...");
        for (const colName of COLLECTIONS_TO_BACKUP) {
          const snap = await firestoreAdmin.collection(colName).get();
          const colData: any = {};
          if (!snap.empty) {
            snap.docs.forEach(doc => {
              colData[doc.id] = doc.data();
            });
            isRemoteActive = true;
          }
          firestoreData[colName] = colData;
        }
        console.log("[BACKUP] Remote Firestore collections exported.");
      }
    } catch (fsErr: any) {
      console.warn("[BACKUP] Could not query remote Firestore. Status:", fsErr?.message || fsErr);
    }

    // Fallback to local files if remote is empty or failed
    if (!isRemoteActive) {
      console.log("[BACKUP] Sourcing backup data from local offline files fallback...");
      for (const colName of COLLECTIONS_TO_BACKUP) {
        const localPath = path.join(process.cwd(), 'data', `${colName}.json`);
        if (fs.existsSync(localPath)) {
          try {
            firestoreData[colName] = JSON.parse(fs.readFileSync(localPath, 'utf8'));
          } catch (err) {
            firestoreData[colName] = {};
          }
        } else {
          firestoreData[colName] = {};
        }
      }
    }

    // 2. Backup Cloudinary Metadata
    let cloudinaryMetadata: any[] = [];
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        console.log("[BACKUP] Fetching Cloudinary resource metadata...");
        // Configure Cloudinary explicitly
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        const res = await cloudinary.api.resources({ max_results: 500, type: 'upload' });
        cloudinaryMetadata = res.resources || [];
        console.log(`[BACKUP] Cloudinary metadata fetched. Found ${cloudinaryMetadata.length} resources.`);
      } catch (cloudErr: any) {
        console.warn("[BACKUP] Cloudinary API metadata check warning:", cloudErr?.message || cloudErr);
      }
    } else {
      console.log("[BACKUP] Cloudinary credentials not configured. Skipping Cloudinary metadata API fetch.");
    }

    // 3. Construct Complete Backup Object & Compress
    let docCount = 0;
    for (const colName of Object.keys(firestoreData)) {
      if (firestoreData[colName]) {
        docCount += Object.keys(firestoreData[colName]).length;
      }
    }

    const backupId = `backup_${formattedDate}`;
    const backupData = {
      id: backupId,
      name: `Automated Daily Backup (${formattedDate.split('_')[0]})`,
      notes: "Auto-generated daily system backup (stored in Cloud Storage & local storage with Cloudinary metadata)",
      timestamp: timestamp.toISOString(),
      docCount,
      collections: firestoreData,
      firestore: firestoreData,
      cloudinary: cloudinaryMetadata
    };

    console.log("[BACKUP] Compressing backup contents with gzip...");
    const jsonStr = JSON.stringify(backupData);
    const compressedBuffer = zlib.gzipSync(Buffer.from(jsonStr));
    console.log(`[BACKUP] Compression complete. Original size: ${(jsonStr.length / 1024).toFixed(2)} KB, Compressed: ${(compressedBuffer.length / 1024).toFixed(2)} KB`);

    // 4. Save to Local Backup Directory (Secondary Secure Storage)
    const backupsDir = path.join(process.cwd(), 'data_backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const localFilePath = path.join(backupsDir, filename);
    fs.writeFileSync(localFilePath, compressedBuffer);
    console.log(`[BACKUP] Saved backup locally to ${localFilePath}`);

    // 5. Upload to Cloud Storage (Primary Secure Storage)
    let cloudSaved = false;
    try {
      if (admin.apps.length > 0) {
        const bucketName = getStorageBucketName();
        const bucket = bucketName ? admin.storage().bucket(bucketName) : admin.storage().bucket();
        
        if (bucket) {
          console.log(`[BACKUP] Uploading backup to Cloud Storage bucket: ${bucket.name || 'default'}...`);
          const file = bucket.file(`backups/${filename}`);
          await file.save(compressedBuffer, {
            metadata: {
              contentType: 'application/gzip',
              metadata: {
                timestamp: timestamp.toISOString(),
                originalSize: jsonStr.length.toString(),
                compressedSize: compressedBuffer.length.toString()
              }
            }
          });
          cloudSaved = true;
          console.log(`[BACKUP] Successfully uploaded to Cloud Storage as backups/${filename}`);
        }
      }
    } catch (storageErr: any) {
      console.warn("[BACKUP] Firebase Cloud Storage upload skipped or failed:", storageErr?.message || storageErr);
    }

    // 6. Prune Old Backups (Keep only the last 30 daily backups)
    // Local Pruning
    try {
      const localFiles = fs.readdirSync(backupsDir)
        .filter(f => f.startsWith('backup_') && f.endsWith('.json.gz'))
        .sort(); // Sorts oldest to newest since dates are formatted alphabetically chronological

      if (localFiles.length > 30) {
        const filesToDelete = localFiles.slice(0, localFiles.length - 30);
        console.log(`[BACKUP] Local backup threshold exceeded (${localFiles.length}/30). Pruning ${filesToDelete.length} old backups...`);
        for (const fileToDelete of filesToDelete) {
          fs.unlinkSync(path.join(backupsDir, fileToDelete));
          console.log(`[BACKUP] Deleted local old backup: ${fileToDelete}`);
        }
      }
    } catch (pruneErr: any) {
      console.warn("[BACKUP] Local backup pruning failed:", pruneErr?.message || pruneErr);
    }

    // Cloud Pruning
    if (cloudSaved) {
      try {
        const bucketName = getStorageBucketName();
        const bucket = bucketName ? admin.storage().bucket(bucketName) : admin.storage().bucket();
        
        if (bucket) {
          const [files] = await bucket.getFiles({ prefix: 'backups/' });
          const backupFiles = files
            .filter(f => f.name.startsWith('backups/backup_') && f.name.endsWith('.json.gz'))
            .sort((a, b) => a.name.localeCompare(b.name));

          if (backupFiles.length > 30) {
            const filesToDelete = backupFiles.slice(0, backupFiles.length - 30);
            console.log(`[BACKUP] Cloud backup threshold exceeded (${backupFiles.length}/30). Pruning ${filesToDelete.length} old backups...`);
            for (const fileToDelete of filesToDelete) {
              await fileToDelete.delete();
              console.log(`[BACKUP] Deleted Cloud Storage old backup: ${fileToDelete.name}`);
            }
          }
        }
      } catch (cloudPruneErr: any) {
        console.warn("[BACKUP] Cloud Storage backup pruning failed:", cloudPruneErr?.message || cloudPruneErr);
      }
    }

    console.log("[BACKUP] Automated daily backup complete successfully!");
    return { success: true, filename };

  } catch (err: any) {
    const errMsg = err?.message || String(err);
    const errStack = err?.stack;
    console.error("[BACKUP] CRITICAL FAILURE:", errMsg);
    
    // Trigger failure email notification
    await sendFailureEmail(errMsg, errStack);

    return { success: false, error: errMsg };
  }
}
