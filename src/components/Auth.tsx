import React, { useState, useEffect } from 'react';
import { auth, db, isFirebaseReady } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { LogOut, Loader2, ShieldCheck, GraduationCap, Briefcase } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { motion } from 'motion/react';

export const Auth: React.FC = () => {
  const { user: authUser, userData, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'admin'>('student');

  useEffect(() => {
    if (isAuthReady && authUser && userData) {
      if (location.pathname === '/auth') {
        const fallback = userData.role === 'student' ? '/results' : '/dashboard';
        navigate(fallback, { replace: true });
      }
    }
  }, [authUser, userData, isAuthReady, navigate, location.pathname]);

  const handleGoogleLogin = async (role: 'student' | 'teacher' | 'admin') => {
    if (!isFirebaseReady) {
      setError("Firebase is not yet configured.");
      return;
    }

    setError(null);
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user) throw new Error("No user found after login attempt.");

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      let existingData = userDoc.exists() ? userDoc.data() : null;

      // Migrate existing registration profiles with a randomized admission UID to their final Google Auth UID
      if (!existingData || !existingData.role) {
        const userEmail = user.email?.toLowerCase().trim() || '';
        const q = query(collection(db, 'users'), where('email', '==', userEmail));
        const qSnap = await getDocs(q);

        let matchedData: any = null;
        let oldDocId: string | null = null;

        for (const d of qSnap.docs) {
          if (d.id !== user.uid) {
            if (!matchedData) {
              matchedData = d.data();
              oldDocId = d.id;
            } else {
              // Delete additional redundant duplicates if the database is in a dirty state
              try {
                await deleteDoc(doc(db, 'users', d.id));
              } catch (delErr) {
                console.error("Error cleaning redundant user record:", delErr);
              }
            }
          }
        }

        if (oldDocId && matchedData) {
          existingData = {
            ...matchedData,
            name: matchedData.name || user.displayName || 'Anonymous',
            email: user.email,
            uid: user.uid,
            updatedAt: new Date().toISOString()
          };

          // Synchronize registration document to Auth user document location
          await setDoc(userDocRef, existingData, { merge: true });

          // Purge the old, temporary, auto-generated registration document
          try {
            await deleteDoc(doc(db, 'users', oldDocId));
          } catch (delOldErr) {
            console.error("Error removing old pre-registration account:", delOldErr);
          }

          // Cascade-update all relational entities referencing the outdated auto-generated ID
          try {
            const batch = writeBatch(db);
            let docsChanged = 0;

            // 1. Migrate custom fees objects
            const feesSnap = await getDocs(query(collection(db, 'fees'), where('studentId', '==', oldDocId)));
            feesSnap.docs.forEach(fd => {
              batch.update(doc(db, 'fees', fd.id), { studentId: user.uid });
              docsChanged++;
            });

            // 2. Migrate outstanding fee balances
            const feeBalancesSnap = await getDocs(query(collection(db, 'fee_balances'), where('studentId', '==', oldDocId)));
            feeBalancesSnap.docs.forEach(fbd => {
              batch.update(doc(db, 'fee_balances', fbd.id), { studentId: user.uid });
              docsChanged++;
            });

            // 3. Migrate homework and assignment submissions
            const submissionsSnap = await getDocs(query(collection(db, 'submissions'), where('studentId', '==', oldDocId)));
            submissionsSnap.docs.forEach(sd => {
              batch.update(doc(db, 'submissions', sd.id), { studentId: user.uid });
              docsChanged++;
            });

            // 4. Migrate exam attendance logs
            const examAttendSnap = await getDocs(query(collection(db, 'exam_attendance'), where('studentId', '==', oldDocId)));
            examAttendSnap.docs.forEach(ead => {
              batch.update(doc(db, 'exam_attendance', ead.id), { studentId: user.uid });
              docsChanged++;
            });

            // 5. Migrate target notifications
            const notificationsSnap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', oldDocId)));
            notificationsSnap.docs.forEach(nd => {
              batch.update(doc(db, 'notifications', nd.id), { userId: user.uid });
              docsChanged++;
            });

            // 6. Migrate daily classroom attendance records (embedded keys in maps)
            const attendanceSnap = await getDocs(collection(db, 'attendance'));
            attendanceSnap.docs.forEach(ad => {
              const data = ad.data();
              let changed = false;
              const updatedRecords = data.records ? { ...data.records } : {};
              if (updatedRecords[oldDocId as string] !== undefined) {
                updatedRecords[user.uid] = updatedRecords[oldDocId as string];
                delete updatedRecords[oldDocId as string];
                changed = true;
              }
              const updatedBiometricLogs = data.biometricLogs ? { ...data.biometricLogs } : {};
              if (updatedBiometricLogs[oldDocId as string] !== undefined) {
                updatedBiometricLogs[user.uid] = updatedBiometricLogs[oldDocId as string];
                delete updatedBiometricLogs[oldDocId as string];
                changed = true;
              }
              if (changed) {
                batch.update(doc(db, 'attendance', ad.id), {
                  records: updatedRecords,
                  biometricLogs: updatedBiometricLogs
                });
                docsChanged++;
              }
            });

            if (docsChanged > 0) {
              await batch.commit();
            }
            console.log(`Successfully migrated ${docsChanged} references from old UID ${oldDocId} to Google UID ${user.uid}`);
          } catch (cascadeErr) {
            console.error("Error migrating referencing records:", cascadeErr);
          }
        }
      }

      if (!existingData || !existingData.role) {
        const userEmail = user.email?.toLowerCase() || '';
        let finalRole: 'student' | 'teacher' | 'admin' = role;
        
        const adminEmails = ['davmuchiri48@gmail.com', 'daudimuchiri4@gmail.com'];
        
        if (role === 'admin' && !adminEmails.includes(userEmail)) {
          finalRole = 'teacher';
        }
        
        if (adminEmails.includes(userEmail)) {
          finalRole = 'admin';
        }
        
        await setDoc(userDocRef, {
          name: user.displayName || 'Anonymous',
          email: user.email,
          role: finalRole,
          createdAt: new Date().toISOString(),
          uid: user.uid,
        }, { merge: true });
      }
    } catch (err: any) {
      console.error("Google Login error:", err);
      setError(err.message || "Failed to login with Google.");
    } finally {
      setLoading(false);
    }
  };

  const getThemeConfig = () => {
    switch (activeTab) {
      case 'student':
        return {
          bgGradient: 'from-indigo-600 to-indigo-700',
          btnPrimary: 'bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200/50',
          label: 'Student',
          icon: GraduationCap,
          colorClass: 'text-indigo-600'
        };
      case 'teacher':
        return {
          bgGradient: 'from-purple-600 to-purple-700',
          btnPrimary: 'bg-purple-600 hover:bg-purple-700 shadow-xl shadow-purple-200/50',
          label: 'Staff Member',
          icon: Briefcase,
          colorClass: 'text-purple-600'
        };
      case 'admin':
        return {
          bgGradient: 'from-slate-800 to-slate-950',
          btnPrimary: 'bg-slate-900 hover:bg-slate-950 shadow-xl shadow-slate-300/50',
          label: 'Administrator',
          icon: ShieldCheck,
          colorClass: 'text-slate-800'
        };
    }
  };

  const theme = getThemeConfig();
  const ThemeIcon = theme.icon;

  const tabs = [
    { id: 'student' as const, label: 'Student', icon: GraduationCap },
    { id: 'teacher' as const, label: 'Staff / Faculty', icon: Briefcase },
    { id: 'admin' as const, label: 'Administrator', icon: ShieldCheck }
  ];

  const getContainerBg = () => {
    switch (activeTab) {
      case 'student':
        return 'from-indigo-600 via-purple-600 to-pink-500';
      case 'teacher':
        return 'from-purple-600 via-pink-600 to-red-500';
      case 'admin':
        return 'from-slate-900 via-[#1e293b] to-[#0f172a]';
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen relative overflow-hidden px-4 font-sans transition-all duration-1000 bg-gradient-to-tr ${getContainerBg()}`}>
      {/* Spectacular Glowing colorful light leak circles */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-cyan-400/30 blur-[130px] animate-pulse mix-blend-screen pointer-events-none" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-yellow-400/20 blur-[140px] animate-pulse mix-blend-screen pointer-events-none" style={{ animationDuration: '6s', animationDelay: '1.5s' }} />
      <div className="absolute -top-12 -right-12 w-[350px] h-[350px] rounded-full bg-pink-500/30 blur-[110px] pointer-events-none" />

      <motion.div 
        layoutId="authCard"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/95 backdrop-blur-2xl p-8 sm:p-10 rounded-[32px] sm:rounded-[40px] shadow-[0_32px_64px_rgba(0,0,0,0.22)] border border-white/60 max-w-md w-full relative z-10"
      >
        {/* Animated Brand Shield Logo */}
        <div className="flex justify-center mb-6">
          <motion.div 
            key={activeTab}
            initial={{ scale: 0.8, opacity: 0, rotate: -15 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            className={`bg-gradient-to-br ${theme.bgGradient} p-4 rounded-3xl shadow-xl transition-all duration-500`}
          >
            <ThemeIcon className="text-white w-10 h-10" />
          </motion.div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">BITC Portal</h1>
          <p className="text-slate-400 text-xs font-bold mt-1 tracking-wider uppercase">School Management System</p>
        </div>

        {/* Triple Segmented Role Selection Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100/80 p-1.5 rounded-2xl mb-8 border border-slate-200/40">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setError(null);
                }}
                className={`flex flex-col items-center justify-center gap-1.5 py-3.5 px-1 rounded-xl text-xs font-bold uppercase transition-all duration-300 cursor-pointer ${
                  isSelected
                    ? tab.id === 'student'
                      ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100/40'
                      : tab.id === 'teacher'
                      ? 'bg-white text-purple-600 shadow-sm border border-purple-100/40'
                      : 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <TabIcon size={16} />
                <span className="text-[10px] tracking-wide text-center leading-none">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-rose-50/80 text-rose-600 p-4 rounded-2xl mb-6 text-xs font-bold border border-rose-100 flex items-center gap-3"
          >
            <div className="w-1.5 h-8 bg-rose-500 rounded-full shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              To proceed securely, authenticate through Google SSO using your registered domain email role as <strong className={theme.colorClass}>{theme.label}</strong>.
            </p>
          </div>

          {/* Large SSO Action Button */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleGoogleLogin(activeTab)}
            className={`w-full flex items-center justify-center gap-3 text-white font-extrabold py-4 px-6 rounded-2xl transition-all active:scale-[0.98] text-xs uppercase tracking-widest cursor-pointer ${theme.btnPrimary} ${loading ? 'opacity-80 cursor-wait' : ''}`}
          >
            {loading ? (
              <Loader2 className="animate-spin text-white" size={18} />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            <span>Sign In with Google</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export const LogoutButton: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  const handleLogout = async () => {
    if (logout) {
      await logout();
    }
    navigate('/');
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-rose-600 hover:bg-rose-50/80 transition-colors text-xs font-extrabold uppercase tracking-widest mt-2 border border-transparent hover:border-rose-100 cursor-pointer"
    >
      <LogOut size={16} />
      <span>Logout from Portal</span>
    </button>
  );
};
