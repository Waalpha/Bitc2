import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  children: any[];
  activeStudent: any | null;
  activeStudentUid: string | null;
  studentContext: any | null;
  setActiveStudentByUid: (uid: string) => void;
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
  children: [],
  activeStudent: null,
  activeStudentUid: null,
  studentContext: null,
  setActiveStudentByUid: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [childrenList, setChildrenList] = useState<any[]>([]);
  const [activeStudentUid, setActiveStudentUid] = useState<string | null>(null);
  const [activeStudent, setActiveStudent] = useState<any | null>(null);
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

  // Synchronize user settings and roles
  useEffect(() => {
    if (!isFirebaseReady || !user) return;

    let unsubRole: (() => void) | null = null;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.role) data.role = data.role.toLowerCase();
        setUserData(data);
        
        // Fetch permissions for the user's role
        if (data.role) {
          const roleRef = doc(db, 'roles', data.role);
          if (unsubRole) unsubRole();
          unsubRole = onSnapshot(roleRef, (roleSnap) => {
            if (roleSnap.exists()) {
              setPermissions(roleSnap.data().permissions || []);
            } else {
              // Fallback for system roles if roles collection not yet populated
              if (data.role === 'admin') setPermissions(['manage_users', 'manage_classes', 'manage_units', 'manage_exams', 'mark_attendance', 'view_reports', 'system_settings', 'view_students', 'manage_fees', 'view_finance', 'manage_timetable', 'manage_whatsapp', 'manage_chat', 'student_admission', 'manage_marks', 'view_results']);
              else if (data.role === 'teacher') setPermissions(['manage_units', 'manage_exams', 'mark_attendance', 'view_students', 'manage_timetable', 'manage_chat', 'manage_whatsapp', 'manage_marks', 'view_results']);
              else if (data.role === 'registrar') setPermissions(['view_students', 'student_admission', 'manage_classes', 'manage_units', 'manage_timetable']);
              else if (data.role === 'finance') setPermissions(['manage_fees', 'view_finance', 'view_reports']);
              else if (data.role === 'staff') setPermissions(['view_students', 'mark_attendance', 'manage_timetable']);
              else if (data.role === 'parent') setPermissions(['view_results', 'view_reports']);
              else if (data.role === 'student') setPermissions(['view_results']);
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
        console.error("Auth profile sync error:", e);
      }
    });
    return () => {
      unsubscribeUser();
      if (unsubRole) unsubRole();
    };
  }, [user]);

  // Sync children list if logged in user is a parent
  useEffect(() => {
    if (!isFirebaseReady || !user || !userData || userData.role !== 'parent') {
      setChildrenList([]);
      setActiveStudentUid(null);
      setActiveStudent(null);
      return;
    }

    const studentsQ = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubStudents = onSnapshot(studentsQ, (snap) => {
      const parentEmail = (user.email || '').toLowerCase().trim();
      const parentPhone = (userData.phone || '').toLowerCase().trim();
      const parentName = (userData.name || '').toLowerCase().trim();
      const manuallyLinkedUids = userData.childrenUids || [];

      const filtered = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as any))
        .filter(student => {
          if (manuallyLinkedUids.includes(student.uid)) return true;

          const gEmail = (student.guardianEmail || '').toLowerCase().trim();
          const gPhone = (student.guardianPhone || '').toLowerCase().trim();
          const fPhone = (student.fatherPhone || '').toLowerCase().trim();
          const mPhone = (student.motherPhone || '').toLowerCase().trim();
          const gName = (student.guardianName || '').toLowerCase().trim();
          const fName = (student.fatherName || '').toLowerCase().trim();
          const mName = (student.motherName || '').toLowerCase().trim();

          const emailMatch = parentEmail && gEmail === parentEmail;
          const phoneMatch = parentPhone && (gPhone === parentPhone || fPhone === parentPhone || mPhone === parentPhone);
          const nameMatch = parentName && (gName === parentName || fName === parentName || mName === parentName);

          return emailMatch || phoneMatch || nameMatch;
        });

      setChildrenList(filtered);
      
      if (filtered.length > 0) {
        // If current selection is not in list, fallback to first
        if (!activeStudentUid || !filtered.some(c => c.uid === activeStudentUid)) {
          setActiveStudentUid(filtered[0].uid);
          setActiveStudent(filtered[0]);
        } else {
          const current = filtered.find(c => c.uid === activeStudentUid);
          setActiveStudent(current || null);
        }
      } else {
        setActiveStudentUid(null);
        setActiveStudent(null);
      }
    }, (error) => {
      console.error("Parent children sync error:", error);
    });

    return () => {
      unsubStudents();
    };
  }, [user, userData, activeStudentUid]);

  // Sync fee balance for a student or selected active child
  useEffect(() => {
    if (!isFirebaseReady || !user) {
      setFeeBalance(null);
      return;
    }
    const targetUid = userData?.role === 'student' ? user.uid : activeStudent?.uid;
    if (!targetUid) {
      setFeeBalance(null);
      return;
    }

    const feesQ = query(collection(db, 'fees'), where('studentId', '==', targetUid));
    const unsubFeesGlobal = onSnapshot(feesQ, (snap) => {
      if (!snap.empty) {
        setFeeBalance({ id: snap.docs[0].id, ...snap.docs[0].data() } as FeeBalance);
      } else {
        setFeeBalance(null);
      }
    }, (error) => {
      console.error("Context fee balance sync error:", error);
    });

    return () => unsubFeesGlobal();
  }, [user, userData?.role, activeStudent?.uid]);

  const setActiveStudentByUid = useCallback((uid: string) => {
    setActiveStudentUid(uid);
    const found = childrenList.find(c => c.uid === uid);
    if (found) {
      setActiveStudent(found);
    }
  }, [childrenList]);

  const studentContext = userData?.role === 'student' ? userData : activeStudent;

  const hasPermission = useCallback((permission: string) => {
    if (userData?.role === 'admin') return true;
    return permissions.includes(permission);
  }, [userData?.role, permissions]);

  const logout = async () => {
    if (auth) {
      await auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userData, 
      settings, 
      permissions, 
      loading, 
      isAuthReady, 
      hasPermission, 
      logout, 
      feeBalance,
      children: childrenList,
      activeStudent,
      activeStudentUid,
      studentContext,
      setActiveStudentByUid
    }}>
      {children}
    </AuthContext.Provider>
  );
};
