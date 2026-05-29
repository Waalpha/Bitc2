import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, enableIndexedDbPersistence } from '@firebase/firestore';
import { doc, getDocFromServer } from '@firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const isConfigValid = firebaseConfig.apiKey && firebaseConfig.projectId;
export const isFirebaseReady = isConfigValid;

const app = isConfigValid ? initializeApp(firebaseConfig) : null;
export const auth = isConfigValid ? getAuth(app!) : ({} as any);

// Use initializeFirestore to force long polling, helping with proxy issues
export const db = isConfigValid 
  ? initializeFirestore(app!, {
      experimentalForceLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId) 
  : ({} as any);

// Enable persistence
if (isConfigValid && typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a a time.
        console.warn('Firestore persistence failed: failed-precondition');
    } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore persistence failed: unimplemented');
    }
  });
}

export const messaging = isConfigValid && typeof window !== 'undefined' ? getMessaging(app!) : null;

if (!isConfigValid) {
  console.warn("Firebase configuration is missing or invalid. Please check the Firebase Setup UI.");
} else {
  // Test connection to Firestore
  const testConnection = async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('the client is offline')) {
          console.error("Firestore Error: The client is offline. This usually means the Firestore Database has not been created in the Firebase Console, the configuration is incorrect, or the project is disabled.");
        } else {
          console.error("Firestore Test connection failed:", error.message);
        }
      }
    }
  };
  testConnection();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default app;
