import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { TimetableEntry, DayOfWeek } from '../types';
import { Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInMinutes } from 'date-fns';

export const LiveLessonManager: React.FC = () => {
  const { userData } = useAuth();
  const [nextLesson, setNextLesson] = useState<TimetableEntry | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notifiedLessonId, setNotifiedLessonId] = useState<string | null>(null);
  const entriesRef = useRef<TimetableEntry[]>([]);

  useEffect(() => {
    if (!userData || userData.role !== 'student' || !userData.classIds?.length) return;

    const fetchTimetable = async () => {
      try {
        const classId = userData.classIds[0];
        const q = query(
          collection(db, 'timetable'),
          where('classId', '==', classId)
        );
        const snap = await getDocs(q);
        const entries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimetableEntry));
        entriesRef.current = entries;
        checkNextLesson();
      } catch (error) {
        console.error("Timetable fetch for LiveLessonManager failed:", error);
      }
    };

    fetchTimetable();

    const interval = setInterval(() => {
      checkNextLesson();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [userData]);

  const checkNextLesson = () => {
    const entries = entriesRef.current;
    if (entries.length === 0) return;

    const now = new Date();
    const currentDay = format(now, 'EEEE') as DayOfWeek;
    const currentTimeStr = format(now, 'HH:mm');

    const todayLessons = entries.filter(e => e.day === currentDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const upcoming = todayLessons.find(e => e.startTime > currentTimeStr);

    if (upcoming) {
      setNextLesson(upcoming);
      
      const [startH, startM] = upcoming.startTime.split(':').map(Number);
      const lessonStartTime = new Date();
      lessonStartTime.setHours(startH, startM, 0, 0);

      const diff = differenceInMinutes(lessonStartTime, now);

      // Notify 15 minutes before
      if (diff <= 15 && diff > 0) {
        if (notifiedLessonId !== upcoming.id) {
          setShowNotification(true);
          setNotifiedLessonId(upcoming.id);
          
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`Class Starting Soon: ${upcoming.unitName}`, {
                body: `Your lesson starts at ${upcoming.startTime} in ${upcoming.room || 'TBA'}.`,
                icon: '/favicon.svg',
                tag: 'upcoming-class' // Prevent multiple notifications for the same class
              });
            } catch (e) {
              console.error('Failed to show notification', e);
            }
          }
        }
      } else if (diff <= 0) {
        // Lesson has started, hide the "starting soon" notification
        setShowNotification(false);
      }
    } else {
      setNextLesson(null);
      setShowNotification(false);
    }
  };

  return (
    <AnimatePresence>
      {showNotification && nextLesson && (
        <motion.div
           initial={{ opacity: 0, y: 50, x: '-50%' }}
           animate={{ opacity: 1, y: 0, x: '-50%' }}
           exit={{ opacity: 0, y: 100, x: '-50%' }}
           transition={{ type: 'spring', damping: 20, stiffness: 300 }}
           className="fixed bottom-8 left-1/2 z-[60] w-full max-w-sm pointer-events-none"
        >
          <div className="mx-4 bg-slate-900 border border-white/10 backdrop-blur-md rounded-3xl p-5 shadow-2xl flex items-center gap-4 pointer-events-auto">
            <div className="bg-primary p-3 rounded-2xl shadow-lg shadow-primary/40 animate-pulse">
              <Clock size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">Coming Up Next</p>
              <h4 className="font-bold text-white truncate text-lg tracking-tight leading-tight mb-1">{nextLesson.unitName}</h4>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-xs font-bold bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                  {nextLesson.startTime}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[100px]">
                  {nextLesson.room || 'Room TBA'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setShowNotification(false)}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
