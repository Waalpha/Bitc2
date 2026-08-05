import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  DocumentData,
  QueryConstraint,
  Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseReady } from '../firebase';
import { FirestoreError } from '../lib/errors';

export interface PaginationOptions {
  pageSize?: number;
  lastDoc?: any;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: any;
  hasMore: boolean;
}

export class BaseRepository<T extends { id?: string; schoolId?: string }> {
  protected collectionName: string;
  private cache = new Map<string, { data: T; timestamp: number }>();
  private listCache = new Map<string, { data: T[]; timestamp: number }>();
  private cacheTTL = 60 * 1000; // 1 minute in-memory cache TTL

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  protected getCollectionRef() {
    return collection(db, this.collectionName);
  }

  protected getDocRef(id: string) {
    return doc(db, this.collectionName, id);
  }

  public clearCache(): void {
    this.cache.clear();
    this.listCache.clear();
  }

  async findById(id: string): Promise<T | null> {
    const cached = this.cache.get(id);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      if (!isFirebaseReady) return null;
      const docSnap = await getDoc(this.getDocRef(id));
      if (!docSnap.exists()) return null;

      const item = { id: docSnap.id, ...docSnap.data() } as T;
      this.cache.set(id, { data: item, timestamp: Date.now() });
      return item;
    } catch (err: any) {
      throw new FirestoreError(`Failed to fetch ${this.collectionName} with ID ${id}: ${err.message}`, this.collectionName, 'findById');
    }
  }

  async findAll(schoolId?: string, extraConstraints: QueryConstraint[] = []): Promise<T[]> {
    const cacheKey = `${schoolId || 'all'}_${extraConstraints.length}`;
    const cached = this.listCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      if (!isFirebaseReady) return [];
      const constraints: QueryConstraint[] = [];
      if (schoolId) {
        constraints.push(where('schoolId', '==', schoolId));
      }
      constraints.push(...extraConstraints);

      const q = constraints.length > 0
        ? query(this.getCollectionRef(), ...constraints)
        : this.getCollectionRef();

      const snapshot = await getDocs(q);
      const results: T[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));

      this.listCache.set(cacheKey, { data: results, timestamp: Date.now() });
      return results;
    } catch (err: any) {
      throw new FirestoreError(`Failed to query ${this.collectionName}: ${err.message}`, this.collectionName, 'findAll');
    }
  }

  async create(data: Omit<T, 'id'>, customId?: string): Promise<T> {
    try {
      if (!isFirebaseReady) {
        const id = customId || `mock_${Date.now()}`;
        return { id, ...data } as T;
      }

      this.clearCache();
      if (customId) {
        const docRef = this.getDocRef(customId);
        await setDoc(docRef, { ...data, createdAt: new Date().toISOString() });
        return { id: customId, ...data } as T;
      } else {
        const docRef = await addDoc(this.getCollectionRef(), {
          ...data,
          createdAt: new Date().toISOString(),
        });
        return { id: docRef.id, ...data } as T;
      }
    } catch (err: any) {
      throw new FirestoreError(`Failed to create ${this.collectionName}: ${err.message}`, this.collectionName, 'create');
    }
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    try {
      this.clearCache();
      if (!isFirebaseReady) return;

      const docRef = this.getDocRef(id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString(),
      } as DocumentData);
    } catch (err: any) {
      throw new FirestoreError(`Failed to update ${this.collectionName} ${id}: ${err.message}`, this.collectionName, 'update');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      this.clearCache();
      if (!isFirebaseReady) return;

      const docRef = this.getDocRef(id);
      await deleteDoc(docRef);
    } catch (err: any) {
      throw new FirestoreError(`Failed to delete ${this.collectionName} ${id}: ${err.message}`, this.collectionName, 'delete');
    }
  }

  async search(field: keyof T & string, searchTerm: string, schoolId?: string): Promise<T[]> {
    const all = await this.findAll(schoolId);
    const term = searchTerm.toLowerCase().trim();
    if (!term) return all;

    return all.filter(item => {
      const val = item[field];
      return typeof val === 'string' && val.toLowerCase().includes(term);
    });
  }

  async paginate(
    schoolId?: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T>> {
    const {
      pageSize = 20,
      lastDoc = null,
      orderByField = 'createdAt',
      orderDirection = 'desc',
    } = options;

    try {
      if (!isFirebaseReady) {
        return { data: [], lastDoc: null, hasMore: false };
      }

      const constraints: QueryConstraint[] = [];
      if (schoolId) {
        constraints.push(where('schoolId', '==', schoolId));
      }

      constraints.push(orderBy(orderByField, orderDirection));

      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      constraints.push(limit(pageSize + 1));

      const q = query(this.getCollectionRef(), ...constraints);
      const snapshot = await getDocs(q);

      const hasMore = snapshot.docs.length > pageSize;
      const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

      const data: T[] = docs.map(d => ({ id: d.id, ...d.data() } as T));
      const nextLastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

      return { data, lastDoc: nextLastDoc, hasMore };
    } catch (err: any) {
      throw new FirestoreError(`Failed to paginate ${this.collectionName}: ${err.message}`, this.collectionName, 'paginate');
    }
  }

  listen(
    schoolId: string | undefined,
    onData: (items: T[]) => void,
    onError?: (error: Error) => void,
    extraConstraints: QueryConstraint[] = []
  ): Unsubscribe {
    if (!isFirebaseReady) {
      onData([]);
      return () => {};
    }

    const constraints: QueryConstraint[] = [];
    if (schoolId) {
      constraints.push(where('schoolId', '==', schoolId));
    }
    constraints.push(...extraConstraints);

    const q = constraints.length > 0
      ? query(this.getCollectionRef(), ...constraints)
      : this.getCollectionRef();

    return onSnapshot(
      q,
      (snapshot) => {
        const results: T[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
        this.clearCache();
        onData(results);
      },
      (err) => {
        if (onError) onError(new FirestoreError(`Live listener error on ${this.collectionName}: ${err.message}`, this.collectionName, 'listen'));
      }
    );
  }
}
