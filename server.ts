import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cron from "node-cron";
import admin from "firebase-admin";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
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

// Automatic one-shot migration on startup to download documents from Firestore to prevent reading it again
async function migrateFromFirestore(firestoreAdmin: admin.firestore.Firestore) {
  const collections = [
    'users', 'classes', 'attendance', 'fees', 'feeConfigs', 
    'timetable', 'exams', 'exam_results', 'marks', 'chats', 
    'notifications', 'fee_balances'
  ];
  
  console.log("[MIGRATION] Checking Firestore data migration...");
  for (const colName of collections) {
    const localPath = path.join(process.cwd(), 'data', `${colName}.json`);
    if (!fs.existsSync(localPath)) {
      console.log(`[MIGRATION] Fetching data for "${colName}" from remote Firestore...`);
      try {
        const snap = await firestoreAdmin.collection(colName).get();
        const data: any = {};
        if (!snap.empty) {
          snap.docs.forEach(doc => {
            data[doc.id] = doc.data();
          });
          writeCollection(colName, data);
          console.log(`[MIGRATION] Imported ${snap.size} documents for "${colName}" successfully.`);
        } else {
          writeCollection(colName, {});
          console.log(`[MIGRATION] Collection "${colName}" is empty in Cloud Firestore.`);
        }
      } catch (err) {
        console.error(`[MIGRATION] Failed to migrate keys for "${colName}":`, err);
        writeCollection(colName, {});
      }
    }
  }
  console.log("[MIGRATION] Automatic offline data initialization check complete.");
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
  console.log("Firebase Admin initialized, launching one-time background migration check.");
  migrateFromFirestore(remoteDb).catch(err => {
    console.error("Migration task failed:", err);
  });
} catch (error) {
  console.log("Firebase Admin initialization warning:", error);
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

      // Fee Balance Check (Ksh protection)
      const feeSnap = await db.collection('fee_balances').where('studentId', '==', studentId).limit(1).get();
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

  // Also run once on startup to ensure no missed fees (optional, but good for reliability)
  // Or at least log that it's active.
  console.log("Monthly fee scheduler initialized.");

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
    return;
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
    return;
  }

  // 2. Fetch all students
  const studentsSnap = await db.collection('users').where('role', '==', 'student').get();
  const students = studentsSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

  console.log(`Processing ${configs.length} monthly fee configs for ${students.length} students...`);

  for (const config of configs) {
    const isAll = (config as any).classId === 'all';
    const classIdToMatch = String((config as any).classId);
    
    const targetStudents = isAll 
      ? students 
      : students.filter(s => ((s as any).classIds || []).map(String).includes(classIdToMatch));

    for (const student of targetStudents) {
      const sUid = student.uid.trim();
      const feeTitle = (config as any).title;
      const feeAmount = Number((config as any).amount);
      const historyDescription = `Monthly Fee: ${feeTitle} (${currentMonthYear})`;

      // Check if already applied
      const feesRef = db.collection('fees').doc(sUid);
      const feeDoc = await feesRef.get();
      const feeData = feeDoc.data() || { balance: 0, totalAmount: 0, paidAmount: 0, history: [] };

      const alreadyApplied = (feeData.history || []).some((h: any) => 
        h.description === historyDescription && h.type === 'charge'
      );

      if (alreadyApplied) {
        // console.log(`Fee "${feeTitle}" already applied for ${student.uid} this month.`);
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
    }
  }
}

startServer();
