import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { getDbMode, setDbMode, syncDbFromCloud } from '../lib/mockFirestore';
import { Toast, ToastMessage } from './Toast';
import { LogoutButton } from './Auth';
import { NotificationBell } from './NotificationBell';
import { Database, RefreshCw, Cloud, CloudOff } from 'lucide-react';
import { 
  LayoutDashboard, 
  Home,
  BookOpen, 
  Users, 
  ClipboardCheck, 
  FileText, 
  Award,
  Menu, 
  X, 
  ChevronDown,
  User,
  Settings,
  Wallet,
  TrendingUp,
  GraduationCap,
  MessageSquare,
  Calendar,
  Lock,
  Maximize,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userData, settings, hasPermission, feeBalance } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const location = useLocation();

  const [dbMode, setDbModeState] = useState<'real' | 'local_cached'>('real');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [isSyncMenuOpen, setIsSyncMenuOpen] = useState(false);

  useEffect(() => {
    // Read initial database mode
    setDbModeState(getDbMode());

    const handleModeChange = () => {
      setDbModeState(getDbMode());
    };

    window.addEventListener('db-mode-changed', handleModeChange);
    return () => {
      window.removeEventListener('db-mode-changed', handleModeChange);
    };
  }, []);

  const handleFullSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgress('Initializing...');
    try {
      const res = await syncDbFromCloud((msg) => setSyncProgress(msg));
      if (res.success) {
        addToast(`Successfully backed up ${res.count} records locally!`, 'success');
      } else {
        addToast('Sync aborted. Firestore is currently exhausted or unreachable.', 'error');
      }
    } catch (err: any) {
      addToast(`Sync error: ${err.message || err}`, 'error');
    } finally {
      setIsSyncing(false);
      setSyncProgress('');
    }
  };

  const addToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const isRestricted = settings?.denyAccessOnBalance && 
                     userData?.role === 'student' && 
                     (feeBalance?.balance || 0) > 0;

  const isDisabled = userData?.disabled === true;

  const navGroups = [
    {
      title: 'DASHBOARD',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permission: null },
        { name: 'Profile', path: '/profile', icon: User, permission: null, role: 'student' },
      ]
    },
    {
      title: 'COMMUNICATION',
      items: [
        { name: 'WhatsApp Group', path: '/whatsapp', icon: MessageSquare, permission: null },
      ]
    },
    {
      title: 'ACADEMIC',
      items: [
        { name: 'Timetable', path: '/timetable', icon: Calendar, permission: null },
        { name: 'My Units', path: '/my-units', icon: BookOpen, permission: null, role: 'student' },
      ]
    },
    {
      title: 'ADMINISTRATION',
      items: [
        { name: 'Admin Section', path: '/admin', icon: Settings, permission: 'system_settings' },
        { name: 'Classes', path: '/classes', icon: Users, permission: 'manage_classes' },
        { name: 'Units', path: '/units', icon: BookOpen, permission: 'manage_units' },
      ]
    },
    {
      title: 'STUDENT INFO',
      items: [
        { name: 'Student Category', path: '/students/categories', icon: Users, permission: 'view_students' },
        { name: 'Add Student', path: '/students/admission', icon: User, permission: 'view_students', role: 'admin' },
        { name: 'Student List', path: '/students', icon: Users, permission: 'view_students' },
        { name: 'Student Attendance', path: '/attendance', icon: ClipboardCheck, permission: null },
        { name: 'Exams', path: '/exams', icon: FileText, permission: 'manage_exams' },
        { name: 'Exam Attendance', path: '/exams/attendance', icon: ClipboardCheck, permission: 'manage_exams' },
        { name: 'Marks', path: '/marks', icon: Award, permission: 'manage_exams' },
        { name: 'Results', path: '/results', icon: TrendingUp, permission: null },
        { name: 'Fees', path: '/fees', icon: Wallet, permission: null },
      ]
    }
  ];

  const dynamicStyles = {
    fontFamily: settings?.fontFamily || 'Inter, sans-serif',
    fontSize: settings?.fontSize || '16px',
    textAlign: settings?.textAlign || 'left' as any,
  };

  const isStudent = userData?.role === 'student';
  const isDashboard = location.pathname === '/dashboard';

  const SidebarContent = () => (
    <div className={`flex flex-col h-full ${isStudent ? 'bg-[#0B1221]' : 'bg-bg-dark'} text-text-secondary relative overflow-hidden`}>
      {/* Decorative gradient for sidebar */}
      {!isStudent && (
        <>
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      <div className="p-8 mb-4 flex items-center gap-3 relative">
        {settings?.logoUrl ? (
          <img src={settings.logoUrl} alt="Logo" className="h-10 w-auto" referrerPolicy="no-referrer" />
        ) : (
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-blue-500/20">
            <GraduationCap className="text-white w-6 h-6" />
          </div>
        )}
        <div className="overflow-hidden">
          <p className="text-white font-bold text-sm uppercase tracking-tight leading-none truncate">{settings?.appTitle || 'BITC Portal'}</p>
          <p className={`text-[10px] uppercase tracking-widest font-bold ${isStudent ? 'text-blue-400' : 'text-primary'} mt-1.5 opacity-80`}>Smart Learning</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-5 py-2 space-y-8 custom-scrollbar relative">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item: any) => {
            if (isRestricted && item.path !== '/dashboard' && item.path !== '/fees') return false;
            if (isStudent && item.path === '/dashboard') return true; // Re-enable for student
            if (item.role && userData?.role !== item.role) return false;
            return !item.permission || hasPermission(item.permission);
          });
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title}>
              <p className="px-4 text-[10px] font-bold tracking-widest text-text-muted mb-4 uppercase">{group.title}</p>
              <div className="space-y-1.5">
                {visibleItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 group relative ${
                      location.pathname === item.path
                        ? `${isStudent ? 'bg-blue-600' : 'bg-primary'} text-white shadow-xl ${isStudent ? 'shadow-blue-900/40' : 'shadow-primary/30'}`
                        : 'text-text-muted hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <item.icon size={18} className={location.pathname === item.path ? 'text-white' : `text-text-muted group-hover:${isStudent ? 'text-blue-400' : 'text-primary'} transition-colors`} />
                    <span className="flex-1">{item.name}</span>
                    {location.pathname === item.path && (
                      <motion.div 
                        layoutId="activeTabSide"
                        className="absolute left-0 w-1 h-6 bg-white rounded-r-full"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-6 relative">
        <div className={`rounded-[24px] p-4 flex items-center gap-3 border border-white/5 group hover:bg-white/5 transition-all cursor-pointer ${isStudent ? 'bg-white/5' : 'bg-bg-card/50'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg ${isStudent ? 'bg-blue-600' : 'bg-gradient-to-br from-primary to-highlight'}`}>
            {userData?.name?.charAt(0)}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-text-primary text-xs font-bold truncate">{userData?.name}</p>
            <p className={`text-[10px] uppercase tracking-widest font-bold ${isStudent ? 'text-blue-400' : 'text-primary'} opacity-60 mt-0.5`}>{userData?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );


  if (isDisabled) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 selection:bg-rose-100 selection:text-rose-700" style={dynamicStyles}>
        {/* Background decoration */}
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-rose-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-red-650/10 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 max-w-xl w-full"
        >
          <div className="bg-white rounded-[48px] p-10 sm:p-14 text-center shadow-2xl shadow-black/50 border border-white/10 relative overflow-hidden">
            {/* Disabled tag */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-red-600 px-6 py-2 rounded-b-2xl">
              <p className="text-xs font-bold text-white uppercase tracking-[0.3em]">Account Status</p>
            </div>

            <div className="mb-10 inline-flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-rose-500/20 blur-2xl opacity-20 animate-pulse" />
                <div className="bg-rose-50 p-8 rounded-[40px] text-rose-600 relative">
                  <XCircle size={64} className="stroke-[2.5]" />
                </div>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-slate-900 uppercase tracking-tighter mb-4 leading-none">
              Account <span className="text-red-600">Deactivated</span>
            </h1>
            
            <p className="text-slate-500 font-bold max-w-sm mx-auto mb-10 leading-relaxed uppercase text-xs tracking-widest">
              Your academic portal has been deactivated by the administrator. Please contact the administration office for assistance.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <button 
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto bg-slate-900 text-white px-10 py-5 rounded-3xl font-bold text-xs uppercase tracking-widest shadow-2xl hover:bg-black transition-all hover:scale-105 active:scale-95"
              >
                Refresh Status
              </button>
            </div>

            <div className="mt-12 pt-10 border-t border-slate-100 flex flex-col items-center gap-6">
              <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white text-xs font-bold">
                  {userData?.name?.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900 uppercase truncate max-w-[120px]">{userData?.name}</p>
                  <p className="text-xs font-bold text-red-500 uppercase tracking-widest leading-none">Deactivated</p>
                </div>
              </div>
              <LogoutButton />
            </div>
          </div>

          <p className="mt-8 text-center text-white/40 text-xs font-bold uppercase tracking-[0.4em] px-10 leading-relaxed">
            Please contact the administration office for full reinstatement details.
          </p>
        </motion.div>
      </div>
    );
  }

  if (isRestricted && location.pathname !== '/fees') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 selection:bg-blue-100 selection:text-blue-700" style={dynamicStyles}>
        {/* Background decoration */}
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] bg-indigo-400/10 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 max-w-xl w-full"
        >
          <div className="bg-white rounded-[48px] p-10 sm:p-14 text-center shadow-2xl shadow-black/50 border border-white/10 relative overflow-hidden">
            {/* Warning tag */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-red-600 px-6 py-2 rounded-b-2xl">
              <p className="text-xs font-bold text-white uppercase tracking-[0.3em]">System Lock</p>
            </div>

            <div className="mb-10 inline-flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500 blur-2xl opacity-20 animate-pulse" />
                <div className="bg-red-50 p-8 rounded-[40px] text-red-600 relative">
                  <Lock size={64} className="stroke-[2.5]" />
                </div>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-slate-900 uppercase tracking-tighter mb-4 leading-none">
              Portal Access <span className="text-red-600">Denied</span>
            </h1>
            
            <p className="text-slate-500 font-bold max-w-sm mx-auto mb-10 leading-relaxed uppercase text-xs tracking-widest">
              Your academic portal has been suspended due to an outstanding fee balance of
              <span className="block text-2xl text-slate-900 font-bold mt-2 mb-1 tracking-tight">Ksh {feeBalance?.balance?.toLocaleString()}</span>
              Please settle the balance to restore full access.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <Link 
                to="/fees" 
                className="w-full sm:w-auto bg-blue-600 text-white px-10 py-5 rounded-3xl font-bold text-xs uppercase tracking-widest shadow-2xl shadow-blue-600/40 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
              >
                Clear Balance Now
              </Link>
              <button 
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto bg-slate-100 text-slate-600 px-10 py-5 rounded-3xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
              >
                I Have Paid
              </button>
            </div>

            <div className="mt-12 pt-10 border-t border-slate-100 flex flex-col items-center gap-6">
              <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {userData?.name?.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900 uppercase truncate max-w-[120px]">{userData?.name}</p>
                  <p className="text-xs font-bold text-blue-500 uppercase tracking-widest leading-none">Student Locked</p>
                </div>
              </div>
              <LogoutButton />
            </div>
          </div>

          <p className="mt-8 text-center text-white/40 text-xs font-bold uppercase tracking-[0.4em] px-10 leading-relaxed">
            Contact the accounts department at BITC center for manual payment verification or technical support.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isStudent ? 'bg-[#0B1221]' : 'bg-bg-main'} flex overflow-hidden selection:bg-primary/20 selection:text-primary`} style={dynamicStyles}>
      {/* Background decoration */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className={`absolute top-[-10%] right-[-5%] w-[40%] h-[40%] ${isStudent ? 'bg-blue-600/10' : 'bg-primary/5'} rounded-full blur-[120px]`} />
        <div className={`absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] ${isStudent ? 'bg-indigo-600/10' : 'bg-highlight/5'} rounded-full blur-[100px]`} />
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 h-screen sticky top-0 shadow-[20px_0_60px_-15px_rgba(0,0,0,0.05)] z-40 transform-gpu">
        <SidebarContent />
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative z-10 scroll-smooth pb-12 lg:pb-0">
        {/* Top Navbar */}
        <header className={`h-20 ${isStudent ? 'bg-[#0B1221]/80 shadow-none border-white/5' : 'bg-bg-main/80 border-white shadow-sm'} backdrop-blur-xl border-b text-text-primary flex items-center justify-between px-6 sm:px-10 sticky top-0 z-30 transition-all duration-300`}>
            <div className="flex items-center gap-4 flex-1">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2.5 rounded-xl text-text-muted hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
              >
                <Menu size={22} />
              </button>
              
              <div className="relative flex-1 max-w-md hidden md:block group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-text-muted group-focus-within:text-primary transition-all">
                  <Menu size={16} className="rotate-90 opacity-50" />
                </div>
                <input 
                  type="text" 
                  placeholder="Search anything..."
                  className={`w-full border-none rounded-2xl pl-12 pr-4 py-3 text-xs font-bold text-text-secondary placeholder:text-text-muted focus:ring-4 ${isStudent ? 'bg-white/5 focus:ring-blue-500/20 text-white' : 'bg-bg-card/50 focus:ring-primary/20 text-text-primary'} shadow-sm ring-1 ring-white/10 transition-all outline-none`}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
              {/* Intelligent Database Cache Sync and Network Status */}
              <div className="relative">
                <div 
                  onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border cursor-pointer transition-all hover:shadow-md select-none ${
                    dbMode === 'real' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400' 
                      : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-amber-400'
                  }`}
                  title={dbMode === 'real' ? "Live Connected to Cloud Firestore" : "Database Caching Active"}
                >
                  <div className={`w-2 h-2 rounded-full ${dbMode === 'real' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-bounce'}`} />
                  <Database size={14} className={isSyncing ? 'animate-spin' : ''} />
                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
                    {dbMode === 'real' ? "Cloud Live" : "Backup Active"}
                  </span>
                  <ChevronDown size={12} className="opacity-60" />
                </div>
                
                <AnimatePresence>
                  {isSyncMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsSyncMenuOpen(false)} />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className={`absolute right-0 mt-3 w-80 rounded-[28px] shadow-2xl py-4 z-50 p-5 border text-left ${
                          isStudent ? 'bg-[#1A1F2E] border-white/10 text-white' : 'bg-bg-card border-white/5 text-text-primary'
                        }`}
                      >
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-2 text-text-primary flex items-center gap-2">
                          <Database size={14} className="text-blue-400" /> Database Cache Status
                        </h4>
                        <p className="text-[11px] text-text-muted leading-relaxed mb-4">
                          {dbMode === 'real' 
                            ? "Active reads are sourced from Cloud Firestore. In background, your records are copied here daily for backup." 
                            : "Your cloud limit is reached. The school is running off local cached data perfectly so there's zero downtime!"}
                        </p>
                        
                        <div className="space-y-3 pt-2 border-t border-white/5">
                          {/* Force switch mode */}
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-text-secondary">Low-Data Backup Mode</span>
                            {userData?.role === 'admin' ? (
                              <button 
                                onClick={() => {
                                  const next = dbMode === 'real' ? 'local_cached' : 'real';
                                  setDbMode(next);
                                  addToast(`Database mode forced to: ${next === 'real' ? 'Cloud Live' : 'Cached Backup'}`, 'warning');
                                  setIsSyncMenuOpen(false);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                  dbMode === 'real'
                                    ? 'bg-transparent border-white/10 text-text-muted hover:border-white/20'
                                    : 'bg-amber-500 text-black border-transparent hover:scale-105'
                                }`}
                              >
                                {dbMode === 'real' ? "Enable" : "Disable"}
                              </button>
                            ) : (
                              <span className="text-[10px] text-text-muted font-bold uppercase flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                                <Lock size={10} className="opacity-60" /> Admins Only
                              </span>
                            )}
                          </div>

                          {/* Quick Admin Sync Call */}
                          {userData?.role === 'admin' && (
                            <div className="space-y-2 pt-2 border-t border-white/5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-text-secondary">Restore Cache from Cloud</span>
                                <button
                                  onClick={() => {
                                    handleFullSync();
                                  }}
                                  disabled={isSyncing}
                                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/30 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all outline-none"
                                >
                                  <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
                                  {isSyncing ? "Syncing..." : "Sync Now"}
                                </button>
                              </div>
                              {syncProgress && (
                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest leading-normal animate-pulse">
                                  {syncProgress}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Year/Period */}
              <div className={`hidden lg:flex items-center gap-3 ${isStudent ? 'bg-white/5' : 'bg-bg-card'} px-5 py-2.5 rounded-2xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all hover:shadow-sm`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isStudent ? 'bg-blue-400' : 'bg-primary'} animate-pulse`} />
                <span className={`text-[10px] font-bold ${isStudent ? 'text-gray-300' : 'text-text-secondary'} uppercase tracking-widest`}>2026 [Jan-Dec]</span>
                <ChevronDown size={14} className="text-text-muted" />
              </div>

              <div className="flex items-center gap-2 sm:gap-4 border-l border-white/10 pl-4 sm:pl-6">
                <NotificationBell addToast={addToast} />
                <div className="relative">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className={`w-11 h-11 rounded-2xl ${isStudent ? 'bg-white/5' : 'bg-bg-card'} flex items-center justify-center text-text-muted hover:text-white border border-white/10 hover:border-blue-400/50 transition-all shadow-sm hover:shadow-md overflow-hidden active:scale-95`}
                  >
                    <User size={20} />
                  </button>
                  <AnimatePresence>
                    {isProfileOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className={`absolute right-0 mt-6 w-64 rounded-[32px] shadow-2xl py-2 ${isStudent ? 'bg-[#1A1F2E]' : 'bg-bg-card'} ring-1 ring-white/10 z-50 p-6`}
                      >
                        <div className="mb-6 flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold ${isStudent ? 'bg-blue-600' : 'bg-primary/10 text-primary'}`}>
                            {userData?.name?.charAt(0)}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-bold text-text-primary truncate tracking-tight">{userData?.name}</p>
                            <p className={`text-xs font-bold ${isStudent ? 'text-blue-400' : 'text-primary'} uppercase tracking-widest mt-0.5`}>{userData?.role}</p>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Link to="/profile" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-text-secondary hover:bg-white/5 transition-colors text-xs font-bold uppercase tracking-widest">
                            <User size={18} className="text-text-muted" /> Profile
                          </Link>
                          <Link to="/admin" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-text-secondary hover:bg-white/5 transition-colors text-xs font-bold uppercase tracking-widest">
                            <Settings size={18} className="text-text-muted" /> Settings
                          </Link>
                          <div className="pt-2">
                            <LogoutButton />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </header>

        {/* Page Content */}
        <main className={`p-6 sm:p-10 max-w-[1700px] w-full mx-auto relative min-h-full ${isStudent ? 'text-white' : ''}`}>
          {children}
          
          <footer className="mt-20 pt-8 pb-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 px-2">
            <div className="flex items-center gap-3 opacity-60">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${isStudent ? 'bg-blue-600/50' : 'bg-primary/50'}`}>
                <GraduationCap size={16} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                {settings?.appTitle || 'BITC Portal'} <span className="mx-2 opacity-30">|</span> Smart Management
              </p>
            </div>
            
            <div className="text-center md:text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted opacity-80">
                Copyright Davtech Solutions 2026 <span className="mx-2 opacity-30">|</span> All Rights Reserved.
              </p>
              <div className="flex items-center justify-center md:justify-end gap-4 mt-2 opacity-40">
                <span className="text-[8px] font-bold uppercase tracking-widest hover:text-white transition-colors cursor-pointer">Privacy</span>
                <span className="text-[8px] font-bold uppercase tracking-widest hover:text-white transition-colors cursor-pointer">Terms</span>
                <span className="text-[8px] font-bold uppercase tracking-widest hover:text-white transition-colors cursor-pointer">Support</span>
              </div>
            </div>
          </footer>
        </main>


        <Toast messages={toasts} onRemove={removeToast} />
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.nav
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 left-0 w-72 bg-[#12121e] shadow-2xl overflow-hidden"
            >
              <SidebarContent />
            </motion.nav>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}} />
    </div>
  );
};
