import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType, isFirebaseReady } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp, query, collection, where } from 'firebase/firestore';
import { AppSettings, FeeBalance } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  userData: any | null;
  settings: AppSettings | null;
  permissions: string[];
  loading: boolean;
  isAuthReady: boolean;
  hasPermission: (permission: string) => boolean;
  logout: () => Promise<void>;
  feeBalance: FeeBalance | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  settings: null,
  permissions: [],
  loading: true,
  isAuthReady: false,
  hasPermission: () => false,
  logout: async () => {},
  feeBalance: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>({
    appTitle: 'BITC',
    fontFamily: 'Inter',
    fontSize: '16px',
    textAlign: 'left',
    activeSession: '2024/2025 Semester 1',
    publicHeroImages: [],
    portalGallery: []
  });
  const [permissions, setPermissions] = useState<string[]>([]);
  const [feeBalance, setFeeBalance] = useState<FeeBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Heartbeat for presence
  useEffect(() => {
    if (!isFirebaseReady || !user) return;

    const updatePresence = async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          lastActive: new Date().toISOString()
        });
      } catch (error) {
        // Silent fail for heartbeat
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 60000); // Pulse every minute

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!isFirebaseReady) {
      setLoading(false);
      setIsAuthReady(true);
      setSettings({
        appTitle: 'BITC',
        fontFamily: 'Inter',
        fontSize: '16px',
        textAlign: 'left',
        activeSession: '2024/2025 Semester 1'
      });
      return;
    }

    // Fetch split global settings
    const globalRef = doc(db, 'settings', 'global');
    const heroLegacyRef = doc(db, 'settings', 'hero_legacy');
    const heroSlidesRef = doc(db, 'settings', 'hero_slides');
    const galleryRef = doc(db, 'settings', 'gallery');

    const subs = [
      onSnapshot(globalRef, (snap) => {
        if (snap.exists()) {
          setSettings(prev => ({ ...prev, ...snap.data() } as AppSettings));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/global')),
      
      onSnapshot(heroLegacyRef, (snap) => {
        if (snap.exists()) {
          setSettings(prev => ({ ...prev, publicHeroImages: snap.data().images || [] } as AppSettings));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/hero_legacy')),

      onSnapshot(heroSlidesRef, (snap) => {
        if (snap.exists()) {
          setSettings(prev => ({ ...prev, publicHeroSlides: snap.data().slides || [] } as AppSettings));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/hero_slides')),

      onSnapshot(galleryRef, (snap) => {
        if (snap.exists()) {
          setSettings(prev => ({ ...prev, portalGallery: snap.data().images || [] } as AppSettings));
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/gallery'))
    ];

    const unsubscribeAuth = auth?.onAuthStateChanged ? onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setUserData(null);
        setLoading(false);
        setIsAuthReady(true);
      }
    }) : () => {};

    return () => {
      subs.forEach(unsub => unsub());
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (!isFirebaseReady || !user) return;

    let unsubRole: (() => void) | null = null;
    let unsubFees: (() => void) | null = null;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.role) data.role = data.role.toLowerCase();
        setUserData(data);
        
        const role = data.role;
        // Fetch fee balance for students
        if (role === 'student' && !unsubFees) {
          const feesQ = query(collection(db, 'fees'), where('studentId', '==', user.uid));
          unsubFees = onSnapshot(feesQ, (snap) => {
            if (!snap.empty) {
              setFeeBalance({ id: snap.docs[0].id, ...snap.docs[0].data() } as FeeBalance);
            } else {
              setFeeBalance(null);
            }
          }, (error) => {
            console.error("Fee sync error:", error);
          });
        }
        
        // Fetch permissions for the user's role
        if (data.role) {
          const roleRef = doc(db, 'roles', data.role);
          if (unsubRole) unsubRole();
          unsubRole = onSnapshot(roleRef, (roleSnap) => {
            if (roleSnap.exists()) {
              setPermissions(roleSnap.data().permissions || []);
            } else {
              // Fallback for system roles if roles collection not yet populated
              if (data.role === 'admin') setPermissions(['manage_users', 'manage_classes', 'manage_units', 'manage_exams', 'mark_attendance', 'view_reports', 'system_settings', 'view_students', 'manage_fees', 'view_finance']);
              else if (data.role === 'teacher') setPermissions(['manage_units', 'manage_exams', 'mark_attendance', 'view_students']);
              else setPermissions([]);
            }
          }, (error) => {
            try {
              handleFirestoreError(error, OperationType.GET, `roles/${data.role}`);
            } catch (e) {
              console.error("Role sync error:", e);
            }
          });
        }
      } else {
        setUserData(null);
        setPermissions([]);
      }
      setLoading(false);
      setIsAuthReady(true);
    }, (error) => {
      setLoading(false);
      setIsAuthReady(true);
      try {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      } catch (e) {
        // Error is logged by handleFirestoreError, we catch it here to prevent crashing the provider
        console.error("Auth profile sync error:", e);
      }
    });
    return () => {
      unsubscribeUser();
      if (unsubRole) unsubRole();
      if (unsubFees) unsubFees();
    };
  }, [user]);

  const hasPermission = (permission: string) => {
    if (userData?.role === 'admin') return true;
    return permissions.includes(permission);
  };

  const logout = async () => {
    if (auth) {
      await auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, settings, permissions, loading, isAuthReady, hasPermission, logout, feeBalance }}>
      {children}
    </AuthContext.Provider>
  );
};
