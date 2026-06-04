import * as realFS from '@firebase/firestore';
import { db as realDb } from '../firebase';

// Smart Hybrid Caching and Redundant Offline Database Mode Manager
let activeDbMode = typeof window !== 'undefined' ? (localStorage.getItem('school_db_mode') || 'real') : 'real';

export function getDbMode(): 'real' | 'local_cached' {
  return activeDbMode as any;
}

export function setDbMode(mode: 'real' | 'local_cached') {
  activeDbMode = mode;
  if (typeof window !== 'undefined') {
    localStorage.setItem('school_db_mode', mode);
    console.log(`[Database Engine Mode] Switch trigger to: ${mode}`);
    window.dispatchEvent(new Event('db-mode-changed'));
  }
}

// Check for common firebase read limit / authentication blocks
export function isQuotaOrPermissionError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  const code = String(error.code || '').toLowerCase();
  return (
    code === 'resource-exhausted' || 
    code === 'permission-denied' ||
    code === 'quota-exceeded' ||
    code === 'unavailable' ||
    msg.includes('quota') || 
    msg.includes('exhausted') || 
    msg.includes('permission denied') ||
    msg.includes('insufficient permissions') ||
    msg.includes('resource exhausted')
  );
}

// Robust Fetch wrapper with automatic retries for transient service/restart states
const originalFetch = (typeof window !== 'undefined' ? window.fetch : (typeof globalThis !== 'undefined' ? (globalThis as any).fetch : null));

async function robustFetch(url: string, options?: RequestInit, retries = 3, delay = 250): Promise<Response> {
  const absoluteUrl = typeof window !== 'undefined' && url.startsWith('/') 
    ? `${window.location.origin}${url}` 
    : url;
    
  if (!originalFetch) {
    throw new Error("No global fetch implementation found");
  }

  for (let i = 0; i < retries; i++) {
    try {
      const res = await originalFetch(absoluteUrl, options);
      if (res.ok) {
        return res;
      }
      // If we encounter a transient gateway/restarting state (502, 503, 504), wait and retry
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
          continue;
        }
      }
      return res; 
    } catch (err) {
      if (i === retries - 1) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  throw new Error("Failed to fetch after retries");
}

// Shadow global fetch inside this module to gain automatic resilience on all API requests
const fetch = robustFetch;

// Background dynamic sync handlers with non-blocking fetching
async function cacheDocsFromServer(collectionName: string, querySnapshot: any) {
  try {
    const docs = querySnapshot.docs.map((docSnap: any) => ({
      id: docSnap.id,
      data: docSnap.data()
    }));
    if (docs.length === 0) return;

    fetch('/api/db/cache-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: collectionName, docs })
    }).catch(() => {});
  } catch (err) {
    console.warn('[Cache Sync Warning] background cache writing failed:', err);
  }
}

async function cacheSingleDocFromServer(collectionName: string, id: string, docSnapshot: any) {
  try {
    const exists = typeof docSnapshot?.exists === 'function' ? docSnapshot.exists() : !!docSnapshot;
    if (!exists) return;
    const data = typeof docSnapshot?.data === 'function' ? docSnapshot.data() : (docSnapshot?.data || docSnapshot);
    if (!data) return;
    
    fetch('/api/db/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: collectionName, id, data, options: { merge: true } })
    }).catch(() => {});
  } catch (err) {
    console.warn('[Cache Sync Warning] background single doc caching failed:', err);
  }
}

export function initializeFirestore(app: any, settings: any, databaseId?: string) {
  return { type: 'firestore' };
}

export function enableIndexedDbPersistence(db: any) {
  return Promise.resolve();
}

export class MockDocumentSnapshot {
  id: string;
  _data: any;
  ref: any;
  constructor(id: string, data: any, ref?: any) {
    this.id = id;
    this._data = data;
    this.ref = ref || { id, path: id };
  }
  exists() {
    return !!this._data;
  }
  data() {
    return this._data;
  }
}

export class MockQuerySnapshot {
  docs: MockDocumentSnapshot[];
  empty: boolean;
  size: number;
  constructor(docs: MockDocumentSnapshot[]) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }
  docChanges() {
    return this.docs.map(doc => ({
      type: 'added',
      doc
    }));
  }
  forEach(callback: (doc: MockDocumentSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

export function mapToMockQuerySnapshot(realSnapshot: any): MockQuerySnapshot {
  const docs = (realSnapshot?.docs || []).map((d: any) => {
    return new MockDocumentSnapshot(d.id, d.data(), { id: d.id, path: d.ref?.path || "" });
  });
  return new MockQuerySnapshot(docs);
}

export function collection(dbOrDoc: any, ...pathSegments: string[]) {
  let fullPath = "";
  if (dbOrDoc && dbOrDoc.type === 'document') {
    fullPath = [dbOrDoc.path, ...pathSegments].filter(Boolean).join('/');
  } else if (dbOrDoc && typeof dbOrDoc === 'string') {
    fullPath = [dbOrDoc, ...pathSegments].filter(Boolean).join('/');
  } else {
    fullPath = pathSegments.filter(Boolean).join('/');
  }
  return { type: 'collection', path: fullPath };
}

export function generateAutoId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let autoId = '';
  for (let i = 0; i < 20; i++) {
    autoId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return autoId;
}

export function doc(dbOrCol: any, pathOrId?: string, ...additionalPaths: string[]) {
  let fullPath = "";
  if (dbOrCol && dbOrCol.type === 'collection') {
    const actualId = pathOrId || generateAutoId();
    fullPath = [dbOrCol.path, actualId, ...additionalPaths].filter(Boolean).join('/');
  } else {
    fullPath = [pathOrId, ...additionalPaths].filter(Boolean).join('/');
  }
  
  const segments = fullPath.split('/');
  const collectionName = segments[0] || "";
  const id = segments.slice(1).join('/') || "";
  
  return { 
    type: 'document', 
    collection: collectionName, 
    id: id,
    path: fullPath
  };
}

function getDocPath(docRef: any): { collectionName: string; id: string; path: string } {
  if (docRef.type === 'document') {
    return { 
      collectionName: docRef.collection, 
      id: docRef.id, 
      path: docRef.path 
    };
  }
  const s = String(docRef.path || '').split('/');
  return {
    collectionName: s[0] || '',
    id: s.slice(1).join('/') || docRef.id || '',
    path: docRef.path || ''
  };
}

function mapToRealRef(mockRef: any): any {
  if (!mockRef) return mockRef;
  if (mockRef.type === 'document') {
    return realFS.doc(realDb, mockRef.path);
  }
  if (mockRef.type === 'collection') {
    return realFS.collection(realDb, mockRef.path);
  }
  if (mockRef.type === 'query') {
    const collName = mockRef.collectionName;
    let baseRef = realFS.collection(realDb, collName);
    const compiledConstraints = mockRef.constraints.map((c: any) => {
      if (c.type === 'where') {
        return realFS.where(c.field, c.operator, c.value);
      }
      if (c.type === 'orderBy') {
        return realFS.orderBy(c.field, c.direction);
      }
      if (c.type === 'limit') {
        return realFS.limit(c.value);
      }
      return null;
    }).filter(Boolean);
    return realFS.query(baseRef, ...compiledConstraints);
  }
  return mockRef;
}

export async function getDoc(docRef: any) {
  if (activeDbMode === 'real') {
    try {
      const realDocRef = realFS.doc(realDb, docRef.path);
      const snapshot = await realFS.getDoc(realDocRef);
      
      const { collectionName, id } = getDocPath(docRef);
      if (collectionName && id) {
        cacheSingleDocFromServer(collectionName, id, snapshot);
      }

      return new MockDocumentSnapshot(docRef.id, snapshot.data(), { id: docRef.id, path: docRef.path });
    } catch (err: any) {
      console.warn("[Database Proxy] Remote getDoc failed, falling back:", err);
      if (isQuotaOrPermissionError(err)) {
        setDbMode('local_cached');
        return fetchDocFromCache(docRef);
      }
      throw err;
    }
  } else {
    return fetchDocFromCache(docRef);
  }
}

export async function getDocFromServer(docRef: any) {
  return getDoc(docRef);
}

async function fetchDocFromCache(docRef: any) {
  try {
    const res = await fetch(`/api/db/get?collection=${docRef.collection || docRef.path}&id=${docRef.id}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error("HTML response received instead of JSON database payload (database starting/offline)");
    }

    const text = await res.text();
    if (text.trim().startsWith('<')) {
      throw new Error("HTML content received instead of JSON database payload (database starting/offline)");
    }

    const json = JSON.parse(text);
    return new MockDocumentSnapshot(docRef.id, json.data, { id: docRef.id, path: docRef.path });
  } catch (err: any) {
    console.log("[Database Proxy] Cached doc fetch notice:", err.message || err);
    return new MockDocumentSnapshot(docRef.id, null);
  }
}

export function query(collectionRef: any, ...constraints: any[]) {
  return {
    type: 'query',
    collectionName: collectionRef.path,
    constraints: constraints.filter(Boolean)
  };
}

export function where(field: string, operator: string, value: any) {
  return { type: 'where', field, operator, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(value: number) {
  return { type: 'limit', value };
}

export async function getDocs(queryOrRef: any) {
  if (activeDbMode === 'real') {
    try {
      const realRef = mapToRealRef(queryOrRef);
      const snapshot = await realFS.getDocs(realRef);

      const collName = queryOrRef.type === 'query' 
        ? queryOrRef.collectionName 
        : queryOrRef.path;
      if (collName) {
        cacheDocsFromServer(collName, snapshot);
      }

      const docs = snapshot.docs.map((d: any) => new MockDocumentSnapshot(d.id, d.data(), { id: d.id, path: d.ref.path }));
      return new MockQuerySnapshot(docs);
    } catch (err: any) {
      console.warn("[Database Proxy] Remote getDocs failed, falling back:", err);
      if (isQuotaOrPermissionError(err)) {
        setDbMode('local_cached');
        return fetchDocsFromCache(queryOrRef);
      }
      throw err;
    }
  } else {
    return fetchDocsFromCache(queryOrRef);
  }
}

async function fetchDocsFromCache(queryOrRef: any) {
  try {
    const isQuery = queryOrRef.type === 'query';
    const collectionName = isQuery ? queryOrRef.collectionName : queryOrRef.path;
    const constraints = isQuery ? queryOrRef.constraints : [];

    const res = await fetch('/api/db/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: collectionName, constraints })
    });

    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error("HTML response received instead of JSON database database (database starting/offline)");
    }

    const text = await res.text();
    if (text.trim().startsWith('<')) {
      throw new Error("HTML content received instead of JSON database database (database starting/offline)");
    }

    const json = JSON.parse(text);
    const docs = (json.docs || []).map((d: any) => new MockDocumentSnapshot(d.id, d.data, { id: d.id, path: `${collectionName}/${d.id}` }));
    return new MockQuerySnapshot(docs);
  } catch (err: any) {
    console.log("[Database Proxy] Cached docs fetch notice:", err.message || err);
    return new MockQuerySnapshot([]);
  }
}

export async function addDoc(collectionRef: any, data: any) {
  if (activeDbMode === 'real') {
    try {
      const realColRef = realFS.collection(realDb, collectionRef.path);
      const res = await realFS.addDoc(realColRef, data);
      
      fetch('/api/db/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: collectionRef.path, id: res.id, data })
      }).catch(() => {});

      return { id: res.id };
    } catch (err: any) {
      console.warn("[Database Proxy] Remote addDoc failed, falling back:", err);
      if (isQuotaOrPermissionError(err)) {
        setDbMode('local_cached');
        return addDocToCache(collectionRef, data);
      }
      throw err;
    }
  } else {
    return addDocToCache(collectionRef, data);
  }
}

async function addDocToCache(collectionRef: any, data: any) {
  const res = await fetch('/api/db/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection: collectionRef.path, data })
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function updateDoc(docRef: any, data: any) {
  if (activeDbMode === 'real') {
    try {
      const realDocRef = realFS.doc(realDb, docRef.path);
      await realFS.updateDoc(realDocRef, data);

      fetch('/api/db/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: docRef.collection || docRef.path.split('/')[0], id: docRef.id, data })
      }).catch(() => {});

      return { success: true };
    } catch (err: any) {
      console.warn("[Database Proxy] Remote updateDoc failed, falling back:", err);
      if (isQuotaOrPermissionError(err)) {
        setDbMode('local_cached');
        return updateDocInCache(docRef, data);
      }
      throw err;
    }
  } else {
    return updateDocInCache(docRef, data);
  }
}

async function updateDocInCache(docRef: any, data: any) {
  const res = await fetch('/api/db/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection: docRef.collection || docRef.path.split('/')[0], id: docRef.id, data })
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return { success: true };
}

export async function setDoc(docRef: any, data: any, options?: any) {
  if (activeDbMode === 'real') {
    try {
      const realDocRef = realFS.doc(realDb, docRef.path);
      await realFS.setDoc(realDocRef, data, options);

      fetch('/api/db/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: docRef.collection || docRef.path.split('/')[0], id: docRef.id, data, options })
      }).catch(() => {});

      return { success: true };
    } catch (err: any) {
      console.warn("[Database Proxy] Remote setDoc failed, falling back:", err);
      if (isQuotaOrPermissionError(err)) {
        setDbMode('local_cached');
        return setDocInCache(docRef, data, options);
      }
      throw err;
    }
  } else {
    return setDocInCache(docRef, data, options);
  }
}

async function setDocInCache(docRef: any, data: any, options?: any) {
  const res = await fetch('/api/db/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection: docRef.collection || docRef.path.split('/')[0], id: docRef.id, data, options })
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return { success: true };
}

export async function deleteDoc(docRef: any) {
  if (activeDbMode === 'real') {
    try {
      const realDocRef = realFS.doc(realDb, docRef.path);
      await realFS.deleteDoc(realDocRef);

      fetch('/api/db/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: docRef.collection || docRef.path.split('/')[0], id: docRef.id })
      }).catch(() => {});

      return { success: true };
    } catch (err: any) {
      console.warn("[Database Proxy] Remote deleteDoc failed, falling back:", err);
      if (isQuotaOrPermissionError(err)) {
        setDbMode('local_cached');
        return deleteDocInCache(docRef);
      }
      throw err;
    }
  } else {
    return deleteDocInCache(docRef);
  }
}

async function deleteDocInCache(docRef: any) {
  const res = await fetch('/api/db/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection: docRef.collection || docRef.path.split('/')[0], id: docRef.id })
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return { success: true };
}

export function writeBatch() {
  const operations: any[] = [];
  return {
    set(docRef: any, data: any, options?: any) {
      operations.push({
        type: 'set',
        collection: docRef.collection || docRef.path.split('/')[0],
        id: docRef.id,
        data,
        options
      });
    },
    update(docRef: any, data: any) {
      operations.push({
        type: 'update',
        collection: docRef.collection || docRef.path.split('/')[0],
        id: docRef.id,
        data
      });
    },
    delete(docRef: any) {
      operations.push({
        type: 'delete',
        collection: docRef.collection || docRef.path.split('/')[0],
        id: docRef.id
      });
    },
    async commit() {
      if (activeDbMode === 'real') {
        try {
          const realBatch = realFS.writeBatch(realDb);
          for (const op of operations) {
            const realDocRef = realFS.doc(realDb, `${op.collection}/${op.id}`);
            if (op.type === 'set') {
              realBatch.set(realDocRef, op.data, op.options);
            } else if (op.type === 'update') {
              realBatch.update(realDocRef, op.data);
            } else if (op.type === 'delete') {
              realBatch.delete(realDocRef);
            }
          }
          await realBatch.commit();
          
          fetch('/api/db/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operations })
          }).catch(() => {});

          return { success: true };
        } catch (err: any) {
          console.warn("[Database Proxy] Remote batch commit failed, falling back:", err);
          if (isQuotaOrPermissionError(err)) {
            setDbMode('local_cached');
            return commitBatchToCache(operations);
          }
          throw err;
        }
      } else {
        return commitBatchToCache(operations);
      }
    }
  };
}

async function commitBatchToCache(operations: any[]) {
  const res = await fetch('/api/db/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operations })
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return { success: true };
}

export function arrayUnion(...elements: any[]) {
  return realFS.arrayUnion(...elements);
}

export function arrayRemove(...elements: any[]) {
  return realFS.arrayRemove(...elements);
}

export function serverTimestamp() {
  return realFS.serverTimestamp();
}

export function onSnapshot(queryOrRef: any, onNext: any, onError?: any) {
  if (activeDbMode === 'real') {
    try {
      const realRef = mapToRealRef(queryOrRef);
      const unsubscribe = realFS.onSnapshot(realRef, (snapshot: any) => {
        const isDoc = queryOrRef && queryOrRef.type === 'document';
        if (isDoc) {
          const s = String(queryOrRef.path || '').split('/');
          const collectionName = s[0] || '';
          const id = s.slice(1).join('/') || queryOrRef.id || '';
          if (collectionName && id) {
            cacheSingleDocFromServer(collectionName, id, snapshot);
          }
          onNext(new MockDocumentSnapshot(snapshot.id, snapshot.data(), { id: snapshot.id, path: snapshot.ref?.path || queryOrRef.path }));
        } else {
          const collName = queryOrRef.type === 'query' 
            ? queryOrRef.collectionName 
            : queryOrRef.path;
          if (collName) {
            cacheDocsFromServer(collName, snapshot);
          }
          onNext(mapToMockQuerySnapshot(snapshot));
        }
      }, (err) => {
        console.warn("[Database Proxy] Subscriptions error, shifting to local poll:", err);
        if (isQuotaOrPermissionError(err)) {
          setDbMode('local_cached');
          fallbackOnSnapshotPoll(queryOrRef, onNext);
        } else if (onError) {
          onError(err);
        }
      });
      return unsubscribe;
    } catch (err: any) {
      console.warn("[Database Proxy] subscription registration failed, shifting:", err);
      if (isQuotaOrPermissionError(err)) {
        setDbMode('local_cached');
        return fallbackOnSnapshotPoll(queryOrRef, onNext);
      }
      throw err;
    }
  } else {
    return fallbackOnSnapshotPoll(queryOrRef, onNext);
  }
}

// Bulk sync manager to hydrate local Express json database from live Firestore using an authorized client
export async function syncDbFromCloud(progressCallback?: (msg: string) => void): Promise<{ success: boolean; count: number; error?: any }> {
  const collections = [
    'users', 'classes', 'attendance', 'fees', 'feeConfigs', 
    'timetable', 'exams', 'marks', 'chats', 'notifications', 
    'fee_balances', 'units', 'settings', 'submissions', 'admissions', 
    'school_calendar', 'grades', 'expenses'
  ];
  
  if (progressCallback) progressCallback("Starting safe Cloud-to-Local Cache Sync...");
  
  try {
    const collectionsData: Record<string, any> = {};
    let totalCount = 0;
    
    for (const colName of collections) {
      if (progressCallback) progressCallback(`Exporting "${colName}"...`);
      try {
        const colRef = realFS.collection(realDb, colName);
        const snap = await realFS.getDocs(colRef);
        
        collectionsData[colName] = {};
        snap.docs.forEach(docSnap => {
          collectionsData[colName][docSnap.id] = docSnap.data();
          totalCount++;
        });
      } catch (err: any) {
        console.warn(`[Sync Manager] Error reading collection "${colName}":`, err);
      }
    }
    
    if (progressCallback) progressCallback(`Caching ${totalCount} documents locally...`);
    const res = await fetch('/api/db/bulk-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionsData })
    });
    
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    
    // Auto restore to real mode on successful contact with remote DB
    setDbMode('real');
    
    if (progressCallback) progressCallback(`Done! Synced ${totalCount} documents securely.`);
    return { success: true, count: totalCount };
    
  } catch (err: any) {
    console.error("[Sync Manager] Full database sync failed:", err);
    if (progressCallback) progressCallback("Sync failed. Firestore server or local proxy unreachable.");
    return { success: false, count: 0, error: err };
  }
}

function fallbackOnSnapshotPoll(queryOrRef: any, callback: any) {
  let active = true;
  const isDocument = queryOrRef.type === 'document';
  const collectionName = queryOrRef.type === 'query' 
    ? queryOrRef.collectionName 
    : isDocument 
      ? queryOrRef.collection 
      : queryOrRef.path;

  const run = async () => {
    if (!active) return;
    try {
      if (isDocument) {
        const snap = await fetchDocFromCache(queryOrRef);
        callback(snap);
      } else {
        const snap = await fetchDocsFromCache(queryOrRef);
        callback(snap);
      }
    } catch (e) {
      console.error("onSnapshot fallback poll error:", e);
    }
  };
  
  run();

  const interval = collectionName === 'messages' || collectionName === 'whatsapp_messages' || collectionName === 'chats'
    ? 3000
    : (collectionName === 'notifications' || collectionName === 'attendance')
      ? 10000
      : 30000;

  const timer = setInterval(run, interval);
  return () => {
    active = false;
    clearInterval(timer);
  };
}
