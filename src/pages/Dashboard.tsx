import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, limit, addDoc, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Class, Unit, Exam, AttendanceRecord, AppNotification, FeeBalance, Submission, Expense, TimetableEntry, DayOfWeek } from '../types';
import { Users, BookOpen, FileText, ClipboardCheck, ArrowRight, Bell, Share2, Copy, Check, Megaphone, Send, XCircle, Wallet, Paperclip, File as FileIcon, Image as ImageIcon, Loader2, PieChart as PieIcon, Plus, ChevronDown, ChevronRight, GraduationCap, TrendingUp, TrendingDown, Lock, Download, Calendar, Fingerprint, QrCode, Award, Clock, Sparkles, Video, MapPin, MessageSquare } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isWeekend } from 'date-fns';
import { Toast, ToastMessage } from '../components/Toast';
import { motion, AnimatePresence } from 'motion/react';
import { NotificationBell } from '../components/NotificationBell';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from 'recharts';

import { uploadFile } from '../services/uploadService';

export const Dashboard: React.FC = () => {
  const { user, userData, settings, hasPermission, studentContext } = useAuth();
  const [stats, setStats] = useState({
    classes: 0,
    units: 0,
    exams: 0,
    attendance: 0,
    students: 0,
    teachers: 0,
    parents: 0,
    staff: 0,
    totalUsers: 0
  });
  const [todayLessons, setTodayLessons] = useState<TimetableEntry[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [recentExams, setRecentExams] = useState<Exam[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<Exam[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [feeBalance, setFeeBalance] = useState<FeeBalance | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [viewingNotif, setViewingNotif] = useState<AppNotification | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', message: '', classId: '', broadcast: false });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sentAnnouncements, setSentAnnouncements] = useState<AppNotification[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [myAttendance, setMyAttendance] = useState<AttendanceRecord[]>([]);
  const [nextLesson, setNextLesson] = useState<TimetableEntry | null>(null);
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [myUnits, setMyUnits] = useState<Unit[]>([]);
  const [allFeeBalances, setAllFeeBalances] = useState<FeeBalance[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const ShareAppCard = () => {
    const shareUrl = window.location.origin;
    
    const handleShare = async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: settings?.appTitle || 'BITC Smart LMS',
            text: 'Access the Smart Learning Management Portal here:',
            url: shareUrl,
          });
        } catch (error) {
          console.log('Error sharing', error);
        }
      } else {
        handleCopyLink();
      }
    };

    return (
      <div className="bg-gradient-to-br from-[#1A1F2E] to-[#0B1221] p-8 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Share2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Share App</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Invite others to the portal</p>
            </div>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 mb-6 flex items-center justify-between gap-4">
            <code className="text-xs font-mono text-blue-400 truncate flex-1">{shareUrl}</code>
            <button 
              onClick={handleCopyLink}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={handleShare}
              className="bg-primary text-white font-bold py-3.5 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all active:scale-95"
            >
              <Send size={16} /> Share Link
            </button>
            <button 
              onClick={() => setShowQR(true)}
              className="bg-white/5 text-white font-bold py-3.5 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border border-white/5 hover:bg-white/10 transition-all active:scale-95"
            >
              <QrCode size={16} /> View QR
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5">
            <div className="flex items-start gap-3">
              <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500 shrink-0">
                <Download size={14} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">How to Install</p>
                <p className="text-[10px] text-gray-500 leading-relaxed mt-1">
                  Open this link in your mobile browser, tap <b>Share</b> or <b>Menu</b>, and select <b>"Add to Home Screen"</b> to install as an app.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* QR Modal */}
        <AnimatePresence>
          {showQR && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setShowQR(false)}
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white p-10 rounded-[40px] shadow-2xl flex flex-col items-center text-center max-w-sm w-full"
              >
                <div className="mb-6 p-4 bg-slate-50 rounded-3xl ring-8 ring-slate-50/50">
                  <QRCodeCanvas 
                    value={shareUrl} 
                    size={200}
                    level="H"
                    includeMargin={false}
                    imageSettings={{
                      src: settings?.logoUrl || "/logo.png",
                      x: undefined,
                      y: undefined,
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Scan to Access</h3>
                <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed px-4">
                  Point your camera at this code to quickly open the portal on another device.
                </p>
                <button 
                  onClick={() => setShowQR(false)}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-transform"
                >
                  Close
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const addToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    addToast("Portal link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Attempting to send announcement:", newAnnouncement);
    
    if (!newAnnouncement.title || !newAnnouncement.message || (!newAnnouncement.broadcast && !newAnnouncement.classId) || !user) {
      addToast("Please fill in all fields (Title, Message, and " + (newAnnouncement.broadcast ? "" : "Class") + ").", "error");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let attachmentUrl = '';
      let attachmentType = '';
      let attachmentName = '';

      if (attachment) {
        const uploadResult = await uploadFile(attachment, (progress) => {
          setUploadProgress(progress);
        });
        attachmentUrl = uploadResult.url;
        
        attachmentType = attachment.type.startsWith('image/') ? 'image' : 
                         attachment.type === 'application/pdf' ? 'pdf' : 
                         (attachment.type.includes('msword') || attachment.type.includes('officedocument')) ? 'word' : 'file';
        attachmentName = attachment.name;
      }

      console.log("Querying recipients for announcement. Broadcast:", newAnnouncement.broadcast);
      
      let recipientsQ;
      if (newAnnouncement.broadcast) {
        recipientsQ = query(collection(db, 'users'), where('role', 'in', ['student', 'teacher', 'admin', 'staff']));
      } else {
        // For specific class, we fetch class members AND we want ALL staff to see it
        recipientsQ = query(collection(db, 'users'), where('role', 'in', ['teacher', 'admin', 'staff']));
      }
        
      const recipientsSnap = await getDocs(recipientsQ);
      let recipients = recipientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      if (!newAnnouncement.broadcast) {
        // Also fetch students of the specific class
        const classStudentsQ = query(collection(db, 'users'), where('classIds', 'array-contains', newAnnouncement.classId), where('role', '==', 'student'));
        const classStudentsSnap = await getDocs(classStudentsQ);
        const classStudents = classStudentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        // Merge and deduplicate
        const mergedMap = new Map();
        recipients.forEach(r => mergedMap.set(r.id, r));
        classStudents.forEach(s => mergedMap.set(s.id, s));
        recipients = Array.from(mergedMap.values());
      }

      // Filter out self if desired (usually you want to see your own sent announcement in your inbox too)
      // Actually, if we exclude self here, it won't show in our "Notice Board" under "Received". 
      // But we have "My Sent". Let's keep self for simplicity and to ensure it shows up in "Received" too.
      
      console.log(`Found ${recipients.length} total recipients including staff.`);
      
      if (recipients.length === 0) {
        addToast(newAnnouncement.broadcast ? "No recipients found in the system." : "No recipients found in this class.", "error");
        setIsUploading(false);
        return;
      }
      
      const MAX_BATCH_SIZE = 450; // Safety margin
      const batches = [];
      let currentBatch = writeBatch(db);
      let count = 0;

      // Create individual notifications for all recipients
      for (const recipient of recipients) {
        const notifRef = doc(collection(db, 'notifications'));
        const notification: any = {
          userId: recipient.id,
          senderId: user.uid,
          title: newAnnouncement.title,
          message: newAnnouncement.message,
          type: 'announcement',
          read: false,
          createdAt: new Date().toISOString(),
          attachmentUrl: attachmentUrl || null,
          attachmentType: attachmentType || null,
          attachmentName: attachmentName || null
        };
        
        // Remove any undefined fields to prevent Firestore errors
        Object.keys(notification).forEach(key => {
          if (notification[key] === undefined) delete notification[key];
        });
        
        currentBatch.set(notifRef, notification);
        count++;

        if (count >= MAX_BATCH_SIZE) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          count = 0;
        }
      }

      // Add the master record to the current (or new) batch
      const masterRef = doc(collection(db, 'notifications'));
      const masterData: any = {
        userId: 'SYSTEM_ANNOUNCEMENT_ARCHIVE',
        senderId: user.uid,
        senderName: userData?.name || 'Staff',
        title: newAnnouncement.title,
        message: newAnnouncement.message,
        type: 'announcement',
        read: true,
        createdAt: new Date().toISOString(),
        attachmentUrl: attachmentUrl || null,
        attachmentType: attachmentType || null,
        attachmentName: attachmentName || null,
        targetClassId: newAnnouncement.broadcast ? 'all' : newAnnouncement.classId
      };
      
      // Sanitization
      Object.keys(masterData).forEach(key => {
        if (masterData[key] === undefined) delete masterData[key];
      });

      currentBatch.set(masterRef, masterData);
      batches.push(currentBatch);
      
      console.log(`Committing ${batches.length} batches for ${recipients.length + 1} total records...`);
      await Promise.all(batches.map(b => b.commit()));
      console.log("Announcement broadcast complete.");
      
      setIsAnnouncing(false);
      setNewAnnouncement({ title: '', message: '', classId: '', broadcast: false });
      setAttachment(null);
      addToast("Announcement sent successfully!");
    } catch (error) {
      console.error("Announcement error:", error);
      handleFirestoreError(error, OperationType.CREATE, 'notifications/announcement');
      addToast("Failed to send announcement. Check console for details.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const isTeacher = userData?.role === 'teacher';

  useEffect(() => {
    if (!user) return;

    const fetchAllData = async () => {
      try {
        const isStudentOrParent = userData?.role === 'student' || userData?.role === 'parent';
        const targetClassIds = isStudentOrParent ? (studentContext?.classIds || userData?.classIds) : userData?.classIds;
        const targetStudentId = studentContext?.uid || user.uid;

        // Stats and Classes
        const statsClassesQ = (isTeacher || userData?.role === 'admin')
          ? query(collection(db, 'classes'))
          : query(collection(db, 'classes'), where('__name__', 'in', (targetClassIds && targetClassIds.length > 0) ? targetClassIds : ['none']));

        const classesSnap = await getDocs(statsClassesQ);
        setStats(prev => ({ ...prev, classes: classesSnap.size }));
        setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Class)));

        const unitsSnap = await getDocs(query(collection(db, 'units')));
        setStats(prev => ({ ...prev, units: unitsSnap.size }));

        const examsQ = isTeacher
          ? query(collection(db, 'exams'), where('teacherId', '==', user.uid))
          : query(collection(db, 'exams'), where('published', '==', true));
        
        const examsSnap = await getDocs(examsQ);
        setStats(prev => ({ ...prev, exams: examsSnap.size }));
        const allExams = examsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Exam));
        setExams(allExams);
        setRecentExams(allExams.slice(0, 3));
        
        const now = new Date();
        const deadlines = allExams
          .filter(e => e.dueDate && new Date(e.dueDate) > now)
          .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
          .slice(0, 3);
        setUpcomingDeadlines(deadlines);

        // Notifications
        const notifQ = query(
          collection(db, 'notifications'), 
          where('userId', '==', user.uid),
          limit(50)
        );
        const notifSnap = await getDocs(notifQ);
        const allNotifs = notifSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as AppNotification));
        setNotifications(allNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

        const sentQ = query(
          collection(db, 'notifications'),
          where('userId', '==', 'SYSTEM_ANNOUNCEMENT_ARCHIVE'),
          limit(50)
        );
        const sentSnap = await getDocs(sentQ);
        const allSent = sentSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as AppNotification));
        setSentAnnouncements(allSent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

        // Users
        const usersSnap = await getDocs(collection(db, 'users'));
        const counts = { students: 0, teachers: 0, parents: 0, staff: 0 };
        usersSnap.docs.forEach(doc => {
          const u = doc.data();
          if (u.role === 'student') counts.students++;
          else if (u.role === 'teacher') counts.teachers++;
          else if (u.role === 'parent') counts.parents++;
          else if (u.role === 'staff' || u.role === 'admin') counts.staff++;
        });
        setStats(prev => ({ 
          ...prev, 
          students: counts.students,
          teachers: counts.teachers,
          parents: counts.parents,
          staff: counts.staff,
          totalUsers: usersSnap.size
        }));

        // Attendance
        const attendanceSnap = await getDocs(collection(db, 'attendance'));
        setStats(prev => ({ ...prev, attendance: attendanceSnap.size }));
        if (isStudentOrParent) {
          const studentRecords = attendanceSnap.docs
            .map(doc => ({ id: doc.id, ...(doc.data() as any) } as AttendanceRecord))
            .filter(r => r.records[targetStudentId])
            .sort((a, b) => b.date.localeCompare(a.date));
          setMyAttendance(studentRecords);
        }

        // Submissions
        const subQ = isStudentOrParent
          ? query(collection(db, 'submissions'), where('studentId', '==', targetStudentId))
          : query(collection(db, 'submissions'));
        const subSnap = await getDocs(subQ);
        setSubmissions(subSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Submission)));

        // My Units
        if (isStudentOrParent && targetClassIds?.length) {
          const myUnitsQ = query(collection(db, 'units'), where('classId', 'in', targetClassIds));
          const myUnitsSnap = await getDocs(myUnitsQ);
          setMyUnits(myUnitsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Unit)));
        }

        // Timetable
        let timetableQ;
        if (isStudentOrParent && targetClassIds?.length) {
          timetableQ = query(collection(db, 'timetable'), where('classId', '==', targetClassIds[0]));
        } else if (isTeacher) {
          timetableQ = query(collection(db, 'timetable'), where('teacherId', '==', user.uid));
        }
        if (timetableQ) {
          const timetableSnap = await getDocs(timetableQ);
          const entries = timetableSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as TimetableEntry));
          const currentDay = format(now, 'EEEE') as DayOfWeek;
          const currentTimeStr = format(now, 'HH:mm');
          const todayLessons = entries.filter(e => e.day === currentDay).sort((a, b) => a.startTime.localeCompare(b.startTime));
          setTodayLessons(todayLessons);
          setNextLesson(todayLessons.find(e => e.startTime > currentTimeStr) || null);
        }

        // Finance
        if (isStudentOrParent) {
          const feesQ = query(collection(db, 'fees'), where('studentId', '==', targetStudentId));
          const feesSnap = await getDocs(feesQ);
          if (!feesSnap.empty) {
            setFeeBalance({ id: feesSnap.docs[0].id, ...(feesSnap.docs[0].data() as any) } as FeeBalance);
          } else {
            setFeeBalance(null);
          }
        }
        if (hasPermission('view_finance')) {
          const allFeesSnap = await getDocs(collection(db, 'fees'));
          setAllFeeBalances(allFeesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as FeeBalance)));
          const allExpensesSnap = await getDocs(collection(db, 'expenses'));
          setAllExpenses(allExpensesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Expense)));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'dashboard-data');
      }
    };

    fetchAllData();
  }, [user, isTeacher, userData?.role, userData?.uid, userData?.classIds?.join(','), studentContext, hasPermission]);

  // Deduplicate fee balances by studentId to prevent double-counting
  const uniqueFeeBalances = React.useMemo(() => {
    const map = new Map<string, FeeBalance>();
    // Sort oldest to newest so newest overwrites in loop
    const sorted = [...allFeeBalances].sort((a, b) => (a.lastUpdated || '').localeCompare(b.lastUpdated || ''));
    
    sorted.forEach(fb => {
      if (!fb.studentId) return;
      const sId = String(fb.studentId).trim();
      const existing = map.get(sId);
      
      const balDate = fb.lastUpdated || '';
      const existingDate = existing?.lastUpdated || '';
      
      const balIsUidMatch = fb.id === sId;
      const existingIsUidMatch = existing?.id === sId;

      if (!existing) {
        map.set(sId, fb);
      } else if (balIsUidMatch && !existingIsUidMatch) {
        map.set(sId, fb);
      } else if (balIsUidMatch === existingIsUidMatch) {
        if (balDate >= existingDate) {
          map.set(sId, fb);
        }
      }
    });
    return Array.from(map.values());
  }, [allFeeBalances]);

  // Calculate real financial data
  const realFinancialData = React.useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    const monthlyData = months.map(month => ({
      month,
      income: 0,
      billings: 0,
      expense: 0
    }));

    // Aggregate Income and Billings from Fees history
    uniqueFeeBalances.forEach(fb => {
      fb.history?.forEach(h => {
        const date = new Date(h.date);
        if (date.getFullYear() === currentYear) {
          const monthIdx = date.getMonth();
          if (h.type === 'payment') {
            monthlyData[monthIdx].income += h.amount;
          } else if (h.type === 'charge') {
            monthlyData[monthIdx].billings += h.amount;
          }
        }
      });
    });

    // Aggregate Expenses
    allExpenses.forEach(exp => {
      const date = new Date(exp.date);
      if (date.getFullYear() === currentYear) {
        monthlyData[date.getMonth()].expense += exp.amount;
      }
    });

    return monthlyData.slice(0, new Date().getMonth() + 1); // Only show up to current month
  }, [uniqueFeeBalances, allExpenses]);

  const totalFinancialStats = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    
    // Yearly totals (matching the chart scope)
    let yearlyIncome = 0;
    let yearlyBillings = 0;
    let yearlyExpenses = 0;

    uniqueFeeBalances.forEach(fb => {
      fb.history?.forEach(h => {
        const date = new Date(h.date);
        if (date.getFullYear() === currentYear) {
          if (h.type === 'payment') yearlyIncome += h.amount;
          else if (h.type === 'charge') yearlyBillings += h.amount;
        }
      });
    });

    allExpenses.forEach(exp => {
      const date = new Date(exp.date);
      if (date.getFullYear() === currentYear) yearlyExpenses += exp.amount;
    });

    // Lifetime totals (for overall context)
    const lifetimeCollections = uniqueFeeBalances.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
    const lifetimeBillings = uniqueFeeBalances.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
    const totalLifetimeExpenses = allExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return {
      income: yearlyIncome,
      billings: yearlyBillings,
      expenses: yearlyExpenses,
      profit: yearlyIncome - yearlyExpenses,
      lifetimeIncome: lifetimeCollections,
      lifetimeExpenses: totalLifetimeExpenses,
      outstanding: lifetimeBillings - lifetimeCollections
    };
  }, [uniqueFeeBalances, allExpenses]);

  const statCards = React.useMemo(() => [
    { name: 'Total', value: stats.totalUsers, label: 'Total Users', icon: Users, color: 'bg-gradient-to-br from-slate-800 to-slate-900' },
    { name: 'Students', value: stats.students, label: 'Enrollments', icon: GraduationCap, color: 'bg-gradient-to-br from-blue-600 to-blue-800' },
    { name: 'Units', value: stats.units, label: 'Active Units', icon: BookOpen, color: 'bg-gradient-to-br from-indigo-600 to-indigo-800' },
    { name: 'Exams', value: stats.exams, label: 'Assessments', icon: FileText, color: 'bg-gradient-to-br from-violet-600 to-violet-800' },
    { name: 'Revenue', value: `Ksh ${totalFinancialStats.income.toLocaleString()}`, label: 'Yearly Income', icon: Wallet, color: 'bg-gradient-to-br from-emerald-600 to-emerald-800' },
  ], [stats, totalFinancialStats.income]);

  // Mock financial data for the "LOOK"
  const incomeData = [
    { month: 'Jan', income: 450000, expense: 320000 },
    { month: 'Feb', income: 520000, expense: 410000 },
    { month: 'Mar', income: 490000, expense: 380000 },
    { month: 'Apr', income: 223650, expense: 0 },
  ];

  const yearlyData = [
    { month: 'Jan', income: 1008800, expense: 86300 },
    { month: 'Feb', income: 250000, expense: 120000 },
    { month: 'Mar', income: 110000, expense: 40000 },
    { month: 'Apr', income: 223650, expense: 0 },
  ];

  // Chart Data Calculation
  const performanceData = React.useMemo(() => {
    const data = [
      { name: 'Pass', value: 0, color: '#10B981' },
      { name: 'Fail', value: 0, color: '#EF4444' },
      { name: 'Ungraded', value: 0, color: '#94A3B8' }
    ];

    submissions.forEach(sub => {
      const exam = exams.find(e => e.id === sub.examId);
      if (!exam) return;
      
      if (sub.grade === undefined || sub.grade === null) {
        data[2].value++;
      } else if (sub.grade >= (exam.passingMarks || 40)) {
        data[0].value++;
      } else {
        data[1].value++;
      }
    });
    return data;
  }, [submissions, exams]);

  const userDistributionData = React.useMemo(() => [
    { name: 'Students', value: stats.students, color: '#17c2d7' },
    { name: 'Teachers', value: stats.teachers, color: '#8e54e9' },
    { name: 'Parents', value: stats.parents, color: '#4776e6' },
    { name: 'Staff', value: stats.staff, color: '#d63384' }
  ].filter(d => d.value > 0), [stats]);

  const calendarDays = React.useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const hasChartData = performanceData.some(d => d.value > 0);

  const studentAttendanceStats = React.useMemo(() => {
    if (!myAttendance.length) return { present: 0, total: 0, percentage: 0 };
    const targetStudentId = studentContext?.uid || user!.uid;
    const total = myAttendance.length;
    const present = myAttendance.filter(r => r.records[targetStudentId] === 'present' || r.records[targetStudentId] === 'late').length;
    return { present, total, percentage: Math.round((present / total) * 100) };
  }, [myAttendance, user, studentContext]);

  const verifiedToday = React.useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const targetStudentId = studentContext?.uid || user!.uid;
    const record = myAttendance.find(r => r.date === today);
    return !!record?.biometricLogs?.[targetStudentId];
  }, [myAttendance, user, studentContext]);

  // Student Portal Component
  const renderStudentPortal = () => {
    const isParent = userData?.role === 'parent';
    const displayStudent = isParent ? studentContext : userData;

    const pendingAssignmentsCount = exams.filter(e => {
      const isSubmitted = submissions.some(s => s.examId === e.id);
      return !isSubmitted && e.dueDate && new Date(e.dueDate) > new Date();
    }).length;

    const now = new Date();
    const dateStr = format(now, 'EEE, MMM d');

    return (
      <div className="space-y-6 pb-20 -mt-4">
        {/* Top Header - Mobile Specific */}
        <div className="flex items-center justify-between lg:hidden mb-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/10 ring-2 ring-blue-500/20 shadow-2xl">
                {displayStudent?.photoUrl ? (
                  <img src={displayStudent.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white font-bold text-xl">
                    {displayStudent?.name?.charAt(0)}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-[#0B1221] rounded-full" />
            </div>
            
            <div className="max-w-[150px] sm:max-w-none">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded-md uppercase tracking-widest border border-blue-500/10">Active</span>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{isParent ? "Child" : "Student"}</p>
              </div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight truncate">
                {displayStudent?.name?.split(' ')[0] || "Student"} <span className="animate-bounce inline-block">👋</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="bg-white p-1 rounded-xl shadow-xl shadow-black/20 transform hover:scale-110 transition-transform">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                  BI
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Program & Date Row */}
        <div className="flex items-center justify-between">
          <div className="bg-blue-600/10 px-5 py-2.5 rounded-2xl border border-blue-500/20 flex items-center gap-2.5 backdrop-blur-md">
            <GraduationCap size={18} className="text-blue-400" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
              {displayStudent?.classIds?.[0] ? classes.find(c => c.id === displayStudent.classIds[0])?.name || "Diploma in ICT" : "Diploma in ICT"}
            </span>
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{dateStr}</p>
        </div>

        {/* Highlights Banner */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-blue-600/10 p-7 rounded-[32px] border border-blue-500/10 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-6 text-blue-400/20 group-hover:scale-110 transition-transform duration-500">
            <TrendingUp size={80} />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-400 mb-4">
              <BookOpen size={20} />
            </div>
            <p className="text-xl font-bold text-blue-100 leading-snug">
              {isParent ? "Selected student has" : "You have"} <span className="text-blue-400 font-extrabold">{todayLessons.length} classes</span> today and <span className="text-blue-400 font-extrabold">{pendingAssignmentsCount} pending</span> assignment
            </p>
          </div>
        </motion.div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
           <Link to="/fees" className="bg-[#1A1F2E] p-7 rounded-[32px] border border-white/5 space-y-6 hover:bg-white/5 transition-colors group shadow-lg">
             <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
               <Wallet size={24} />
             </div>
             <div>
               <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">KSh {feeBalance?.balance?.toLocaleString() || "0"}</h3>
               <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">Fees Balance <br/> remaining</p>
             </div>
           </Link>

           <div className="bg-[#1A1F2E] p-7 rounded-[32px] border border-white/5 space-y-6 shadow-lg">
             <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
               <Clock size={24} />
             </div>
             <div>
               <h3 className="text-2xl font-bold text-white tracking-tight">{nextLesson?.startTime || "--:--"}</h3>
               <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.2em] mt-1 leading-relaxed">
                 Next Class <br/> 
                 <span className="text-gray-400 truncate block max-w-full">{nextLesson?.unitName || "No Classes"}</span>
               </p>
             </div>
           </div>

           <Link to="/attendance" className="bg-[#1A1F2E] p-7 rounded-[32px] border border-white/5 space-y-6 hover:bg-white/5 transition-colors group shadow-lg">
             <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${verifiedToday ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary/10 text-primary'}`}>
                  <ClipboardCheck size={24} />
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${verifiedToday ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-500'}`}>
                    {verifiedToday ? 'Verified' : 'Pending'}
                  </span>
                </div>
             </div>
             <div>
               <h3 className="text-2xl font-bold text-white tracking-tight">{studentAttendanceStats.percentage}%</h3>
               <div className="mt-2 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                 <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${studentAttendanceStats.percentage}%` }}
                    className={`h-full rounded-full ${studentAttendanceStats.percentage >= 75 ? 'bg-emerald-500' : studentAttendanceStats.percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                 />
               </div>
               <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.2em] mt-3">Monthly Attendance</p>
             </div>
           </Link>
        </div>

        {/* Notice Board Section for Students */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
              <span className="w-1.5 h-6 bg-primary rounded-full" />
              Notice Board
            </h3>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg shadow-rose-500/20">
                {notifications.filter(n => !n.read).length} NEW
              </span>
            )}
          </div>
          
          <div className="space-y-4">
            {notifications.length > 0 ? (
              notifications.slice(0, 5).map((notif, idx) => (
                <motion.div
                  key={`${notif.id}_student_${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-6 rounded-[32px] border transition-all relative overflow-hidden group ${
                    !notif.read 
                    ? 'bg-[#1A1F2E] border-primary/20' 
                    : 'bg-[#1A1F2E]/40 border-white/5 opacity-80'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl shrink-0 ${
                      notif.type === 'fee' ? 'bg-amber-500/10 text-amber-500' :
                      notif.type === 'exam' ? 'bg-primary/10 text-primary' :
                      'bg-success/10 text-success'
                    }`}>
                      {notif.type === 'fee' ? <Wallet size={18} /> :
                       notif.type === 'exam' ? <FileText size={18} /> :
                       <Bell size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="font-bold text-base text-white tracking-tight break-words">{notif.title}</h4>
                        <span className="text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">
                          {format(new Date(notif.createdAt), 'MMM dd')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed break-words whitespace-pre-wrap">{notif.message}</p>
                      
                      {notif.attachmentUrl && (
                        <a
                          href={notif.attachmentUrl.startsWith('http') ? `/api/download?url=${encodeURIComponent(notif.attachmentUrl)}&filename=${encodeURIComponent(notif.attachmentName || 'attachment')}` : notif.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl text-[10px] font-bold text-blue-400 uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                        >
                          <Paperclip size={12} /> View Attachment
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-[#1A1F2E] p-10 rounded-[32px] border border-white/5 text-center">
                <Bell className="mx-auto text-gray-800 mb-3 opacity-20" size={32} />
                <p className="text-gray-600 font-bold uppercase tracking-widest text-[10px]">No recent announcements</p>
              </div>
            )}
            {notifications.length > 5 && (
              <Link to="/messages" className="block text-center text-[10px] font-bold text-primary uppercase tracking-widest hover:underline py-2">
                View All Messages
              </Link>
            )}

            {/* Global Archive for Students */}
            {sentAnnouncements.length > 0 && (
              <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-2">Global System Broadcasts</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sentAnnouncements.slice(0, 4).map((notif, idx) => (
                    <div key={`${notif.id}_student_announcement_${idx}`} className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-[9px] font-bold text-primary uppercase tracking-widest">
                          {format(new Date(notif.createdAt), 'MMM dd')}
                        </p>
                        <Megaphone size={12} className="text-primary opacity-40" />
                      </div>
                      <h4 className="text-xs font-bold text-white line-clamp-1 truncate uppercase">{notif.title}</h4>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Daily Schedule Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
              Today's Schedule
            </h3>
            <Link to="/timetable" className="text-xs font-bold text-blue-400 uppercase tracking-widest hover:underline">Full Timetable</Link>
          </div>

          <div className="space-y-4">
            {todayLessons.length > 0 ? (
              todayLessons.map((lesson, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={`${lesson.id}_${idx}`} 
                  className="bg-[#1A1F2E] p-6 rounded-[32px] border border-white/5 flex items-center justify-between relative overflow-hidden group hover:border-white/10 transition-all"
                >
                  <div className="flex items-center gap-6">
                    <div className="text-center min-w-[70px]">
                      <p className="text-xl font-bold text-white">{lesson.startTime}</p>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                        {parseInt(lesson.startTime) >= 12 ? 'PM' : 'AM'}
                      </p>
                    </div>
                    <div className="w-px h-12 bg-white/10" />
                    <div>
                      <h4 className="text-base font-bold text-white leading-none tracking-tight mb-2">{lesson.unitName}</h4>
                      <div className="flex items-center gap-2">
                         <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{lesson.teacherName}</span>
                         <span className="w-1 h-1 bg-gray-700 rounded-full" />
                         <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{lesson.room}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Indicator or Join Button */}
                  <div className="flex items-center gap-3">
                    {idx === 1 && ( // Match image's visual where second item has a join button
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => addToast("Connecting to live session...", "success")}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-600/30 active:bg-blue-700"
                      >
                        Join Class <Video size={14} />
                      </motion.button>
                    )}
                    <div className={`w-1.5 h-12 rounded-full ${idx === 0 ? 'bg-slate-700' : 'bg-blue-500'} transition-all`} />
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-[#1A1F2E] p-12 rounded-[32px] border border-white/5 text-center">
                <Calendar className="mx-auto text-gray-800 mb-4" size={48} />
                <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-xs">No Classes Scheduled Today</p>
              </div>
            )}
          </div>
        </div>

        {/* Share App Section */}
        <ShareAppCard />
      </div>
    );
  };

  const renderTeacherPortal = () => {
    const now = new Date();
    const dateStr = format(now, 'EEE, MMM d');
    
    return (
      <div className="space-y-8 pb-20 -mt-4">
        {/* Top Header - Teacher Specific */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                <Sparkles size={32} />
              </div>
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-[0.3em] mb-1">Faculty Portal</p>
                <h1 className="text-4xl font-bold text-text-primary tracking-tight">Main Dashboard</h1>
              </div>
            </div>
            <p className="text-lg font-medium text-text-secondary max-w-2xl">
              Good {format(now, 'a') === 'AM' ? 'Morning' : 'Afternoon'}, Lecturer {userData?.name?.split(' ')[0]}. You have <span className="text-primary font-bold">{todayLessons.length} units</span> to facilitate today.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-bg-card/40 backdrop-blur-md px-6 py-4 rounded-[24px] border border-white/5 flex flex-col items-end">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{dateStr}</span>
              <span className="text-sm font-bold text-text-primary tracking-tight">{format(now, 'HH:mm')} System Time</span>
            </div>
          </div>
        </div>

        {/* Highlights Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-[40px] shadow-2xl shadow-blue-600/20 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <BookOpen size={100} />
            </div>
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60 mb-2">My Units</p>
                <h3 className="text-4xl font-bold">{stats.units}</h3>
              </div>
              <Link to="/my-units" className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:underline">
                View All <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="bg-bg-card p-8 rounded-[40px] border border-white/5 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 text-emerald-500/10 group-hover:scale-110 transition-transform duration-700">
              <ClipboardCheck size={100} />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted mb-2">Teaching Students</p>
            <h3 className="text-4xl font-bold text-text-primary">{stats.students}</h3>
            <p className="text-xs font-bold text-success/80 mt-2 uppercase tracking-wide">Across all categories</p>
          </div>

          <div className="bg-bg-card p-8 rounded-[40px] border border-white/5 shadow-xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-6 text-primary/10 group-hover:scale-110 transition-transform duration-700">
              <FileText size={100} />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted mb-2">Active Assessments</p>
            <h3 className="text-4xl font-bold text-text-primary">{stats.exams}</h3>
            <Link to="/exams" className="mt-4 inline-block text-xs font-bold text-primary uppercase tracking-widest hover:underline">
              Create New
            </Link>
          </div>

          {nextLesson ? (
            <div className="bg-primary p-8 rounded-[40px] shadow-2xl shadow-primary/30 text-white relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-6 text-white/10 group-hover:scale-110 transition-transform duration-700">
                <Clock size={100} />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60 mb-2">Next up @ {nextLesson.startTime}</p>
              <h3 className="text-xl font-bold truncate">{nextLesson.unitName}</h3>
              <div className="flex items-center gap-2 mt-2">
                <MapPin size={14} className="text-white/60" />
                <span className="text-xs font-bold uppercase tracking-widest">{nextLesson.room || 'TBA'}</span>
              </div>
            </div>
          ) : (
             <div className="bg-white/5 p-8 rounded-[40px] border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
               <Clock size={32} className="text-text-muted/20 mb-2" />
               <p className="text-xs font-bold text-text-muted/40 uppercase tracking-widest">No more lessons</p>
             </div>
          )}
        </div>

        {/* Schedule & Announcements Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between px-2">
               <h2 className="text-primary font-bold uppercase tracking-[0.25em] text-sm flex items-center gap-3">
                 <span className="w-1.5 h-6 bg-primary rounded-full" />
                 Today's Facilitation Schedule
               </h2>
               <Link to="/timetable" className="text-xs font-bold text-primary uppercase tracking-widest hover:underline px-4 py-2 bg-primary/5 rounded-xl border border-primary/10">
                 Full Calendar
               </Link>
            </div>

            <div className="space-y-5">
              {todayLessons.length > 0 ? (
                todayLessons.map((lesson, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      key={`${lesson.id}_${idx}`}
                      className="bg-bg-card p-8 rounded-[40px] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-primary/20 transition-all group shadow-xl hover:shadow-primary/5"
                    >
                    <div className="flex items-center gap-8">
                      <div className="text-center min-w-[90px] border-r border-white/5 pr-8">
                        <p className="text-2xl font-bold text-text-primary">{lesson.startTime}</p>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mt-1">Start Time</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                           <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lesson.color || '#3b82f6' }} />
                           <h4 className="text-xl font-bold text-text-primary tracking-tight leading-none group-hover:text-primary transition-colors">{lesson.unitName}</h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                           <div className="flex items-center gap-2 text-text-muted">
                             <Users size={14} className="text-emerald-500" />
                             <span className="text-[10px] font-bold uppercase tracking-widest">Target Class: {classes.find(c => c.id === lesson.classId)?.name || 'Unknown'}</span>
                           </div>
                           <div className="flex items-center gap-2 text-text-muted">
                             <MapPin size={14} className="text-amber-500" />
                             <span className="text-[10px] font-bold uppercase tracking-widest">Venue: {lesson.room || 'TBA'}</span>
                           </div>
                           <div className="flex items-center gap-2 text-text-muted">
                             <Clock size={14} className="text-primary" />
                             <span className="text-[10px] font-bold uppercase tracking-widest">Duration: {lesson.startTime} — {lesson.endTime}</span>
                           </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <Link 
                        to={`/timetable`}
                        className="w-full sm:w-auto bg-white/5 hover:bg-primary transition-all text-text-primary hover:text-white px-8 py-3.5 rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2 group/btn active:scale-95"
                      >
                        Class Info <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="bg-bg-card p-20 rounded-[40px] border-2 border-dashed border-white/5 text-center group">
                   <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center mx-auto mb-6 opacity-40 group-hover:scale-110 transition-transform">
                      <Calendar size={40} className="text-text-muted" />
                   </div>
                   <h3 className="text-xl font-bold text-text-primary mb-2">No Facilitation Today</h3>
                   <p className="text-sm font-medium text-text-muted uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                     Your teaching schedule is clear for today. Use this time for curriculum development.
                   </p>
                </div>
              )}
            </div>

             {/* Recent Assessment Activity */}
             <div className="pt-6 space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-primary font-bold uppercase tracking-[0.25em] text-sm flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                    Pending Gradings
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   {recentExams.filter(e => e.teacherId === user.uid).map((exam, idx) => (
                    <div key={`${exam.id}_pending_gradings_${idx}`} className="bg-bg-card/40 p-6 rounded-[32px] border border-white/5 flex flex-col justify-between hover:bg-bg-card transition-colors shadow-lg">
                       <div>
                         <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                               <Award size={20} />
                            </div>
                            <h4 className="text-sm font-bold text-text-primary tracking-tight leading-tight line-clamp-1 uppercase">{exam.title}</h4>
                         </div>
                         <div className="flex items-center justify-between mb-4">
                           <div className="text-center bg-white/5 px-4 py-2 rounded-xl">
                              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest leading-none mb-1">Submissions</p>
                              <p className="text-lg font-bold text-text-primary">--</p>
                           </div>
                           <div className="text-center bg-white/5 px-4 py-2 rounded-xl">
                              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest leading-none mb-1">Graded</p>
                              <p className="text-lg font-bold text-text-primary">--</p>
                           </div>
                         </div>
                       </div>
                       <Link to="/marks-register" className="w-full py-3 bg-indigo-500/10 hover:bg-indigo-500 transition-all text-indigo-500 hover:text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest text-center shadow-lg active:scale-95">
                         Open Register
                       </Link>
                    </div>
                   ))}
                   {recentExams.filter(e => e.teacherId === user.uid).length === 0 && (
                     <div className="col-span-1 md:col-span-2 py-6 bg-white/5 rounded-3xl text-center">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest italic">No pending assessment data</p>
                     </div>
                   )}
                </div>
             </div>
          </div>

          <div className="space-y-8">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
               <div className="bg-white/5 w-14 h-14 rounded-2xl flex items-center justify-center mb-10 border border-white/10">
                  <Megaphone size={28} className="text-primary" />
               </div>
               <h3 className="text-2xl font-bold text-text-primary mb-3 tracking-tight">Announcements</h3>
               <p className="text-text-muted font-medium text-sm mb-10 leading-relaxed">
                 Broadcast direct academic notices to your units or general student body.
               </p>
               <button 
                onClick={() => setIsAnnouncing(true)}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary-hover transition-all active:scale-95"
               >
                 <Plus size={18} /> New Broadcast
               </button>
            </div>

            <div className="bg-bg-card p-8 rounded-[40px] border border-white/5 shadow-xl">
               <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                      <MessageSquare size={20} />
                   </div>
                   <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Class Group Chats</h3>
                 </div>
                 <Link to="/whatsapp" className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">
                   Open Chat
                 </Link>
               </div>
               <div className="space-y-3">
                 {chatRooms.filter(r => r.type === 'group').length > 0 ? (
                   chatRooms.filter(r => r.type === 'group').slice(0, 5).map((room, idx) => (
                     <Link 
                       key={`${room.id || 'room'}_${idx}`} 
                       to="/whatsapp" 
                       state={{ openClassId: room.classId }}
                       className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors group"
                     >
                        <div className="w-10 h-10 rounded-xl bg-[#D9FDD3] flex items-center justify-center text-[#06CF9C] shrink-0">
                          <Users size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="text-xs font-bold text-text-primary truncate uppercase">{room.name}</h4>
                            <span className="text-[9px] text-text-muted font-bold">
                              {room.lastMessageAt ? format(new Date(room.lastMessageAt), 'p') : ''}
                            </span>
                          </div>
                          <p className="text-[10px] text-text-muted mt-1 truncate italic">
                            {room.lastMessage || 'No messages yet'}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-text-muted group-hover:translate-x-1 transition-transform" />
                     </Link>
                   ))
                 ) : (
                   <div className="text-center py-6 border-2 border-dashed border-white/5 rounded-3xl">
                     <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest italic opacity-40">No active group chats</p>
                   </div>
                 )}
               </div>
            </div>

            <div className="bg-bg-card p-8 rounded-[40px] border border-white/5 shadow-xl">
               <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                      <Bell size={20} />
                   </div>
                   <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Notice Board</h3>
                 </div>
                 {notifications.filter(n => !n.read).length > 0 && (
                   <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                     {notifications.filter(n => !n.read).length} NEW
                   </span>
                 )}
               </div>
               <div className="space-y-4">
                  {/* Show combination of received notifications and sent announcements */}
                  <div className="space-y-1 mb-4">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-1">Received Notices</p>
                    {notifications.length > 0 ? (
                      notifications.slice(0, 3).map((notif, idx) => (
                        <div 
                          key={`${notif.id}_unread_${idx}`} 
                          onClick={() => setViewingNotif(notif)}
                          className={`flex gap-4 p-4 rounded-2xl transition-colors cursor-pointer group ${!notif.read ? 'bg-primary/5 hover:bg-primary/10' : 'bg-white/5 hover:bg-white/10'}`}
                        >
                           <div className={`flex-shrink-0 w-1.5 h-10 rounded-full transition-all ${notif.type === 'grade' ? 'bg-amber-500' : notif.type === 'fee' ? 'bg-indigo-500' : 'bg-primary'}`} />
                           <div className="min-w-0 flex-1">
                             <div className="flex justify-between items-start gap-2">
                               <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{format(new Date(notif.createdAt), 'MMM dd')}</p>
                               {!notif.read && <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />}
                             </div>
                             <h4 className={`text-xs font-bold leading-tight uppercase break-words ${!notif.read ? 'text-primary' : 'text-text-primary'}`}>{notif.title}</h4>
                             <p className="text-[10px] text-text-muted mt-1 line-clamp-1 break-words">{notif.message}</p>
                           </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-4 text-[10px] font-bold text-text-muted/40 uppercase italic tracking-widest">No incoming notices</p>
                    )}
                  </div>

                  <div className="space-y-1 border-t border-white/5 pt-4">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-1">Recent System Broadcasts</p>
                    {sentAnnouncements.slice(0, 5).map((notif, idx) => (
                      <div 
                        key={`${notif.id}_announcement_${idx}`} 
                        onClick={() => setViewingNotif(notif)}
                        className="flex gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                      >
                         <div className="flex-shrink-0 w-1.5 h-10 rounded-full bg-emerald-500/40 group-hover:h-full transition-all" />
                         <div className="min-w-0 flex-1">
                           <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{format(new Date(notif.createdAt), 'MMM dd')} • By {(notif as any).senderName || 'Staff'}</p>
                           <h4 className="text-xs font-bold text-text-primary leading-tight uppercase break-words">{notif.title}</h4>
                           <p className="text-[10px] text-text-muted mt-1 line-clamp-1">{notif.message}</p>
                         </div>
                      </div>
                    ))}
                    {sentAnnouncements.length === 0 && (
                      <p className="text-center py-4 text-xs font-bold text-text-muted/40 uppercase italic tracking-widest">No sent messages</p>
                    )}
                  </div>
               </div>
            </div>

            <div className="bg-bg-card p-8 rounded-[40px] border border-white/5 shadow-xl">
               <h3 className="font-bold text-text-primary uppercase tracking-widest text-xs mb-6 flex items-center gap-3">
                 <ClipboardCheck size={18} className="text-success" /> Attendance Summary
               </h3>
               <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-2xl flex items-center justify-between">
                     <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Today's Class Average</span>
                     <span className="text-sm font-bold text-success">--%</span>
                  </div>
                  <Link to="/attendance" className="w-full py-4 text-primary font-bold text-[10px] uppercase tracking-widest text-center block hover:bg-primary/5 rounded-2xl transition-all">
                    Register Attendance
                  </Link>
               </div>
            </div>

            <ShareAppCard />
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    if (userData?.role === 'student' || userData?.role === 'parent') return renderStudentPortal();
    if (isTeacher) return renderTeacherPortal();
    
    return (
      <div className="space-y-10 relative">
        {/* Decorative Background Accents */}
        <div id="acc-bg-top-right" className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-blue-400/5 rounded-full blur-[100px] pointer-events-none" />
        <div id="acc-bg-bottom-left" className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-400/5 rounded-full blur-[100px] pointer-events-none" />
        <div id="acc-bg-mid" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-400/[0.02] rounded-full blur-[120px] pointer-events-none" />

        <motion.div 
          id="dashboard-welcome-banner"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-blue-900 p-8 sm:p-12 rounded-[40px] text-white shadow-2xl shadow-blue-900/20"
        >
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-60 h-60 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div>
              <h1 id="welcome-title" className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                Hello, {userData?.name?.split(' ')[0]}! 👋
              </h1>
              <p id="welcome-subtitle" className="text-blue-100/80 text-sm sm:text-base font-medium max-w-lg leading-relaxed">
                Welcome back to {settings?.appTitle || 'BITC'}. Everything is looking session-ready.
              </p>
            </div>
          </div>
        </motion.div>

      <div id="dashboard-quick-stats" className="bg-bg-card/40 backdrop-blur-md p-6 rounded-[32px] border border-white/5 scroll-mt-20">
        <h2 className="text-primary font-bold mb-6 uppercase tracking-widest text-[10px]">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((stat, idx) => (
            <Link
              to={stat.name === 'Attendance' ? '/attendance' : stat.name === 'Total' ? '/students' : stat.name === 'Student' ? '/students' : '/dashboard'}
              key={`${stat.name}_${idx}`}
              className={`${stat.color} p-4 rounded-2xl text-white shadow-lg shadow-gray-200/50 flex flex-col justify-between min-h-[110px] transition-transform hover:scale-[1.05] cursor-pointer`}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-tight break-words text-white/70">{stat.name}</span>
                <span className="text-lg sm:text-xl font-bold break-all leading-tight">{stat.value}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs font-bold opacity-80 uppercase tracking-widest leading-none">{stat.label}</p>
                <stat.icon size={16} className="opacity-40" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {hasPermission('view_finance') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Monthly Chart */}
          <div className="bg-bg-card p-8 rounded-[32px] border border-white/5 shadow-2xl flex flex-col h-[500px]">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h2 className="text-primary font-bold">Income and Expenses for {format(new Date(), 'MMM yyyy')}</h2>
              <div className="flex items-center gap-2">
                <div className="bg-white/5 border border-white/10 p-2 rounded-xl text-text-muted hover:bg-white/10 transition-colors cursor-pointer"><ChevronDown size={20} /></div>
                <Link to="/fees" className="bg-primary p-2 rounded-xl text-white hover:bg-primary-hover transition-colors cursor-pointer"><Plus size={20} /></Link>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
              <div className="space-y-1">
                <p className="text-primary font-bold text-sm">Ksh {totalFinancialStats.income.toLocaleString()}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-tight">{new Date().getFullYear()} Income</p>
              </div>
              <div className="space-y-1">
                <p className="text-primary font-bold text-sm">Ksh {totalFinancialStats.billings.toLocaleString()}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-tight">{new Date().getFullYear()} Billable</p>
              </div>
              <div className="space-y-1">
                <p className="text-primary font-bold text-sm">Ksh {totalFinancialStats.expenses.toLocaleString()}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-tight">{new Date().getFullYear()} Expense</p>
              </div>
              <div className="space-y-1">
                <p className="text-primary font-bold text-sm">Ksh {totalFinancialStats.profit.toLocaleString()}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-tight">{new Date().getFullYear()} Profit</p>
              </div>
              <div className="sm:text-right">
                <p className="text-success font-bold text-sm">Ksh {totalFinancialStats.outstanding.toLocaleString()}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-tight">Total Outstanding</p>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <div className="h-full relative overflow-hidden flex items-end justify-around px-10 pb-4">
                {realFinancialData.map((data, i) => {
                  const maxVal = Math.max(...realFinancialData.map(d => Math.max(d.income, d.expense, d.billings)), 1);
                  const incomeH = (data.income / maxVal) * 80;
                  const billingH = (data.billings / maxVal) * 80;
                  const expenseH = (data.expense / maxVal) * 80;
                  return (
                    <div key={`${data.month}_${i}`} className="flex gap-1 items-end h-full w-6 relative">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${billingH}%` }}
                        className="w-1.5 bg-blue-400 opacity-60 rounded-full" 
                        title={`Billable: ${data.billings}`}
                      />
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${incomeH}%` }}
                        className="w-1.5 bg-[#8e54e9] rounded-full" 
                        title={`Collected: ${data.income}`}
                      />
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${expenseH}%` }}
                        className="w-1.5 bg-red-400 rounded-full" 
                        title={`Expense: ${data.expense}`}
                      />
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-400">{data.month}</span>
                    </div>
                  );
                })}
                <div className="absolute inset-0 flex flex-col justify-between py-10 pointer-events-none">
                  <div className="w-full h-px bg-gray-50" />
                  <div className="w-full h-px bg-gray-50" />
                  <div className="w-full h-px bg-gray-50" />
                  <div className="w-full h-px bg-gray-50" />
                </div>
                
                <div className="absolute right-10 top-1/2 -translate-y-1/2 bg-white border border-purple-200 shadow-xl rounded-xl p-4 z-10 pointer-events-none text-bg-main">
                  <p className="text-xl font-bold text-purple-600 text-center">{realFinancialData.length}</p>
                  <div className="space-y-1 mt-2">
                      <p className="text-xs flex justify-between gap-4 text-gray-400 font-bold uppercase">Income: <span className="text-gray-900">{totalFinancialStats.income}</span></p>
                      <p className="text-xs flex justify-between gap-4 text-gray-400 font-bold uppercase">Expense: <span className="text-gray-900">{totalFinancialStats.expenses}</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Yearly Chart */}
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col h-[500px]">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h2 className="text-blue-600 font-bold">Financial Summary {new Date().getFullYear()}</h2>
              <div className="flex items-center gap-2">
                <div className="bg-gray-50 border border-gray-100 p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"><ChevronDown size={20} /></div>
                <div className="bg-indigo-600 p-2 rounded-xl text-white hover:bg-indigo-700 transition-colors cursor-pointer"><XCircle size={20} /></div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
              <div className="space-y-1">
                <p className="text-blue-600 font-bold text-sm">Ksh {totalFinancialStats.income.toLocaleString()}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Yearly Collected</p>
              </div>
              <div className="space-y-1">
                <p className="text-blue-600 font-bold text-sm">Ksh {totalFinancialStats.billings.toLocaleString()}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Yearly Billable</p>
              </div>
              <div className="space-y-1">
                <p className="text-blue-600 font-bold text-sm">Ksh {totalFinancialStats.expenses.toLocaleString()}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Yearly Expense</p>
              </div>
              <div className="space-y-1">
                <p className="text-blue-600 font-bold text-sm">Ksh {totalFinancialStats.profit.toLocaleString()}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Yearly Profit</p>
              </div>
              <div className="sm:text-right">
                <p className="text-blue-600 font-bold text-sm">Ksh {totalFinancialStats.lifetimeIncome.toLocaleString()}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Lifetime Income</p>
              </div>
            </div>

            <div className="flex-1 min-h-0 relative px-4 text-center flex items-center justify-center border-t border-gray-50">
               <div className="space-y-4">
                  <div className="flex items-center gap-4 justify-center">
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 bg-blue-400 opacity-60 rounded-full" />
                       <span className="text-xs text-gray-500 font-bold uppercase">Billable</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 bg-purple-600 rounded-full" />
                       <span className="text-xs text-gray-500 font-bold uppercase">Collected</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 bg-red-400 rounded-full" />
                       <span className="text-xs text-gray-500 font-bold uppercase">Expenses</span>
                    </div>
                  </div>
                 <p className="text-gray-400 text-sm">Dashboard is now synchronized with current financial records.</p>
               </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-bg-card p-6 sm:p-8 rounded-[32px] border border-white/5 shadow-xl flex items-center justify-between">
        <h2 className="text-primary font-bold uppercase tracking-widest text-sm flex items-center gap-3">
          <Megaphone className="rotate-[-10deg] animate-bounce text-primary" size={24} /> Notice Board
        </h2>
        {(userData?.role === 'admin' || userData?.role === 'teacher' || userData?.role === 'staff') && (
          <button 
            onClick={() => setIsAnnouncing(true)}
            className="bg-primary hover:bg-primary-hover transition-colors text-white px-6 sm:px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus size={18} /> Add
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-primary font-bold uppercase tracking-widest text-xs">Recent Messages</h2>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg shadow-rose-500/20">
                {notifications.filter(n => !n.read).length} NEW
              </span>
            )}
          </div>
          
          <div className="space-y-4">
            {notifications.length > 0 ? (
              notifications.slice(0, 5).map((notif, idx) => (
                <motion.div
                  key={`${notif.id}_${idx}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ y: -2 }}
                  className={`p-6 rounded-[32px] border transition-all relative overflow-hidden group ${
                    !notif.read 
                    ? 'bg-bg-card border-primary/20 shadow-xl shadow-primary/5' 
                    : 'bg-bg-card/40 border-white/5 opacity-80'
                  }`}
                >
                  {!notif.read && (
                    <div className="absolute top-0 right-0 p-4">
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          await updateDoc(doc(db, 'notifications', notif.id), { read: true });
                        }}
                        className="text-xs font-bold text-primary uppercase tracking-widest hover:underline"
                      >
                        Mark as Read
                      </button>
                    </div>
                  )}
                  <div className="flex items-start gap-5">
                    <div className={`p-4 rounded-[20px] shrink-0 shadow-sm ${
                      notif.type === 'fee' ? 'bg-amber-500/10 text-amber-500' :
                      notif.type === 'exam' ? 'bg-primary/10 text-primary' :
                      notif.type === 'grade' ? 'bg-indigo-500/10 text-indigo-500' :
                      'bg-success/10 text-success'
                    }`}>
                      {notif.type === 'fee' ? <Wallet size={20} /> :
                       notif.type === 'exam' ? <FileText size={20} /> :
                       notif.type === 'grade' ? <GraduationCap size={20} /> :
                       <Bell size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                        <h4 className={`font-bold text-sm tracking-tight break-words ${!notif.read ? 'text-text-primary' : 'text-text-secondary'}`}>{notif.title}</h4>
                        <span className="text-xs font-bold text-text-muted uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg">
                          {format(new Date(notif.createdAt), 'MMM dd, HH:mm')}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed mb-4 break-words font-medium line-clamp-3 md:line-clamp-none ${!notif.read ? 'text-text-secondary' : 'text-text-muted'}`}>{notif.message}</p>
                      
                      <div className="flex flex-wrap gap-3">
                        {notif.attachmentUrl && (
                          <a
                            href={notif.attachmentUrl.startsWith('http') ? `/api/download?url=${encodeURIComponent(notif.attachmentUrl)}&filename=${encodeURIComponent(notif.attachmentName || 'attachment')}` : notif.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 rounded-2xl transition-all group/btn"
                          >
                            {notif.attachmentType === 'image' ? <ImageIcon size={16} className="text-primary" /> : <FileIcon size={16} className="text-rose-500" />}
                            <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                              {notif.attachmentName || 'View Attachment'}
                            </span>
                            <Download size={14} className="text-text-muted group-hover/btn:translate-y-1 transition-transform" />
                          </a>
                        )}
                        {notif.link && (
                          <Link
                            to={notif.link}
                            onClick={async () => {
                              if (!notif.read) await updateDoc(doc(db, 'notifications', notif.id), { read: true });
                            }}
                            className="inline-flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest hover:underline"
                          >
                            View Details <ArrowRight size={14} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-bg-card p-12 rounded-[40px] border border-white/5 text-center space-y-4 shadow-xl">
                <div className="bg-white/5 w-20 h-20 rounded-[32px] flex items-center justify-center mx-auto text-text-muted opacity-20">
                  <Bell size={36} />
                </div>
                <p className="text-text-muted font-bold text-xs uppercase tracking-widest">Inbox is clear</p>
              </div>
            )}
          </div>

          {/* Global Archive for Admins */}
          {sentAnnouncements.length > 0 && (
            <div className="mt-12 space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-primary font-bold uppercase tracking-[0.2em] text-xs flex items-center gap-2">
                  <Megaphone size={14} /> System Broadcast Archive
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sentAnnouncements.slice(0, 6).map((notif, idx) => (
                  <motion.div
                    key={`${notif.id}_archive_${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-5 rounded-[24px] bg-bg-card/40 border border-white/5 hover:border-primary/20 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md">
                        {format(new Date(notif.createdAt), 'MMM dd, yyyy')}
                      </span>
                      <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest italic">
                        Sent by {(notif as any).senderName || 'Staff'}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-text-primary tracking-tight mb-2 group-hover:text-primary transition-colors">{notif.title}</h4>
                    <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">{notif.message}</p>
                    {notif.attachmentUrl && (
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                        <Paperclip size={12} /> Has Attachment
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <h2 className="text-primary font-bold uppercase tracking-[0.2em] text-xs px-2 mt-12">Quick Links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
             {recentExams.map((exam, idx) => (
              <div key={`${exam.id}_recent_${idx}`} className="bg-bg-card p-6 rounded-[32px] border border-white/5 flex items-center justify-between hover:shadow-2xl hover:shadow-primary/10 transition-all group cursor-pointer hover:-translate-y-1 active:scale-95">
                <div className="flex items-center gap-5">
                  <div className="bg-primary/10 p-4 rounded-2xl text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-all duration-500">
                    <FileText size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-text-primary leading-tight mb-1 text-sm tracking-tight">{exam.title}</h4>
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">{format(new Date(exam.createdAt), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <ArrowRight size={16} className="text-text-muted group-hover:text-primary transition-colors" />
                </div>
              </div>
            ))}
            {recentExams.length === 0 && (
               <div className="sm:col-span-2 bg-bg-card/50 border border-white/5 rounded-[32px] p-12 text-center text-text-muted font-bold text-xs uppercase tracking-[0.2em]">
                  No Activity Records
               </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-gradient-to-br from-cyan-500 to-primary rounded-[40px] p-10 text-white shadow-2xl shadow-cyan-500/10 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
              <div className="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-10 backdrop-blur-md">
                <Users size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-3 tracking-tight relative z-10">Directory</h3>
              <p className="text-blue-50 font-medium text-sm mb-10 leading-relaxed opacity-90 relative z-10">
                Manage all student registrations and profiles across all departments.
              </p>
              <Link to="/students" className="block w-full bg-white text-primary font-bold py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl text-center hover:bg-blue-50 transition-all hover:scale-[1.02] active:scale-95">
                Manage List
              </Link>
           </div>

           <div className="bg-gradient-to-br from-purple-600 to-highlight rounded-[40px] p-10 text-white shadow-2xl shadow-purple-600/10 relative overflow-hidden group">
              <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
              <div className="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-10 backdrop-blur-md">
                <Award size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-3 tracking-tight relative z-10">Performance</h3>
              <p className="text-indigo-50 font-medium text-sm mb-10 leading-relaxed opacity-90 relative z-10">
                Review detailed academic metrics and grade distribution analytics.
              </p>
              <Link to="/results" className="block w-full bg-white text-highlight font-bold py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl text-center hover:bg-indigo-50 transition-all hover:scale-[1.02] active:scale-95">
                Analytics Hub
              </Link>
           </div>
        </div>
      </div>
          {/* Calendar Section */}
          <div className="bg-bg-card/40 rounded-3xl p-6 border border-white/5 shadow-xl col-span-1 lg:col-span-2 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-bold text-text-primary tracking-tight">School Calendar</h3>
                <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-0.5">Academic Events & Deadlines</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-white/5 p-1 rounded-full border border-white/10 shadow-sm">
                  <button 
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} 
                    className="p-1.5 hover:bg-white/10 hover:shadow-sm rounded-full text-text-muted hover:text-primary transition-all"
                  >
                    <ArrowRight className="rotate-180" size={12} />
                  </button>
                  <span className="text-xs font-bold uppercase tracking-widest min-w-[110px] text-center text-text-secondary">
                    {format(currentMonth, 'MMMM yyyy')}
                  </span>
                  <button 
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} 
                    className="p-1.5 hover:bg-white/10 hover:shadow-sm rounded-full text-text-muted hover:text-primary transition-all"
                  >
                    <ArrowRight size={12} />
                  </button>
                </div>
                <button 
                  onClick={() => setCurrentMonth(new Date())}
                  className="bg-primary text-white text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
                >
                  Current
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
                <div key={`${d}-${i}`} className="text-xs font-bold text-text-muted text-center pb-2 uppercase tracking-[0.1em]">{d}</div>
              ))}
              {calendarDays.map((day, i) => {
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isWeekendDay = isWeekend(day);
                const hasExam = exams.some(e => {
                  const d = e.examDate || e.dueDate;
                  return d && isSameDay(new Date(d), day);
                });

                return (
                  <div 
                    key={`${day.getTime()}_${i}`} 
                    className={`
                    relative group aspect-[1/1] sm:aspect-[4/3] flex flex-col items-center justify-center rounded-lg transition-all duration-300
                      ${!isCurrentMonth ? 'opacity-10 grayscale' : ''}
                      ${isToday ? 'bg-primary shadow-xl shadow-primary/20 z-10' : 'hover:bg-white/5'}
                      ${hasExam && !isToday ? 'bg-amber-500/10 border border-amber-500/30' : ''}
                      ${isWeekendDay && isCurrentMonth && !isToday && !hasExam ? 'bg-white/5' : ''}
                    `}
                  >
                    <span className={`
                      text-sm font-bold transition-colors
                      ${isToday ? 'text-white' : !isCurrentMonth ? 'text-text-muted/40' : isWeekendDay ? 'text-text-muted/60' : 'text-text-secondary'}
                      ${hasExam && !isToday ? 'text-amber-500 font-extrabold' : ''}
                    `}>
                      {format(day, 'd')}
                    </span>
                    
                    {hasExam && (
                      <div className={`
                        absolute bottom-1 w-1.5 h-1.5 rounded-full
                        ${isToday ? 'bg-amber-200' : 'bg-amber-500'}
                      `} />
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-8 justify-center">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-md shadow-primary/20" />
                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Today</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-white/5 shadow-md shadow-amber-500/20" />
                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Exam Date</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full border border-white/10 bg-white/5" />
                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Weekend</span>
              </div>
            </div>
          </div>

          <div className="bg-bg-card p-6 rounded-[32px] border border-white/5 shadow-xl">
            <h3 className="font-bold text-text-primary mb-6 border-l-4 border-primary pl-3 uppercase text-xs tracking-widest">User Distribution</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={userDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {userDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {userDistributionData.map((d, i) => (
                <div key={`${d.name}_${i}`} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-xs font-bold text-text-muted uppercase">{d.name}: {d.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-bg-card p-6 rounded-[32px] border border-white/5 shadow-xl">
            <h3 className="font-bold text-text-primary mb-4 border-l-4 border-rose-500 pl-3 uppercase text-xs tracking-widest">Upcoming Deadlines</h3>
            <div className="space-y-4">
              {upcomingDeadlines.length > 0 ? (
                upcomingDeadlines.map((exam, idx) => (
                  <div key={`${exam.id}_deadline_${idx}`} className="flex gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors">
                    <div className="flex-shrink-0 w-10 h-10 bg-rose-500/10 rounded-lg flex flex-col items-center justify-center text-rose-500">
                      <span className="text-xs font-bold uppercase">{format(new Date(exam.dueDate!), 'MMM')}</span>
                      <span className="text-base font-bold leading-none">{format(new Date(exam.dueDate!), 'dd')}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-text-primary leading-tight uppercase tracking-tight">{exam.title}</h4>
                      <p className="text-xs font-medium text-text-muted mt-0.5">Due at {format(new Date(exam.dueDate!), 'HH:mm')}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-text-muted/40 text-sm italic">
                  No upcoming deadlines.
                </div>
              )}
              
              {isTeacher && (
                <>
                  <div className="border-t border-white/5 pt-4 mt-4">
                    <p className="text-xs font-bold text-text-muted uppercase mb-3">System Events</p>
                    <div className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors">
                      <div className="flex-shrink-0 w-12 h-12 bg-amber-500/10 rounded-lg flex flex-col items-center justify-center text-amber-500">
                        <span className="text-xs font-bold uppercase">Apr</span>
                        <span className="text-lg font-bold">05</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-text-primary">Staff Meeting</h4>
                        <p className="text-xs text-text-muted">09:00 AM - Room 204</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <ShareAppCard />
        </div>
      );
    };

  return (
    <div className="min-h-screen bg-bg-dark p-4 lg:p-8">
      {renderDashboard()}
      <AnimatePresence>
        {isAnnouncing && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto pt-10 sm:pt-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsAnnouncing(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-bg-card rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-white/10 max-h-[calc(100vh-4rem)] sm:max-h-[85vh] flex flex-col my-auto"
            >
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5 flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-text-primary tracking-tight">Create Announcement</h2>
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5">Broadcast message to portal</p>
                </div>
                <button onClick={() => setIsAnnouncing(false)} className="text-text-muted hover:text-text-primary transition-colors p-2 hover:bg-white/5 rounded-xl">
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSendAnnouncement} className="space-y-4 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                  <input
                    type="checkbox"
                    id="broadcast"
                    checked={newAnnouncement.broadcast}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, broadcast: e.target.checked }))}
                    className="w-4 h-4 text-primary border-white/10 rounded focus:ring-primary bg-bg-dark"
                  />
                  <label htmlFor="broadcast" className="text-xs font-semibold text-text-secondary cursor-pointer">
                    Broadcast to ALL students
                  </label>
                </div>

                {!newAnnouncement.broadcast && (
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 px-1">Target Class</label>
                    <select
                      required
                      value={newAnnouncement.classId}
                      onChange={(e) => setNewAnnouncement(prev => ({ ...prev, classId: e.target.value }))}
                      className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    >
                      <option value="" className="bg-bg-dark">Select Class</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id} className="bg-bg-dark">{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 px-1">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter announcement title"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary placeholder:text-text-muted/40 focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 px-1">Message</label>
                  <textarea
                    required
                    placeholder="Type your message here..."
                    value={newAnnouncement.message}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, message: e.target.value }))}
                    rows={4}
                    className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary placeholder:text-text-muted/40 focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 px-1 flex items-center gap-2">
                    <Paperclip size={14} className="text-text-muted" />
                    Attachment (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-3 border border-dashed border-white/10 rounded-xl p-4 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group">
                      <Paperclip size={16} className="text-text-muted group-hover:text-primary transition-colors" />
                      <span className="text-xs text-text-muted font-medium truncate max-w-[150px]">
                        {attachment ? attachment.name : 'Choose File'}
                      </span>
                      <input 
                        type="file" 
                        onChange={(e) => setAttachment(e.target.files?.[0] || null)} 
                        className="hidden" 
                      />
                    </label>
                    {attachment && (
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                      >
                        <XCircle size={20} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2 sticky bottom-0 bg-bg-card pb-2">
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-widest"
                  >
                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {isUploading ? 'Sending...' : 'Send Announcement'}
                  </button>
                </div>
              </form>

              {isUploading && uploadProgress > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    <span>Uploading Attachment</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      className="h-full bg-primary rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <Toast messages={toasts} onRemove={removeToast} />

      {/* Notice Viewer Modal */}
      <AnimatePresence>
        {viewingNotif && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto pt-10 sm:pt-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingNotif(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-bg-card border border-white/10 rounded-[32px] p-5 sm:p-8 md:p-10 w-full max-w-2xl max-h-[calc(100vh-4rem)] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden my-auto"
            >
               <div className="absolute top-0 left-0 w-full h-2 bg-primary" />
               <div className="flex justify-between items-start mb-6 shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
                        <Bell size={24} />
                     </div>
                     <div>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-1">
                          Notice • {format(new Date(viewingNotif.createdAt), 'MMMM dd, yyyy')}
                        </p>
                        <h2 className="text-xl font-bold text-text-primary uppercase tracking-tight leading-tight">{viewingNotif.title}</h2>
                     </div>
                  </div>
                  <button onClick={() => setViewingNotif(null)} className="p-2 text-text-muted hover:text-white transition-colors">
                     <XCircle size={24} />
                  </button>
               </div>

               <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar space-y-6">
                  <div className="bg-white/5 rounded-3xl p-6 sm:p-8">
                     <p className="text-text-secondary leading-relaxed whitespace-pre-wrap font-medium">
                       {viewingNotif.message}
                     </p>
                  </div>

                  {viewingNotif.attachmentUrl && (
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          {viewingNotif.attachmentType === 'image' ? <ImageIcon size={20} className="text-primary" /> : <FileText size={20} className="text-primary" />}
                          <span className="text-xs font-bold text-text-primary uppercase tracking-widest truncate max-w-[200px]">
                            {viewingNotif.attachmentName || 'View Attachment'}
                          </span>
                       </div>
                       <a 
                         href={viewingNotif.attachmentUrl} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-hover transition-all active:scale-95"
                       >
                         Download
                       </a>
                    </div>
                  )}

                  {viewingNotif.link && (
                    <Link 
                      to={viewingNotif.link} 
                      onClick={() => setViewingNotif(null)}
                      className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                    >
                      Open Related Page <ArrowRight size={16} />
                    </Link>
                  )}
               </div>

               {/* Dedicated Close button at bottom for easy mobile tap */}
               <div className="mt-6 pt-3 border-t border-white/5 shrink-0">
                  <button
                    onClick={() => setViewingNotif(null)}
                    className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 rounded-2xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98]"
                  >
                    Close
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
