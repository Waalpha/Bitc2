import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, db, handleFirestoreError, OperationType, isFirebaseReady } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp, query, collection, where } from 'firebase/firestore';
import { AppSettings, FeeBalance, School } from '../types';

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
  schools: School[];
  activeSchoolId: string;
  setActiveSchoolId: (schoolId: string) => void;
  loginAsDemoUser?: (uid: string, profile: any) => void;
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
  schools: [],
  activeSchoolId: 'bitc',
  setActiveSchoolId: () => {},
  loginAsDemoUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [demoUserUid, setDemoUserUid] = useState<string | null>(() => localStorage.getItem('demo_user_uid'));
  const [userData, setUserData] = useState<any | null>(null);
  const [childrenList, setChildrenList] = useState<any[]>([]);
  const [activeStudentUid, setActiveStudentUid] = useState<string | null>(null);
  const [activeStudent, setActiveStudent] = useState<any | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [activeSchoolId, setActiveSchoolIdState] = useState<string>(() => localStorage.getItem('active_school_id') || 'bitc');
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

  const setActiveSchoolId = useCallback((id: string) => {
    setActiveSchoolIdState(id);
    localStorage.setItem('active_school_id', id);
  }, []);

  // Sync / Subscribe to Schools list
  useEffect(() => {
    if (!isFirebaseReady) return;

    // Standard school bootstrap if firestore empty
    const initDefaultSchool = async () => {
      try {
        const { getDocs, setDoc, doc, collection } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'schools'));
        if (snap.empty) {
          await setDoc(doc(db, 'schools', 'bitc'), {
            id: 'bitc',
            name: 'Breakthrough International Training College (BITC)',
            appTitle: 'BITC',
            createdAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error("Error bootstrapping default school:", err);
      }
    };
    initDefaultSchool();

    const unsubSchools = onSnapshot(collection(db, 'schools'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as School));
      setSchools(list);
    }, (err) => {
      console.error("Error syncing schools list:", err);
    });

    return () => unsubSchools();
  }, []);

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

  // Handle active school settings subscription
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

    const isDefault = activeSchoolId === 'bitc';
    const activeSettingsKey = isDefault ? 'global' : activeSchoolId;
    const globalRef = doc(db, 'settings', activeSettingsKey);
    const heroLegacyRef = doc(db, 'settings', isDefault ? 'hero_legacy' : `${activeSchoolId}_hero_legacy`);
    const galleryRef = doc(db, 'settings', isDefault ? 'gallery' : `${activeSchoolId}_gallery`);

    const subs = [
      onSnapshot(globalRef, (snap) => {
        if (snap.exists()) {
          setSettings(prev => ({ ...prev, ...snap.data() } as AppSettings));
        } else {
          // Standard defaults fallback
          setSettings({
            appTitle: activeSchoolId.toUpperCase() === 'BITC' ? 'BITC' : activeSchoolId.charAt(0).toUpperCase() + activeSchoolId.slice(1).toLowerCase(),
            fontFamily: 'Inter',
            fontSize: '16px',
            textAlign: 'left',
            activeSession: '2024/2025 Semester 1',
            publicHeroImages: [],
            portalGallery: []
          });
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, `settings/${activeSettingsKey}`)),
      
      onSnapshot(heroLegacyRef, (snap) => {
        if (snap.exists()) {
          setSettings(prev => ({ ...prev, publicHeroImages: snap.data().images || [] } as AppSettings));
        }
      }, (err) => console.log(`No custom hero legacy for school ${activeSchoolId}`)),

      onSnapshot(galleryRef, (snap) => {
        if (snap.exists()) {
          setSettings(prev => ({ ...prev, portalGallery: snap.data().images || [] } as AppSettings));
        }
      }, (err) => console.log(`No custom gallery for school ${activeSchoolId}`))
    ];

    if (demoUserUid) {
      const cachedProfile = localStorage.getItem('demo_user_profile');
      let displayName = 'Demo User';
      let email = 'demo@school.com';
      if (cachedProfile) {
        try {
          const parsed = JSON.parse(cachedProfile);
          displayName = parsed.name || displayName;
          email = parsed.email || email;
        } catch (_) {}
      }

      setUser({
        uid: demoUserUid,
        email: email,
        displayName: displayName,
        photoURL: null,
      } as any);
      setLoading(false);
      setIsAuthReady(true);

      return () => {
        subs.forEach(unsub => unsub());
      };
    }

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
  }, [activeSchoolId, demoUserUid]);

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
        
        // Lock activeSchoolId for non-admins to their assigned school
        if (data.role !== 'admin' && data.schoolId) {
          setActiveSchoolIdState(data.schoolId);
          localStorage.setItem('active_school_id', data.schoolId);
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
              if (data.role === 'admin') setPermissions(['manage_users', 'manage_classes', 'manage_units', 'manage_exams', 'mark_attendance', 'view_reports', 'system_settings', 'view_students', 'manage_fees', 'view_finance', 'manage_timetable', 'manage_whatsapp', 'manage_chat', 'student_admission', 'manage_marks', 'view_results']);
              else if (data.role === 'teacher') setPermissions(['manage_units', 'manage_exams', 'view_students', 'manage_timetable', 'manage_chat', 'manage_whatsapp', 'manage_marks', 'view_results']);
              else if (data.role === 'registrar') setPermissions(['view_students', 'student_admission', 'manage_classes', 'manage_units', 'manage_timetable']);
              else if (data.role === 'finance') setPermissions(['manage_fees', 'view_finance', 'view_reports']);
              else if (data.role === 'staff') setPermissions(['view_students', 'manage_timetable']);
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

  // Auto-migrate map embed URL if it is the old coordinate or empty
  useEffect(() => {
    if (!isFirebaseReady || !user || !userData || !settings) return;
    if (userData.role !== 'admin' && userData.role !== 'developer') return;

    const isDefault = activeSchoolId === 'bitc';
    const activeSettingsKey = isDefault ? 'global' : activeSchoolId;

    const oldEmbedUrl = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15956.230743516568!2d37.070000!3d-1.033333!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182f4e0000000000%3A0x0000000000000000!2sBreakthrough+International+Training+College!5e0!3m2!1sen!2ske!4v1714988426000!5m2!1sen!2ske';
    const mtKenyaEmbedUrl = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.956041121345!2d37.081498!3d-1.045059!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182f4e0c4f87770f%3A0x6bba35bc40ebf5bf!2smt.kenya%20soccer%20pitch%2C%20General%20Kago%20Rd%2C%20Thika!5e0!3m2!1sen!2ske!4v1781197480024!5m2!1sen!2ske';
    const kiganjoEmbedUrl = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3989.118404095059!2d37.09775020000001!3d-1.0732241999999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182f4fbf02a24a19%3A0x462a484c79a9d615!2sBreakthrough%20International%20Training%20College%2C%20Kiganjo!5e0!3m2!1sen!2ske!4v1781197480024!5m2!1sen!2ske';

    if (settings.publicLocationEmbed === oldEmbedUrl || settings.publicLocationEmbed === mtKenyaEmbedUrl) {
      console.log("Migrating map embed URL to Kiganjo breakthrough campus...");
      const globalRef = doc(db, 'settings', activeSettingsKey);
      updateDoc(globalRef, {
        publicLocationEmbed: kiganjoEmbedUrl,
        publicAddress: 'Thika Kiganjo Corner 2, Kenya'
      }).catch(err => console.error("Could not run map migration check:", err));
    }
  }, [isFirebaseReady, user, userData, settings, activeSchoolId]);

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

  const loginAsDemoUser = useCallback((uid: string, profile: any) => {
    localStorage.setItem('demo_user_uid', uid);
    localStorage.setItem('demo_user_profile', JSON.stringify(profile));
    setDemoUserUid(uid);
    setUser({
      uid,
      email: profile.email || 'demo@school.com',
      displayName: profile.name || 'Demo User',
      photoURL: profile.photoUrl || null,
    } as any);
  }, []);

  const logout = async () => {
    localStorage.removeItem('demo_user_uid');
    localStorage.removeItem('demo_user_profile');
    setDemoUserUid(null);
    if (auth) {
      await auth.signOut();
    }
    setUser(null);
    setUserData(null);
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
      setActiveStudentByUid,
      schools,
      activeSchoolId,
      setActiveSchoolId,
      loginAsDemoUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};
