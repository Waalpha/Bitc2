import React, { useState, useEffect } from 'react';
import { auth, db, isFirebaseReady } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { LogIn, LogOut, User as UserIcon, Loader2, Mail, Lock, ShieldCheck, Hash } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { motion } from 'motion/react';

export const Auth: React.FC = () => {
  const { user: authUser, userData, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [loginMethod, setLoginMethod] = useState<'google' | 'form'>('form');
  const [identifier, setIdentifier] = useState(''); // Email
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isAuthReady && authUser && userData) {
      if (location.pathname === '/auth') {
        const fallback = userData.role === 'student' ? '/results' : '/dashboard';
        navigate(fallback, { replace: true });
      }
    }
  }, [authUser, userData, isAuthReady, navigate, location.pathname]);

  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseReady) {
      setError("Firebase is not yet configured.");
      return;
    }

    setLoading(true);
    setError(null);

    let resolvedEmail = identifier.trim();

    try {
      // Clean and check if is an email format or admission number
      if (!resolvedEmail.includes('@')) {
        const response = await fetch('/api/auth/lookup-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ admissionNumber: resolvedEmail }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `No account found for Admission Number "${resolvedEmail}"`);
        }

        const data = await response.json();
        resolvedEmail = data.email;
      }

      await signInWithEmailAndPassword(auth, resolvedEmail, password);
    } catch (err: any) {
      console.error("Login error:", err);
      let message = "Invalid credentials. Please try again.";
      if (err.code === 'auth/user-not-found') message = "Account not found.";
      if (err.code === 'auth/wrong-password') message = "Incorrect password.";
      if (err.code === 'auth/invalid-email') message = "Invalid email format.";
      if (err.message) message = err.message;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

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

      const existingData = userDoc.exists() ? userDoc.data() : null;
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
        }, { merge: true });
      }
    } catch (err: any) {
      console.error("Google Login error:", err);
      setError(err.message || "Failed to login with Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -tranzlate-y-1/2 translate-x-1/2 w-96 h-96 bg-blue-400/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 left-0 tranzlate-y-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-400/10 rounded-full blur-[100px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-xl p-10 rounded-[48px] shadow-2xl shadow-slate-200 border border-white max-w-md w-full relative z-10"
      >
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-4 rounded-3xl shadow-xl shadow-blue-200">
            <ShieldCheck className="text-white w-10 h-10" />
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">BITC Portal</h1>
          <p className="text-slate-500 font-medium">{loginMethod === 'form' ? 'Enter your credentials to continue' : 'Select your role to login via Google'}</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-rose-50 text-rose-600 p-4 rounded-2xl mb-8 text-xs font-bold border border-rose-100 flex items-center gap-3"
          >
            <div className="w-1.5 h-10 bg-rose-500 rounded-full shrink-0" />
            {error}
          </motion.div>
        )}

        {loginMethod === 'form' ? (
          <form onSubmit={handleFormLogin} className="space-y-6">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em] ml-1">Admission No. or Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  {identifier.includes('@') ? <Mail size={18} /> : <Hash size={18} />}
                </div>
                <input 
                  type="text" 
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. BITC/2026/001 or name@email.com"
                  required
                  className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 placeholder:text-slate-300 ring-1 ring-slate-100 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-[0.2em] ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 placeholder:text-slate-300 ring-1 ring-slate-100 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl transition-all disabled:opacity-50 shadow-xl shadow-blue-100 flex items-center justify-center gap-3 uppercase text-xs tracking-widest active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={18} />}
              Sign In to Portal
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-white px-4 mx-auto w-fit">Or Continue with</div>
            </div>

            <button
              type="button"
              onClick={() => setLoginMethod('google')}
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-600 font-bold py-4 px-6 rounded-2xl transition-all hover:bg-slate-50 active:scale-95 text-xs uppercase tracking-widest"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google Auth
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => handleGoogleLogin('admin')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-6 rounded-2xl transition-all disabled:opacity-50 uppercase text-xs tracking-widest active:scale-95 shadow-xl shadow-slate-100"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={18} />}
              Login as Admin
            </button>
            <button
              onClick={() => handleGoogleLogin('teacher')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl transition-all disabled:opacity-50 uppercase text-xs tracking-widest active:scale-95 shadow-xl shadow-blue-100"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={18} />}
              Login as Faculty
            </button>
            <button
              onClick={() => handleGoogleLogin('student')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 hover:border-blue-600 hover:text-blue-600 text-slate-700 font-bold py-4 px-6 rounded-2xl transition-all disabled:opacity-50 uppercase text-xs tracking-widest active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={18} />}
              Login as Student
            </button>
            <div className="pt-4">
              <button 
                onClick={() => setLoginMethod('form')}
                className="text-blue-600 text-[10px] font-bold uppercase tracking-widest hover:underline"
              >
                Back to credentials login
              </button>
            </div>
          </div>
        )}
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
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-rose-600 hover:bg-rose-50 transition-colors text-xs font-bold uppercase tracking-widest mt-2 border border-transparent hover:border-rose-100"
    >
      <LogOut size={18} />
      <span>Logout from Portal</span>
    </button>
  );
};
