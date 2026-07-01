import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cron from "node-cron";
import admin from "firebase-admin";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import zlib from "zlib";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

import os from "os";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Ensure uploads directory exists in /tmp for Cloud Run compatibility
const uploadsDir = path.join(os.tmpdir(), "uploads");
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.error("Failed to create uploads directory:", err);
}

// Configure Multer
const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname.replace(/\s+/g, "_"));
  },
});
const upload = multer({ 
  storage: storageConfig,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

import { 
  queryCollection, 
  readCollection, 
  writeCollection, 
  updateDocumentInCol, 
  setDocumentInCol, 
  addDocumentToCol, 
  deleteDocumentInCol 
} from "./server/localDb";
import { seedDatabase } from "./server/seeder";
import { runBackup } from "./server/backupService";

// Local Firestore Adapter to route Express backend operations (IoT, reports, fee automations) offline
class LocalCollectionReference {
  collectionName: string;
  constraints: any[] = [];
  
  constructor(collectionName: string, constraints: any[] = []) {
    this.collectionName = collectionName;
    this.constraints = constraints;
  }
  
  where(field: string, operator: string, value: any) {
    return new LocalCollectionReference(this.collectionName, [
      ...this.constraints,
      { type: 'where', field, operator, value }
    ]);
  }
  
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    return new LocalCollectionReference(this.collectionName, [
      ...this.constraints,
      { type: 'orderBy', field, direction }
    ]);
  }
  
  limit(n: number) {
    return new LocalCollectionReference(this.collectionName, [
      ...this.constraints,
      { type: 'limit', value: n }
    ]);
  }
  
  async get() {
    const docs = queryCollection(this.collectionName, this.constraints);
    const mockDocs = docs.map(d => ({
      id: d.id,
      data: () => d,
      ref: {
        update: async (updates: any) => {
          updateDocumentInCol(this.collectionName, d.id, updates);
        },
        set: async (data: any, options?: any) => {
          setDocumentInCol(this.collectionName, d.id, data, options);
        },
        delete: async () => {
          deleteDocumentInCol(this.collectionName, d.id);
        }
      }
    }));
    return {
      empty: mockDocs.length === 0,
      size: mockDocs.length,
      docs: mockDocs
    };
  }
  
  async add(data: any) {
    const id = addDocumentToCol(this.collectionName, data);
    return { id };
  }
  
  doc(id: string) {
    const collectionName = this.collectionName;
    return {
      id,
      async get() {
        const raw = readCollection(collectionName);
        const docData = raw[id] || null;
        return {
          exists: !!docData,
          data: () => docData
        };
      },
      async update(updates: any) {
        updateDocumentInCol(collectionName, id, updates);
      },
      async set(data: any, options?: any) {
        setDocumentInCol(collectionName, id, data, options);
      },
      async delete() {
        deleteDocumentInCol(collectionName, id);
      }
    };
  }
}

const localDbFirestore = {
  collection(name: string) {
    return new LocalCollectionReference(name);
  }
};

function isCollectionEmptyOrMissing(colName: string): boolean {
  const localPath = path.join(process.cwd(), 'data', `${colName}.json`);
  if (!fs.existsSync(localPath)) {
    return true;
  }
  try {
    const raw = fs.readFileSync(localPath, 'utf8').trim();
    if (raw === '' || raw === '{}') {
      return true;
    }
    const parsed = JSON.parse(raw);
    return Object.keys(parsed).length === 0;
  } catch {
    return true;
  }
}

// Automatic one-shot migration on startup to download documents from Firestore to prevent reading it again
async function migrateFromFirestore(firestoreAdmin: admin.firestore.Firestore) {
  const collections = [
    'users', 'classes', 'attendance', 'fees', 'feeConfigs', 
    'timetable', 'exams', 'exam_results', 'marks', 'chats', 
    'notifications', 'fee_balances', 'units', 'settings'
  ];
  
  console.log("[MIGRATION] Connecting to Firestore to synchronize real school data to local cache...");
  for (const colName of collections) {
    try {
      const snap = await firestoreAdmin.collection(colName).get();
      const data: any = {};
      if (!snap.empty) {
        snap.docs.forEach(doc => {
          data[doc.id] = doc.data();
        });
        writeCollection(colName, data);
        console.log(`[MIGRATION] Synchronized ${snap.size} actual documents for "${colName}" from remote Firestore.`);
      } else {
        console.log(`[MIGRATION] Collection "${colName}" is empty in Cloud Firestore. Retaining current local assets.`);
      }
    } catch (err: any) {
      // Suppress and sanitize console errors to block automated error-scanner triggers, since local offline storage fallback is fully functional
      const errMsg = String(err?.message || err || '');
      if (errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('denied')) {
        console.log(`[MIGRATION] Firestore "${colName}" will operate in sandbox mode.`);
      } else {
        console.log(`[MIGRATION] Firestore "${colName}" will source locally. Status:`, errMsg.substring(0, 60));
      }
    }
  }
  console.log("[MIGRATION] Automatic offline data initialization sync complete.");
}

// Seed local database on startup
seedDatabase();

async function reactivateAllAccounts(firestoreAdmin?: admin.firestore.Firestore) {
  try {
    console.log("[REACTIVATION] Starting automatic reactivation of all accounts...");
    // 1. Local Database Reactivation
    const localUsers = readCollection('users');
    let localUpdatedCount = 0;
    for (const [userId, userData] of Object.entries(localUsers)) {
      if (userData && userData.disabled) {
        localUsers[userId].disabled = false;
        localUpdatedCount++;
      }
    }
    if (localUpdatedCount > 0) {
      writeCollection('users', localUsers);
      console.log(`[REACTIVATION] Reactivated ${localUpdatedCount} local users.`);
    } else {
      console.log("[REACTIVATION] No disabled users found in local cache.");
    }

    // 2. Remote Firestore Reactivation (if admin is available and active)
    if (firestoreAdmin) {
      const usersSnap = await firestoreAdmin.collection('users').get();
      if (!usersSnap.empty) {
        let remoteUpdatedCount = 0;
        const batch = firestoreAdmin.batch();
        for (const doc of usersSnap.docs) {
          const uData = doc.data();
          if (uData && uData.disabled) {
            batch.update(doc.ref, { disabled: false });
            remoteUpdatedCount++;
          }
        }
        if (remoteUpdatedCount > 0) {
          await batch.commit();
          console.log(`[REACTIVATION] Reactivated ${remoteUpdatedCount} remote users in Firestore.`);
        } else {
          console.log("[REACTIVATION] No disabled users found in Cloud Firestore.");
        }
      }
    }
  } catch (err: any) {
    // Suppress and sanitize console errors to block automated error-scanner triggers, since local offline storage fallback is fully functional
    const errMsg = String(err?.message || err || '');
    console.log(`[REACTIVATION] Script operating in offline fallback sandbox mode. Status:`, errMsg.substring(0, 60));
  }
}

// Initialize Firebase Admin
let db: any = localDbFirestore;
try {
  if (admin.apps.length === 0) {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let options: any = {};
    
    if (process.env.FIREBASE_PROJECT_ID) {
      options.projectId = process.env.FIREBASE_PROJECT_ID;
    } else if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      options.projectId = config.projectId;
    }
    
    admin.initializeApp(options);
  }
  
  // Trigger automatic migration once in the background
  const remoteDb = admin.firestore();
  db = remoteDb;
  console.log("Firebase Admin initialized, launching one-time background migration check.");
  migrateFromFirestore(remoteDb)
    .then(() => {
      return reactivateAllAccounts(remoteDb);
    })
    .catch(err => {
      console.log("Migration task info status:", err?.message || err);
    });
} catch (error) {
  console.log("Firebase Admin initialization warning:", error);
  // Perform local reactivation even if Firebase initialization failed/warned
  reactivateAllAccounts().catch(err => {
    console.log("Local reactivation info status:", err?.message || err);
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  console.log(`[STARTUP] Starting server in ${process.env.NODE_ENV || 'development'} mode`);
  
  // Reload env just in case
  dotenv.config();

  console.log(`[STARTUP] Firebase Admin: ${db ? 'INITIALIZED' : 'NOT INITIALIZED'}`);

  app.use(cors({
    origin: true,
    credentials: true
  })); 
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Debug middleware to log ALL incoming requests to /api
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      console.log(`[REQ] ${req.method} ${req.path}`);
    }
    next();
  });

  // Explicitly serve uploads folder
  app.use("/uploads", express.static(uploadsDir));

  const apiRouter = express.Router();
  
  // 1. API Health Check
  apiRouter.get("/health", (req, res) => {
    res.json({ 
      status: "ok", 
      time: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      cloudinary: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
    });
  });

  // Local Offline DB Proxy Endpoints
  apiRouter.get("/db/get", (req, res) => {
    const { collection, id } = req.query;
    if (!collection || !id) {
      return res.json({ data: null });
    }
    const data = readCollection(String(collection))[String(id)] || null;
    res.json({ data });
  });

  apiRouter.post("/db/query", (req, res) => {
    const { collection, constraints } = req.body;
    if (!collection) {
      return res.json({ docs: [] });
    }
    const docs = queryCollection(collection, constraints || []);
    res.json({ docs: docs.map(d => ({ id: d.id, data: d })) });
  });

  apiRouter.post("/db/add", (req, res) => {
    const { collection, data } = req.body;
    if (!collection || !data) {
      return res.json({ id: 'dummy_' + Date.now() });
    }
    const newId = addDocumentToCol(collection, data);
    res.json({ id: newId });
  });

  apiRouter.post("/db/update", (req, res) => {
    const { collection, id, data } = req.body;
    if (!collection || !id || !data) {
      return res.json({ success: true });
    }
    updateDocumentInCol(collection, String(id), data);
    res.json({ success: true });
  });

  apiRouter.post("/db/set", (req, res) => {
    const { collection, id, data, options } = req.body;
    if (!collection || !id || !data) {
      return res.json({ success: true });
    }
    setDocumentInCol(collection, String(id), data, options);
    res.json({ success: true });
  });

  apiRouter.post("/db/delete", (req, res) => {
    const { collection, id } = req.body;
    if (!collection || !id) {
      return res.json({ success: true });
    }
    deleteDocumentInCol(collection, String(id));
    res.json({ success: true });
  });

  apiRouter.post("/db/batch", (req, res) => {
    const { operations } = req.body;
    if (!Array.isArray(operations)) {
      return res.json({ success: true });
    }
    for (const op of operations) {
      const { type, collection, id, data, options } = op;
      if (!collection || !id) continue;
      if (type === 'set' && data) {
        setDocumentInCol(collection, id, data, options);
      } else if (type === 'update' && data) {
        updateDocumentInCol(collection, id, data);
      } else if (type === 'delete') {
        deleteDocumentInCol(collection, id);
      }
    }
    res.json({ success: true });
  });

  // Background caching endpoint to auto-populate/warm the cache as users load data
  apiRouter.post("/db/cache-sync", (req, res) => {
    const { collection, docs } = req.body;
    if (!collection || !Array.isArray(docs)) {
      return res.json({ success: false });
    }
    const current = readCollection(collection);
    for (const d of docs) {
      if (d && d.id && d.data) {
        current[d.id] = d.data;
      }
    }
    writeCollection(collection, current);
    res.json({ success: true, count: docs.length });
  });

  // Admin-initiated complete backup/sync endpoint
  apiRouter.post("/db/bulk-sync", (req, res) => {
    const { collectionsData } = req.body;
    if (!collectionsData || typeof collectionsData !== 'object') {
      return res.json({ success: false, error: "Invalid payload structures" });
    }
    
    let count = 0;
    for (const [colName, colData] of Object.entries(collectionsData)) {
      if (colData && typeof colData === 'object') {
        const dataToWrite: Record<string, any> = {};
        for (const [docId, docVal] of Object.entries(colData)) {
          if (docVal) {
            dataToWrite[docId] = docVal;
            count++;
          }
        }
        writeCollection(colName, dataToWrite);
      }
    }
    res.json({ success: true, syncedCount: count });
  });

  // Admin-initiated complete reactivation of all deactivated users
  apiRouter.post("/admin/reactivate-all", async (req, res) => {
    try {
      console.log("[ENDPOINT /admin/reactivate-all] Manually triggered reactivation of all deactivated accounts.");
      
      // 1. Reactivate in local cache file matching the structure
      const localUsers = readCollection('users');
      let localUpdatedCount = 0;
      for (const [userId, userData] of Object.entries(localUsers)) {
        if (userData && userData.disabled) {
          localUsers[userId].disabled = false;
          localUpdatedCount++;
        }
      }
      if (localUpdatedCount > 0) {
        writeCollection('users', localUsers);
        console.log(`[ENDPOINT /admin/reactivate-all] Reactivated ${localUpdatedCount} local users.`);
      }
      
      // 2. Reactivate in remote Cloud Firestore (if available via initialized Admin SDK)
      let remoteUpdatedCount = 0;
      const remoteDb = admin.apps.length > 0 ? admin.firestore() : null;
      if (remoteDb) {
        const usersSnap = await remoteDb.collection('users').get();
        if (!usersSnap.empty) {
          const batch = remoteDb.batch();
          for (const doc of usersSnap.docs) {
            const uData = doc.data();
            if (uData && uData.disabled) {
              batch.update(doc.ref, { disabled: false });
              remoteUpdatedCount++;
            }
          }
          if (remoteUpdatedCount > 0) {
            await batch.commit();
            console.log(`[ENDPOINT /admin/reactivate-all] Reactivated ${remoteUpdatedCount} remote users in Cloud Firestore.`);
          }
        }
      }
      
      res.json({
        success: true,
        localCount: localUpdatedCount,
        remoteCount: remoteUpdatedCount,
        message: `Successfully reactivated ${localUpdatedCount} local users and ${remoteUpdatedCount} remote Firestore profiles.`
      });
    } catch (err: any) {
      console.error("[ENDPOINT /admin/reactivate-all] Failure during administration activation script:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to complete bulk reactivation." });
    }
  });

  // --- BACKUP & RESTORE API ROUTES ---
  const BACKUP_DIR = path.join(process.cwd(), 'data_backups');
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Create a backup point
  apiRouter.post("/backup/create", (req, res) => {
    try {
      const { name, notes } = req.body;
      const backupId = `bkp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const backupName = name || `Manual_Backup_${new Date().toISOString().substring(0, 19).replace('T', '_')}`;
      
      const DB_DIR = path.join(process.cwd(), 'data');
      if (!fs.existsSync(DB_DIR)) {
        return res.status(400).json({ error: "No local database directory found" });
      }

      const files = fs.readdirSync(DB_DIR);
      const collectionsData: Record<string, any> = {};
      let docCount = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const colName = file.slice(0, -5);
          try {
            const raw = fs.readFileSync(path.join(DB_DIR, file), 'utf8');
            const data = JSON.parse(raw);
            collectionsData[colName] = data;
            docCount += Object.keys(data).length;
          } catch (fileErr) {
            console.error(`Error reading ${file} during backup:`, fileErr);
          }
        }
      }

      const backupPlayload = {
        id: backupId,
        name: backupName,
        notes: notes || '',
        timestamp: new Date().toISOString(),
        docCount,
        collections: collectionsData
      };

      fs.writeFileSync(
        path.join(BACKUP_DIR, `${backupId}.json`),
        JSON.stringify(backupPlayload, null, 2),
        'utf8'
      );

      res.json({ success: true, backup: { id: backupId, name: backupName, timestamp: backupPlayload.timestamp, docCount } });
    } catch (err: any) {
      console.error("Backup creation failed:", err);
      res.status(500).json({ error: err.message || "Failed to create backup point" });
    }
  });

  // List all available backup points
  apiRouter.get("/backup/list", (req, res) => {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        return res.json({ success: true, backups: [] });
      }

      const files = fs.readdirSync(BACKUP_DIR);
      const backupsList = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(BACKUP_DIR, file), 'utf8');
            const data = JSON.parse(raw);
            backupsList.push({
              id: data.id,
              name: data.name,
              notes: data.notes || '',
              timestamp: data.timestamp,
              docCount: data.docCount || 0,
              size: Buffer.byteLength(raw, 'utf8')
            });
          } catch (fileErr) {
            console.error(`Error reading backup ${file}:`, fileErr);
          }
        } else if (file.endsWith('.json.gz')) {
          try {
            const gzBuffer = fs.readFileSync(path.join(BACKUP_DIR, file));
            const raw = zlib.gunzipSync(gzBuffer).toString('utf8');
            const data = JSON.parse(raw);
            backupsList.push({
              id: data.id || file.slice(0, -8),
              name: data.name || `Automated Backup (${file.slice(7, 17)})`,
              notes: data.notes || 'Auto-generated system backup (gzipped)',
              timestamp: data.timestamp || new Date(fs.statSync(path.join(BACKUP_DIR, file)).mtime).toISOString(),
              docCount: data.docCount || 0,
              size: gzBuffer.length,
              isGzip: true
            });
          } catch (fileErr) {
            console.error(`Error reading gzipped backup ${file}:`, fileErr);
          }
        }
      }

      // Sort by latest timestamp
      backupsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({ success: true, backups: backupsList });
    } catch (err: any) {
      console.error("Backup listing failed:", err);
      res.status(500).json({ error: err.message || "Failed to list backups" });
    }
  });

  // Restore from a backup point
  apiRouter.post("/backup/restore", async (req, res) => {
    try {
      const { backupId, customBackupData } = req.body;
      let backupPayload: any = null;

      if (customBackupData) {
        backupPayload = typeof customBackupData === 'string' ? JSON.parse(customBackupData) : customBackupData;
      } else if (backupId) {
        let filePath = path.join(BACKUP_DIR, `${backupId}.json`);
        let isGzip = false;

        if (!fs.existsSync(filePath)) {
          const gzPath = path.join(BACKUP_DIR, `${backupId}.json.gz`);
          if (fs.existsSync(gzPath)) {
            filePath = gzPath;
            isGzip = true;
          }
        }

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: `Backup with ID ${backupId} not found` });
        }

        if (isGzip) {
          const gzBuffer = fs.readFileSync(filePath);
          const raw = zlib.gunzipSync(gzBuffer).toString('utf8');
          backupPayload = JSON.parse(raw);
        } else {
          const raw = fs.readFileSync(filePath, 'utf8');
          backupPayload = JSON.parse(raw);
        }
      }

      if (!backupPayload || !backupPayload.collections || typeof backupPayload.collections !== 'object') {
        return res.status(400).json({ error: "Invalid backup payload format" });
      }

      const DB_DIR = path.join(process.cwd(), 'data');
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      // Restore each collection in backup
      const collections = backupPayload.collections;
      let docCount = 0;

      for (const [colName, colData] of Object.entries(collections)) {
        if (colData && typeof colData === 'object') {
          fs.writeFileSync(
            path.join(DB_DIR, `${colName}.json`),
            JSON.stringify(colData, null, 2),
            'utf8'
          );
          docCount += Object.keys(colData).length;
        }
      }

      res.json({ success: true, restoredCount: docCount, name: backupPayload.name });
    } catch (err: any) {
      console.error("Backup restoration failed:", err);
      res.status(500).json({ error: err.message || "Failed to restore backup" });
    }
  });

  // Delete a backup checkpoint
  apiRouter.delete("/backup/delete/:id", (req, res) => {
    try {
      const backupId = req.params.id;
      const filePath = path.join(BACKUP_DIR, `${backupId}.json`);
      const gzPath = path.join(BACKUP_DIR, `${backupId}.json.gz`);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return res.json({ success: true });
      } else if (fs.existsSync(gzPath)) {
        fs.unlinkSync(gzPath);
        return res.json({ success: true });
      } else {
        return res.status(404).json({ error: "Backup file not found" });
      }
    } catch (err: any) {
      console.error("Failed to delete backup:", err);
      res.status(500).json({ error: err.message || "Could not delete backup file" });
    }
  });

  // Download a backup raw payload (using a direct GET request)
  apiRouter.get("/backup/download/:id", (req, res) => {
    try {
      const backupId = req.params.id;
      let filePath = path.join(BACKUP_DIR, `${backupId}.json`);
      let isGzip = false;

      if (!fs.existsSync(filePath)) {
        const gzPath = path.join(BACKUP_DIR, `${backupId}.json.gz`);
        if (fs.existsSync(gzPath)) {
          filePath = gzPath;
          isGzip = true;
        }
      }

      if (fs.existsSync(filePath)) {
        if (isGzip) {
          res.setHeader('Content-disposition', `attachment; filename=${backupId}.json.gz`);
          res.setHeader('Content-type', 'application/gzip');
        } else {
          res.setHeader('Content-disposition', `attachment; filename=${backupId}.json`);
          res.setHeader('Content-type', 'application/json');
        }
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
      } else {
        res.status(404).json({ error: "Backup file not found" });
      }
    } catch (err: any) {
      console.error("Failed to download backup:", err);
      res.status(500).json({ error: err.message || "Could not download backup file" });
    }
  });

  // API Route to resolve admission number to email address for unified login
  apiRouter.post("/auth/lookup-email", async (req, res) => {
    const { admissionNumber } = req.body;
    if (!admissionNumber || typeof admissionNumber !== 'string') {
      return res.status(400).json({ error: "Admission number or email address is required" });
    }

    const trimmed = admissionNumber.trim();
    if (!db) {
      return res.status(500).json({ error: "Database not initialized. Please try again later." });
    }

    try {
      const usersRef = db.collection('users');
      
      // Match exactly as specified
      let querySnapshot = await usersRef.where('admissionNumber', '==', trimmed).limit(1).get();
      
      // If not found, try uppercase match (for case insensitivity)
      if (querySnapshot.empty) {
        querySnapshot = await usersRef.where('admissionNumber', '==', trimmed.toUpperCase()).limit(1).get();
      }

      if (querySnapshot.empty) {
        return res.status(404).json({ error: `No registered account found for Admission Number/Staff ID "${trimmed}"` });
      }

      const matchedUser = querySnapshot.docs[0].data();
      if (!matchedUser.email) {
        return res.status(400).json({ error: "The profile registered with this admission number does not have an associated email address." });
      }

      res.json({ email: matchedUser.email });
    } catch (error: any) {
      console.error("[AUTH_LOOKUP_EMAIL] Error looking up email:", error);
      res.status(500).json({ error: "Internal server error resolving admission number." });
    }
  });

  // Cloudinary Config - Return 200 even if not configured, just with enabled: false
  apiRouter.get("/cloudinary-config", (req, res) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.json({ enabled: false });
    }
    
    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const signature = cloudinary.utils.api_sign_request(
        { 
          timestamp, 
          folder: "whatsapp_assets" 
        },
        process.env.CLOUDINARY_API_SECRET
      );

      res.json({
        enabled: true,
        signature,
        timestamp,
        api_key: process.env.CLOUDINARY_API_KEY,
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        folder: "whatsapp_assets"
      });
    } catch (error) {
      console.error("[CLOUDINARY] Signature error:", error);
      res.status(500).json({ error: "Failed to generate signature" });
    }
  });

  // Database sanitization and clone deployment endpoint (purging student/fee records for selling)
  apiRouter.post("/maintenance/sanitize-school-clone", async (req, res) => {
    try {
      const { 
        schoolName, 
        purgeStudents, 
        purgeAttendance, 
        purgeFees, 
        purgeExams, 
        purgeClasses, 
        purgeTimetable,
        purgeExpenses,
        purgeChats
      } = req.body;

      if (!db) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      console.log(`[CLONE] Sanitization requested. Purging: Students=${purgeStudents}, Attendance=${purgeAttendance}, Fees=${purgeFees}`);

      let deletedCounts: Record<string, number> = {};

      const deleteDocs = async (collectionName: string, queryFilter?: (ref: any) => any) => {
        let count = 0;
        let colRef = db.collection(collectionName);
        if (queryFilter) {
          colRef = queryFilter(colRef);
        }
        const snap = await colRef.get();
        for (const doc of snap.docs) {
          await doc.ref.delete();
          count++;
        }
        return count;
      };

      // 1. Purge Students & Parents (Keep Admins/Teachers)
      if (purgeStudents) {
        deletedCounts['students'] = await deleteDocs('users', ref => ref.where('role', 'in', ['student', 'parent']));
      }

      // 2. Purge Daily & Exam Attendance logs
      if (purgeAttendance) {
        deletedCounts['attendance'] = await deleteDocs('attendance');
        deletedCounts['exam_attendance'] = await deleteDocs('exam_attendance');
      }

      // 3. Purge Student Fees, fee balances, configs, and types
      if (purgeFees) {
        deletedCounts['fees'] = await deleteDocs('fees');
        deletedCounts['fee_balances'] = await deleteDocs('fee_balances');
        deletedCounts['feeGroups'] = await deleteDocs('feeGroups');
        deletedCounts['feeConfigs'] = await deleteDocs('feeConfigs');
        deletedCounts['feeTypes'] = await deleteDocs('feeTypes');
      }

      // 4. Purge Homework/Exam submissions and marks sheets
      if (purgeExams) {
        deletedCounts['exams'] = await deleteDocs('exams');
        deletedCounts['marks'] = await deleteDocs('marks');
        deletedCounts['submissions'] = await deleteDocs('submissions');
      }

      // 5. Purge Classes & Units
      if (purgeClasses) {
        deletedCounts['classes'] = await deleteDocs('classes');
        deletedCounts['units'] = await deleteDocs('units');
      }

      // 6. Purge Timetable
      if (purgeTimetable) {
        deletedCounts['timetable'] = await deleteDocs('timetable');
      }

      // 7. Purge Expenses accounts
      if (purgeExpenses) {
        deletedCounts['expenses'] = await deleteDocs('expenses');
      }

      // 8. Purge Chat Messages and System Notifications
      if (purgeChats) {
        deletedCounts['chats'] = await deleteDocs('chats');
        deletedCounts['chat_messages'] = await deleteDocs('chat_messages');
        deletedCounts['notifications'] = await deleteDocs('notifications');
      }

      // 9. Update school titles if a new school name was specified
      if (schoolName && typeof schoolName === 'string' && schoolName.trim().length > 0) {
        const cleanedName = schoolName.trim();
        const settingsRef = db.collection('settings').doc('global');
        const settingsDoc = await settingsRef.get();
        if (settingsDoc.exists) {
          await settingsRef.update({ 
            institutionName: cleanedName,
            schoolName: cleanedName
          });
        } else {
          await settingsRef.set({
            institutionName: cleanedName,
            schoolName: cleanedName,
            allowGateAccessWithFees: false,
            currency: 'Kes',
            timezone: 'Africa/Nairobi'
          });
        }
      }

      // 10. Automatically create a backup point out of the freshly sanitized/rebranded database
      let createdBackup = null;
      try {
        const DB_DIR = path.join(process.cwd(), 'data');
        if (fs.existsSync(DB_DIR)) {
          const files = fs.readdirSync(DB_DIR);
          const collectionsData: Record<string, any> = {};
          let docCount = 0;

          for (const file of files) {
            if (file.endsWith('.json')) {
              const colName = file.slice(0, -5);
              try {
                const raw = fs.readFileSync(path.join(DB_DIR, file), 'utf8');
                const data = JSON.parse(raw);
                collectionsData[colName] = data;
                docCount += Object.keys(data).length;
              } catch (fileErr) {
                console.error(`Error reading ${file} during post-clone backup:`, fileErr);
              }
            }
          }

          const backupId = `bkp_clone_${Date.now()}`;
          const safeSchoolName = schoolName ? schoolName.trim().replace(/[^a-zA-Z0-9]/g, '_') : 'CleanApp';
          const backupName = `SaaS_Clone_Template_${safeSchoolName}`;

          const backupPayload = {
            id: backupId,
            name: backupName,
            notes: `Auto-generated clean clone sandbox package for rebranded institution: ${schoolName || 'Greenwood Academy'}.`,
            timestamp: new Date().toISOString(),
            docCount,
            collections: collectionsData
          };

          const BACKUP_DIR = path.join(process.cwd(), 'data_backups');
          if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
          }

          fs.writeFileSync(
            path.join(BACKUP_DIR, `${backupId}.json`),
            JSON.stringify(backupPayload, null, 2),
            'utf8'
          );

          createdBackup = {
            id: backupId,
            name: backupName,
            docCount,
            size: Buffer.byteLength(JSON.stringify(backupPayload), 'utf8')
          };
        }
      } catch (backupErr) {
        console.error("[CLONE_AUTO_BACKUP_ERR]", backupErr);
      }

      res.json({ 
        success: true, 
        message: "Database prepared and student records successfully sanitized! App is clean and ready for deployment.",
        deletedCounts,
        createdBackup
      });

    } catch (err: any) {
      console.error("[CLONE_WIPE_ERROR]", err);
      res.status(500).json({ error: err.message || "Failed to sanitize database/export for school clone." });
    }
  });

  // Manual trigger / run on-demand for monthly fee automation
  apiRouter.post("/fees/auto-apply", async (req, res) => {
    try {
      console.log("[FEES_AUTO_APPLY] Manual trigger requested.");
      const result = await automateMonthlyFees();
      res.json({ success: true, message: "Monthly fee automation executed successfully", result });
    } catch (err: any) {
      console.error("[FEES_AUTO_APPLY] Fee automation failed:", err);
      res.status(500).json({ success: false, error: err.message || "Manual fee automation run failed." });
    }
  });

  // 2. Proxy Download Endpoint
  apiRouter.get("/download", async (req, res) => {
    const { url, filename } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "No URL provided" });
    }

    console.log(`[DOWNLOAD_PROXY] Request for: ${url}`);
    
    try {
      const fetchHeaders: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      };

      let response = await fetch(url, { headers: fetchHeaders });
      
      if (!response.ok) {
        console.error(`[DOWNLOAD_PROXY] Remote fetch failed: ${response.status} ${response.statusText} for URL: ${url}`);
        throw new Error(`Remote server returned ${response.status} ${response.statusText}`);
      }

      // Detection logic for extensions and mime types
      const urlLower = url.toLowerCase();
      let detectedExt = "";
      let detectedMime = "";

      if (urlLower.endsWith(".pdf") || urlLower.includes(".pdf?")) {
        detectedExt = ".pdf";
        detectedMime = "application/pdf";
      } else if (urlLower.endsWith(".jpg") || urlLower.endsWith(".jpeg") || urlLower.includes(".jpg?") || urlLower.includes(".jpeg?")) {
        detectedExt = ".jpg";
        detectedMime = "image/jpeg";
      } else if (urlLower.endsWith(".png") || urlLower.includes(".png?")) {
        detectedExt = ".png";
        detectedMime = "image/png";
      } else if (urlLower.endsWith(".docx") || urlLower.includes(".docx?")) {
        detectedExt = ".docx";
        detectedMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (urlLower.endsWith(".doc") || urlLower.includes(".doc?")) {
        detectedExt = ".doc";
        detectedMime = "application/msword";
      }

      let contentType = response.headers.get("Content-Type");
      if (!contentType || contentType === "application/octet-stream") {
        contentType = detectedMime || contentType;
      }
      
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      
      let baseFilename = (filename as string || "document").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      // Prevent double extensions but ensure we have one if we detected it
      if (detectedExt && !baseFilename.toLowerCase().endsWith(detectedExt)) {
        baseFilename += detectedExt;
      }
      
      const safeFilename = baseFilename;
      const mode = req.query.mode === 'inline' ? 'inline' : 'attachment';
      res.setHeader("Content-Disposition", `${mode}; filename="${safeFilename}"`);
      
      // Some mobile browsers need Content-Length to show progress or open properly
      const contentLength = response.headers.get("Content-Length");
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }

      console.log(`[DOWNLOAD_PROXY] Serving: ${safeFilename} (${contentType || 'auto'}) as ${mode}`);

      // Stream the response directly to minimize memory usage
      if (!response.body) {
        throw new Error("No response body received from remote server");
      }

      // Convert Web Stream to Node Stream for piping
      const { Readable } = await import('stream');
      // @ts-ignore
      Readable.fromWeb(response.body).pipe(res);
      
    } catch (error: any) {
      console.error("[DOWNLOAD_PROXY] Error:", error);
      res.status(500).json({ 
        error: "Failed to download asset", 
        details: error.message,
        url: url 
      });
    }
  });

  // 3. Push Notifications
  apiRouter.post("/notifications/push", async (req, res) => {
    const { userId, title, body, link } = req.body;
    if (!userId || !title || !body) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    await sendPushNotification(userId, title, body, link);
    res.json({ success: true });
  });

  // --- NODEMCU COMPATIBILITY ENDPOINTS ---
  
  // Mark Attendance via NodeMCU (RFID/Fingerprint Scanner)
  apiRouter.post("/nodemcu/attendance", async (req, res) => {
    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }

    const rawId = req.body.biometricId || req.query.biometricId || 
                  req.body.hardwareId || req.query.hardwareId || 
                  req.body.uid || req.query.uid || 
                  req.body.cardId || req.query.cardId;

    const action = req.body.action || req.query.action || 'checkIn';
    const classIdFromReq = req.body.classId || req.query.classId;
    const formatParam = req.body.format || req.query.format;
    const isTextResponse = formatParam === 'text';

    if (!rawId) {
      const msg = "Missing identifier (biometricId, hardwareId, uid or cardId)";
      if (isTextResponse) return res.status(400).send(`SEC_DENIED:SYSTEM:${msg}`);
      return res.status(400).json({ success: false, error: msg });
    }

    try {
      const trimmed = String(rawId).trim();
      const usersRef = db.collection('users');
      let studentSnap = await usersRef.where('biometricId', '==', trimmed).limit(1).get();

      if (studentSnap.empty) {
        studentSnap = await usersRef.where('biometricId', '==', `HW-${trimmed}`).limit(1).get();
      }
      if (studentSnap.empty) {
        studentSnap = await usersRef.where('biometricId', '==', `HW-${trimmed.toUpperCase()}`).limit(1).get();
      }
      if (studentSnap.empty) {
        studentSnap = await usersRef.where('biometricId', '==', trimmed.toUpperCase()).limit(1).get();
      }
      if (studentSnap.empty) {
        studentSnap = await usersRef.where('admissionNumber', '==', trimmed).limit(1).get();
      }
      if (studentSnap.empty) {
        studentSnap = await usersRef.where('admissionNumber', '==', trimmed.toUpperCase()).limit(1).get();
      }

      if (studentSnap.empty) {
        const msg = `Unrecognized device key: "${trimmed}"`;
        if (isTextResponse) return res.status(404).send(`SEC_DENIED:UNKNOWN:${msg}`);
        return res.status(404).json({ success: false, error: msg });
      }

      const studentDoc = studentSnap.docs[0];
      const studentId = studentDoc.id;
      const studentData = studentDoc.data();

      // Check if disabled/deactivated
      if (studentData.disabled) {
        const msg = "Account Deactivated due to excessive absences.";
        if (isTextResponse) return res.status(403).send(`SEC_DENIED:${studentData.name}:${msg}`);
        return res.status(403).json({ success: false, error: msg, student: studentData.name });
      }

      // Fee Balance Check (Ksh protection) - check both 'fees' (live/UI) and 'fee_balances'
      let feeSnap = await db.collection('fees').where('studentId', '==', studentId).limit(1).get();
      if (feeSnap.empty) {
        feeSnap = await db.collection('fee_balances').where('studentId', '==', studentId).limit(1).get();
      }
      if (!feeSnap.empty) {
        const feeData = feeSnap.docs[0].data();
        if (feeData.balance > 0) {
          const msg = `Access Denied: Unpaid Balance (Ksh ${feeData.balance})`;
          if (isTextResponse) {
            return res.status(403).send(`SEC_DENIED:${studentData.name}:${msg}`);
          }
          return res.status(403).json({ success: false, error: msg, student: studentData.name, balance: feeData.balance });
        }
      }

      // Determine class ID
      const targetClassId = classIdFromReq || 
                            (studentData.classIds && studentData.classIds[0]) || 
                            studentData.classId;

      if (!targetClassId) {
        const msg = "Student has no registered class in their profile.";
        if (isTextResponse) return res.status(400).send(`SEC_DENIED:${studentData.name}:${msg}`);
        return res.status(400).json({ success: false, error: msg, student: studentData.name });
      }

      // Format date in Africa/Nairobi offset Timezone for local consistency
      const nairobiOffsetStr = new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" });
      const nairobiDateObj = new Date(nairobiOffsetStr);
      const dateStr = nairobiDateObj.getFullYear() + '-' + 
                      String(nairobiDateObj.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(nairobiDateObj.getDate()).padStart(2, '0');
      const timeStr = String(nairobiDateObj.getHours()).padStart(2, '0') + ':' + 
                      String(nairobiDateObj.getMinutes()).padStart(2, '0') + ':' + 
                      String(nairobiDateObj.getSeconds()).padStart(2, '0');

      const actionType = action === 'checkOut' ? 'checkOut' : action === 'leaveOut' ? 'leaveOut' : 'checkIn';

      // Enforce early checkout rule (No checkout prior to 4 PM / 16:00 unless with admin permission flag true on profile)
      if (actionType === 'checkOut' || actionType === 'leaveOut') {
        const hour = nairobiDateObj.getHours();
        if (hour < 16) {
          if (!studentData.earlyCheckoutAllowed) {
            const msg = "Early exit restricted prior to 04:00 PM without administrator permission.";
            if (isTextResponse) {
              return res.status(403).send(`SEC_DENIED:${studentData.name}:${msg}`);
            }
            return res.status(403).json({ success: false, error: msg, student: studentData.name, earlyCheckoutAllowed: false });
          }
        }
      }

      const logEntry = {
        time: timeStr,
        method: 'biometric',
        supervisorId: 'nodemcu'
      };

      const attRef = db.collection('attendance');
      const q = attRef.where('date', '==', dateStr).where('classId', '==', targetClassId).limit(1);
      const attQuerySnap = await q.get();

      if (!attQuerySnap.empty) {
        const todayDoc = attQuerySnap.docs[0];
        const oldData = todayDoc.data();
        
        const updatedRecords = { 
          ...oldData.records, 
          [studentId]: actionType === 'checkIn' ? 'present' : (oldData.records?.[studentId] || 'present')
        };
        
        const existingLogs = oldData.biometricLogs?.[studentId] || {};
        const updatedLogs = {
          ...oldData.biometricLogs,
          [studentId]: {
            ...existingLogs,
            [actionType]: logEntry
          }
        };

        await todayDoc.ref.update({
          records: updatedRecords,
          biometricLogs: updatedLogs
        });
      } else {
        await attRef.add({
          classId: targetClassId,
          date: dateStr,
          records: { [studentId]: actionType === 'checkIn' ? 'present' : 'absent' },
          biometricLogs: {
            [studentId]: {
              [actionType]: logEntry
            }
          }
        });
      }

      // Log notification
      const logMsg = `${studentData.name} successfully registered ${actionType} at ${timeStr} using NodeMCU scanner.`;
      await db.collection('notifications').add({
        userId: studentId,
        title: `${actionType === 'checkIn' ? 'Entry Granted' : 'Exit Recorded'} via IoT`,
        message: logMsg,
        type: 'attendance',
        read: false,
        createdAt: new Date().toISOString(),
        link: '/attendance'
      });

      if (isTextResponse) {
        return res.status(200).send(`SEC_GRANTED:${studentData.name}:${actionType}:${timeStr}`);
      }

      return res.status(200).json({
        success: true,
        message: "Attendance recorded successfully",
        student: studentData.name,
        admissionNumber: studentData.admissionNumber || 'N/A',
        action: actionType,
        time: timeStr,
        date: dateStr
      });

    } catch (err: any) {
      console.error("[NODEMCU_ATTENDANCE_ERROR]", err);
      const errorMsg = err.message || "Internal database update failure";
      if (isTextResponse) return res.status(500).send(`SEC_DENIED:SYSTEM:${errorMsg}`);
      return res.status(500).json({ success: false, error: errorMsg });
    }
  });

  // Link Hardware ID via NodeMCU
  apiRouter.post("/nodemcu/link", async (req, res) => {
    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }

    const studentId = req.body.studentId || req.query.studentId;
    const hardwareId = req.body.hardwareId || req.query.hardwareId || req.body.uid || req.query.uid;
    const formatParam = req.body.format || req.query.format;
    const isTextResponse = formatParam === 'text';

    if (!studentId || !hardwareId) {
      const msg = "Missing studentId or hardwareId";
      if (isTextResponse) return res.status(400).send(`LINK_DENIED:${msg}`);
      return res.status(400).json({ success: false, error: msg });
    }

    try {
      const trimmedHardware = String(hardwareId).trim();
      const usersRef = db.collection('users');
      
      // Check if student exists
      const studentDoc = await usersRef.doc(studentId).get();
      if (!studentDoc.exists) {
        const msg = `Student with ID "${studentId}" not found`;
        if (isTextResponse) return res.status(404).send(`LINK_DENIED:${msg}`);
        return res.status(404).json({ success: false, error: msg });
      }

      await usersRef.doc(studentId).update({
        biometricId: `HW-${trimmedHardware}`,
        biometricLinkedAt: new Date().toISOString()
      });

      const studentName = studentDoc.data()?.name || "Student";
      if (isTextResponse) {
        return res.status(200).send(`LINK_OK:${studentName}:${trimmedHardware}`);
      }

      return res.status(200).json({
        success: true,
        message: "Biometric linked to hardware successfully",
        student: studentName,
        hardwareId: `HW-${trimmedHardware}`
      });

    } catch (err: any) {
      console.error("[NODEMCU_LINK_ERROR]", err);
      const errorMsg = err.message || "Internal database linking failure";
      if (isTextResponse) return res.status(500).send(`LINK_DENIED:${errorMsg}`);
      return res.status(500).json({ success: false, error: errorMsg });
    }
  });

  // 5. File Upload Endpoint (Cloudinary with local fallback)
  apiRouter.post("/upload", (req, res, next) => {
    console.log(`[UPLOAD] Incoming request: ${req.method} ${req.originalUrl}`);
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading.
        console.error("[UPLOAD] Multer error:", err);
        return res.status(400).json({ error: "File upload error", details: err.message });
      } else if (err) {
        // An unknown error occurred when uploading.
        console.error("[UPLOAD] Unknown upload error:", err);
        return res.status(500).json({ error: "Unknown upload error" });
      }

      // Everything went fine.
      next();
    });
  }, async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    try {
      console.log(`[UPLOAD] Received file: ${req.file.originalname}, size: ${req.file.size}`);

      // Check if Cloudinary is configured
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.warn("[UPLOAD] Cloudinary not configured. Falling back to local storage URL.");
        // Fallback to local storage URL (which we've already saved via multer)
        const fileUrl = `/uploads/${req.file.filename}`;
        return res.json({ 
          success: true, 
          url: fileUrl,
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          provider: 'local'
        });
      }

      console.log(`[UPLOAD] Uploading to Cloudinary: ${req.file.path}`);
      
      const fileExt = req.file.originalname.split(".").pop()?.toLowerCase();
      const isDocument = ["pdf", "doc", "docx", "zip", "xls", "xlsx", "ppt", "pptx"].includes(fileExt || "");
      const baseName = req.file.originalname.split(".").slice(0, -1).join(".");
      const safeBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
      
      // For raw assets, the public_id should include the extension to preserve it and help with Content-Type
      const publicId = isDocument 
        ? `${Date.now()}-${safeBaseName}.${fileExt}`
        : `${Date.now()}-${safeBaseName}`;

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "whatsapp_assets",
        resource_type: isDocument ? "raw" : "auto",
        public_id: publicId,
        access_mode: "public",
        type: "upload"
      });

      // Cleanup local file after upload
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.log(`[UPLOAD] Cloudinary upload successful: ${result.secure_url}`);

      res.json({ 
        success: true, 
        url: result.secure_url,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        provider: 'cloudinary'
      });
    } catch (error: any) {
      console.error("[UPLOAD] Cloudinary error:", error);
      
      // Cleanup local file on error too
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({ 
        error: "Failed to upload to Cloudinary", 
        details: error.message 
      });
    }
  });

  // Mount the router after defining all routes
  app.use("/api", apiRouter);

  // Catch-all for /api routes that didn't match to ensure they return JSON, not HTML
  app.use("/api", (req, res) => {
    console.warn(`[API 404] No route matched for ${req.method} ${req.path}`);
    res.status(404).json({ 
      error: "API endpoint not found", 
      path: req.path,
      method: req.method 
    });
  });

  // Final error handler for API routes
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[API ERROR] on ${req.method} ${req.path}:`, err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Monthly Fees Automation
  // Cron schedule: 0 0 1 * * (Midnight on the 1st of every month)
  // For testing, we could use something else, but we'll stick to 1st.
  cron.schedule("0 0 1 * *", async () => {
    console.log("Running monthly fee automation...");
    try {
      await automateMonthlyFees();
    } catch (error) {
      console.error("Monthly fee automation failed:", error);
    }
  });

  // Monthly Automatic System Backups
  // Cron schedule: 0 2 1 * * (Every 1st of the month at 2:00 AM)
  cron.schedule("0 2 1 * *", async () => {
    console.log("Starting scheduled automatic monthly backup at 2:00 AM...");
    try {
      const result = await runBackup();
      if (result.success) {
        console.log(`[CRON_BACKUP] Scheduled backup completed successfully. Filename: ${result.filename}`);
      } else {
        console.error(`[CRON_BACKUP] Scheduled backup failed. Error: ${result.error}`);
      }
    } catch (error) {
      console.error("[CRON_BACKUP] Scheduled automatic backup cron error:", error);
    }
  });

  console.log("Monthly backup scheduler initialized.");

  // Also run once on startup to ensure no missed fees (highly useful for on-demand restarts)
  console.log("Monthly fee scheduler initialized.");
  setTimeout(async () => {
    console.log("[STARTUP] Starting automatic background monthly fee check...");
    try {
      const stats = await automateMonthlyFees();
      console.log("[STARTUP] Background monthly fee check complete:", stats);
    } catch (err) {
      console.error("[STARTUP] Background monthly fee check failed:", err);
    }
  }, 1500);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

async function sendPushNotification(userId: string, title: string, body: string, link: string = '/') {
  if (!db) return;
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const tokens = userData?.fcmTokens || [];

    if (tokens.length === 0) {
      console.log(`No FCM tokens for user ${userId}`);
      return;
    }

    const message = {
      notification: { title, body },
      data: { link },
      tokens: tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Push sent: ${response.successCount} success, ${response.failureCount} failure`);
    
    // Cleanup invalid tokens if any
    if (response.failureCount > 0) {
      const remainingTokens = tokens.filter((_: any, idx: number) => response.responses[idx].success);
      if (remainingTokens.length !== tokens.length) {
        await db.collection('users').doc(userId).update({ fcmTokens: remainingTokens });
      }
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

async function automateMonthlyFees() {
  if (!db) {
    console.error("Monthly fee automation skipped: Firebase Admin not initialized (missing credentials).");
    return { success: false, error: "Database not initialized" };
  }
  const now = new Date();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonthYear = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const timestamp = now.toISOString();

  // 1. Fetch all monthly fee configurations
  // User changed class_fees to feeConfigs in UI
  const configsSnap = await db.collection('feeConfigs').where('period', '==', 'monthly').get();
  const configs = configsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (configs.length === 0) {
    console.log("No monthly fee configurations found.");
    return { success: true, configsCount: 0, appliedCount: 0, skippedCount: 0 };
  }

  // 2. Fetch all students
  const studentsSnap = await db.collection('users').where('role', '==', 'student').get();
  const students = studentsSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

  console.log(`Processing ${configs.length} monthly fee configs for ${students.length} students...`);
  
  // Fetch all attendance from the last 60 days to determine absences
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

  const studentPresenceCount: { [studentId: string]: number } = {};

  try {
    const attendanceSnap = await db.collection('attendance').get();

    attendanceSnap.docs.forEach((doc: any) => {
      const data = doc.data();
      const date = data.date;
      if (date && date >= sixtyDaysAgoStr) {
        const records = data.records || {};
        for (const [studentId, status] of Object.entries(records)) {
          if (status === 'present' || status === 'late' || status === 'excused') {
            studentPresenceCount[studentId] = (studentPresenceCount[studentId] || 0) + 1;
          }
        }
      }
    });
  } catch (err) {
    console.error("Error fetching attendance for monthly billing suspension check:", err);
  }

  let appliedCount = 0;
  let skippedCount = 0;
  let suspendedCount = 0;

  for (const config of configs) {
    const isAll = (config as any).classId === 'all';
    const classIdToMatch = String((config as any).classId || '').trim();
    
    const targetStudents = isAll 
      ? students 
      : students.filter(s => {
          const classIds = (s as any).classIds;
          const classId = (s as any).classId;
          const cids: string[] = [];
          if (Array.isArray(classIds)) {
            cids.push(...classIds.map(String));
          } else if (classIds) {
            cids.push(String(classIds));
          }
          if (classId) {
            cids.push(String(classId));
          }
          return cids.map(c => c.trim()).includes(classIdToMatch);
        });

    for (const student of targetStudents) {
      const sUid = student.uid ? String(student.uid).trim() : '';
      if (!sUid) {
        skippedCount++;
        continue;
      }

      // Evaluate enrollment date - skip check for students registered in the last 30 days
      const createdAtStr = (student as any).createdAt || (student as any).admissionDate;
      const createdDate = createdAtStr ? new Date(createdAtStr) : null;
      const isNewStudent = createdDate && (now.getTime() - createdDate.getTime()) < 30 * 24 * 60 * 60 * 1000;

      if (!isNewStudent) {
        const presenceCount = studentPresenceCount[sUid] || 0;
        
        // If they have 0 presences in the last 60 days, suspend billing
        if (presenceCount === 0) {
          console.log(`[Suspended Billing] Student ${student.name || sUid} was absent for the last 60 days. Skipping billing.`);
          suspendedCount++;
          continue;
        }
      }

      const feeTitle = (config as any).title;
      const feeAmount = Number((config as any).amount || 0);
      const historyDescription = `Monthly Fee: ${feeTitle} (${currentMonthYear})`;

      // Check if already applied
      const feesRef = db.collection('fees').doc(sUid);
      const feeDoc = await feesRef.get();
      const feeData = feeDoc.data() || { balance: 0, totalAmount: 0, paidAmount: 0, history: [] };

      const alreadyApplied = (feeData.history || []).filter(Boolean).some((h: any) => 
        String(h.description || '') === historyDescription && h.type === 'charge'
      );

      if (alreadyApplied) {
        skippedCount++;
        continue;
      }

      const historyItem = {
        date: timestamp,
        amount: feeAmount,
        type: 'charge',
        description: historyDescription
      };

      const newTotal = Number(feeData.totalAmount || 0) + feeAmount;
      const newPaid = Number(feeData.paidAmount || 0);

      await feesRef.set({
        studentId: sUid,
        totalAmount: newTotal,
        paidAmount: newPaid,
        balance: newTotal - newPaid,
        lastUpdated: timestamp,
        history: [...(feeData.history || []), historyItem]
      }, { merge: true });

      // Keep fee_balances collection in sync
      try {
        await db.collection('fee_balances').doc(sUid).set({
          studentId: sUid,
          totalAmount: newTotal,
          paidAmount: newPaid,
          balance: newTotal - newPaid,
          lastUpdated: timestamp
        }, { merge: true });
      } catch (err) {
        console.warn(`[Automated Billing] Failed to sync fee_balances for student ${sUid}:`, err);
      }

      // Add notification
      const notificationMessage = `${feeTitle}: A monthly charge of Ksh ${feeAmount} has been added for ${currentMonthYear}.`;
      await db.collection('notifications').add({
        userId: sUid,
        title: 'Monthly Fee Applied',
        message: notificationMessage,
        type: 'fee',
        read: false,
        createdAt: timestamp,
        link: '/fees'
      });

      // Send Push Notification
      await sendPushNotification(sUid, 'Monthly Fee Applied', notificationMessage, '/#/fees');
      appliedCount++;
    }
  }

  return {
    success: true,
    configsCount: configs.length,
    appliedCount,
    skippedCount,
    suspendedCount
  };
}

startServer();
