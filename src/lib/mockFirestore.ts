// Mock Firestore SDK implementation routing requests to Express backend REST API

export function initializeFirestore(app: any, settings: any, databaseId?: string) {
  return { type: 'firestore' };
}

export function enableIndexedDbPersistence(db: any) {
  return Promise.resolve();
}

export class MockDocumentSnapshot {
  id: string;
  _data: any;
  constructor(id: string, data: any) {
    this.id = id;
    this._data = data;
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
}

export function collection(db: any, path: string) {
  return { type: 'collection', path };
}

export function doc(dbOrCol: any, pathOrId: string, ...additionalPaths: string[]) {
  let fullPath = "";
  if (dbOrCol && dbOrCol.type === 'collection') {
    fullPath = [dbOrCol.path, pathOrId, ...additionalPaths].filter(Boolean).join('/');
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

// Support doc(db, 'collection', 'id') style
export function getDocFromServer(docRef: any) {
  return getDoc(docRef);
}

export async function getDoc(docRef: any) {
  try {
    const res = await fetch(`/api/db/get?collection=${docRef.collection || docRef.path}&id=${docRef.id}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    return new MockDocumentSnapshot(docRef.id, json.data);
  } catch (err) {
    console.error("mockFirestore getDoc failed:", err);
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
    const json = await res.json();
    const docs = (json.docs || []).map((d: any) => new MockDocumentSnapshot(d.id, d.data));
    return new MockQuerySnapshot(docs);
  } catch (err) {
    console.error("mockFirestore getDocs failed:", err);
    return new MockQuerySnapshot([]);
  }
}

export async function addDoc(collectionRef: any, data: any) {
  try {
    const res = await fetch('/api/db/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: collectionRef.path, data })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    return { id: json.id };
  } catch (err) {
    console.error("mockFirestore addDoc failed:", err);
    throw err;
  }
}

export async function updateDoc(docRef: any, data: any) {
  try {
    const targetId = docRef.id;
    const collectionName = docRef.collection || docRef.path;

    const res = await fetch('/api/db/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: collectionName, id: targetId, data })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return { success: true };
  } catch (err) {
    console.error("mockFirestore updateDoc failed:", err);
    throw err;
  }
}

export async function setDoc(docRef: any, data: any, options?: any) {
  try {
    const targetId = docRef.id;
    const collectionName = docRef.collection || docRef.path;

    const res = await fetch('/api/db/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: collectionName, id: targetId, data, options })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return { success: true };
  } catch (err) {
    console.error("mockFirestore setDoc failed:", err);
    throw err;
  }
}

export async function deleteDoc(docRef: any) {
  try {
    const targetId = docRef.id;
    const collectionName = docRef.collection || docRef.path;

    const res = await fetch('/api/db/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: collectionName, id: targetId })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return { success: true };
  } catch (err) {
    console.error("mockFirestore deleteDoc failed:", err);
    throw err;
  }
}

export function writeBatch() {
  const operations: any[] = [];
  return {
    set(docRef: any, data: any, options?: any) {
      operations.push({
        type: 'set',
        collection: docRef.collection || docRef.path,
        id: docRef.id,
        data,
        options
      });
    },
    update(docRef: any, data: any) {
      operations.push({
        type: 'update',
        collection: docRef.collection || docRef.path,
        id: docRef.id,
        data
      });
    },
    delete(docRef: any) {
      operations.push({
        type: 'delete',
        collection: docRef.collection || docRef.path,
        id: docRef.id
      });
    },
    async commit() {
      try {
        const res = await fetch('/api/db/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operations })
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return { success: true };
      } catch (err) {
        console.error("mockFirestore batch commit failed:", err);
        throw err;
      }
    }
  };
}

export function arrayUnion(...elements: any[]) {
  return { _type: 'arrayUnion', elements };
}

export function arrayRemove(...elements: any[]) {
  return { _type: 'arrayRemove', elements };
}

export function serverTimestamp() {
  return { _type: 'serverTimestamp' };
}

export function onSnapshot(queryOrRef: any, callback: any) {
  let active = true;
  const isQuery = queryOrRef.type === 'query';
  const isDocument = queryOrRef.type === 'document';
  const collectionName = isQuery 
    ? queryOrRef.collectionName 
    : isDocument 
      ? (queryOrRef.collection || queryOrRef.path) 
      : queryOrRef.path;

  const run = async () => {
    if (!active) return;
    try {
      if (isDocument) {
        const snap = await getDoc(queryOrRef);
        callback(snap);
      } else {
        const snap = await getDocs(queryOrRef);
        callback(snap);
      }
    } catch (e) {
      console.error("onSnapshot poll error:", e);
    }
  };
  
  run();

  // Smart polling interval to avoid burning cpu while maintaining great interactivity
  const interval = collectionName === 'messages' || collectionName === 'whatsapp_messages' || collectionName === 'chats'
    ? 3000 // 3 seconds for messages
    : (collectionName === 'notifications' || collectionName === 'attendance')
      ? 10000 // 10 seconds for attendance and notifications
      : 30000; // 30 seconds for rest (classes, fees, etc.)

  const timer = setInterval(run, interval);
  return () => {
    active = false;
    clearInterval(timer);
  };
}
