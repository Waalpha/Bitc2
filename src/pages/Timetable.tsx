import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, doc, addDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { TimetableEntry, Class, Unit, User, DayOfWeek } from '../types';
import { Plus, Trash2, Clock, MapPin, User as UserIcon, BookOpen, Calendar, Filter, Edit2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toast, ToastMessage } from '../components/Toast';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const Timetable: React.FC = () => {
  const { user, userData, settings, hasPermission } = useAuth();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isAutoGeneratingConfirm, setIsAutoGeneratingConfirm] = useState(false);
  
  const [newEntry, setNewEntry] = useState<Partial<TimetableEntry>>({
    day: 'Monday',
    startTime: '08:00',
    endTime: '09:00',
    color: '#3b82f6'
  });

  const canManage = userData?.role === 'admin' || userData?.role === 'teacher' || user?.email === 'daudimuchiri4@gmail.com';
  const isStudent = userData?.role === 'student' && user?.email !== 'daudimuchiri4@gmail.com';

  const addToast = (text: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snapClasses = await getDocs(collection(db, 'classes'));
        const cls = snapClasses.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
        setClasses(cls);
        
        if (isStudent && userData?.classIds?.[0]) {
          setSelectedClassId(userData.classIds[0]);
        } else if (!selectedClassId && cls.length > 0) {
          setSelectedClassId(cls[0].id);
        }

        const snapUnits = await getDocs(collection(db, 'units'));
        setUnits(snapUnits.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));

        const teachersQ = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const snapTeachers = await getDocs(teachersQ);
        setTeachers(snapTeachers.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'timetable-essentials');
      }
    };

    fetchData();
  }, [isStudent, userData?.classIds]);

  useEffect(() => {
    if (!selectedClassId) return;

    const fetchTimetable = async () => {
      try {
        const q = query(collection(db, 'timetable'), where('classId', '==', selectedClassId));
        const snap = await getDocs(q);
        setEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimetableEntry)));
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'timetable');
        setLoading(false);
      }
    };

    fetchTimetable();
  }, [selectedClassId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !newEntry.unitId || !newEntry.teacherId) {
      addToast("Please fill all required fields", "error");
      return;
    }

    try {
      const teacher = teachers.find(t => t.uid === newEntry.teacherId);
      const unit = units.find(s => s.id === newEntry.unitId);

      const payload: any = {
        ...newEntry,
        classId: selectedClassId,
        teacherName: teacher?.name || 'Unknown',
        unitName: unit?.name || 'Unknown',
        updatedAt: new Date().toISOString()
      };

      // Remove undefined fields which Firestore doesn't like
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      if (editingEntry) {
        await updateDoc(doc(db, 'timetable', editingEntry.id), payload);
        addToast("Timetable entry updated successfully!");
      } else {
        await addDoc(collection(db, 'timetable'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        addToast("Timetable entry added successfully!");
      }

      setIsAdding(false);
      setEditingEntry(null);
      setNewEntry({
        day: 'Monday',
        startTime: '08:00',
        endTime: '09:00',
        color: '#3b82f6'
      });
    } catch (error) {
      handleFirestoreError(error, editingEntry ? OperationType.UPDATE : OperationType.CREATE, 'timetable');
      addToast(editingEntry ? "Failed to update entry" : "Failed to add entry", "error");
    }
  };

  const openEditModal = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setNewEntry({
      day: entry.day,
      startTime: entry.startTime,
      endTime: entry.endTime,
      color: entry.color,
      unitId: entry.unitId,
      teacherId: entry.teacherId,
      room: entry.room
    });
    setIsAdding(true);
  };

  const handleAutoGenerate = async () => {
    if (!selectedClassId || units.length === 0 || teachers.length === 0) {
      addToast("Need units and teachers to generate timetable", "error");
      return;
    }

    setIsAutoGeneratingConfirm(false);
    setIsGenerating(true);
    try {
      // 1. Delete existing entries for this class
      for (const entry of entries) {
        await deleteDoc(doc(db, 'timetable', entry.id));
      }

      // 2. Prepare slots (Monday to Friday, 3-4 slots per day)
      const slots = [
        { start: '08:00', end: '10:00' },
        { start: '10:30', end: '12:30' },
        { start: '13:30', end: '15:30' },
        { start: '15:45', end: '17:45' }
      ];
      const workDays = DAYS.slice(0, 5); // Mon-Fri
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

      // 3. Select 13 units (or all if less than 13)
      const unitsToAssign = units.filter(u => u.classId === selectedClassId).slice(0, 13);
      
      if (unitsToAssign.length === 0) {
        addToast("No units found for this class. Add units first.", "error");
        setIsGenerating(false);
        return;
      }

      let unitIndex = 0;
      for (let dayIndex = 0; dayIndex < workDays.length; dayIndex++) {
        for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
          if (unitIndex >= unitsToAssign.length) break;

          const unit = unitsToAssign[unitIndex];
          const teacher = teachers[unitIndex % teachers.length];
          const day = workDays[dayIndex];
          const slot = slots[slotIndex];

          await addDoc(collection(db, 'timetable'), {
            classId: selectedClassId,
            day,
            unitId: unit.id,
            unitName: unit.name,
            teacherId: teacher.uid,
            teacherName: teacher.name,
            startTime: slot.start,
            endTime: slot.end,
            color: colors[unitIndex % colors.length],
            room: `Room ${Math.floor(Math.random() * 5) + 101}`,
            createdAt: new Date().toISOString()
          });

          unitIndex++;
        }
        if (unitIndex >= unitsToAssign.length) break;
      }

      addToast(`Successfully generated timetable for ${unitsToAssign.length} units!`);
    } catch (error) {
      console.error(error);
      addToast("Failed to generate timetable", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'timetable', id));
      addToast("Entry deleted successfully");
      setIsDeleting(null);
    } catch (error) {
      console.error("Delete error:", error);
      handleFirestoreError(error, OperationType.DELETE, `timetable/${id}`);
      addToast("Failed to delete entry", "error");
    }
  };

  const getEntriesForDay = (day: DayOfWeek) => {
    return entries
      .filter(e => e.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const renderTimetable = () => {
    return (
      <div className="overflow-x-auto pb-8 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-white/10">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-6 min-w-full xl:min-w-[1600px]">
          {DAYS.map((day, dayIdx) => {
            const dayEntries = getEntriesForDay(day);
            const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;

            return (
              <motion.div 
                key={day}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dayIdx * 0.05 }}
                className={`flex flex-col gap-5 p-5 rounded-[40px] border transition-all duration-500 ${
                  isToday 
                    ? 'bg-primary/5 border-primary/20 shadow-[0_30px_60px_rgba(59,130,246,0.12)]' 
                    : 'bg-white/5 border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between px-3 mb-2">
                  <div className="flex flex-col">
                    <h3 className={`font-bold uppercase tracking-[0.25em] text-sm ${isToday ? 'text-primary' : 'text-text-muted opacity-60'}`}>
                      {day}
                    </h3>
                    {isToday && (
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1.5 animate-pulse">
                        Active Today
                      </span>
                    )}
                  </div>
                  {isToday && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
                  )}
                </div>

                <div className="space-y-6">
                  {dayEntries.length > 0 ? (
                    dayEntries.map((entry, entryIdx) => (
                      <motion.div
                        layoutId={entry.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: (dayIdx * 0.05) + (entryIdx * 0.03) }}
                        key={`${entry.id || 'entry'}_${entryIdx}`}
                        className={`bg-bg-card p-6 rounded-[32px] shadow-md border border-white/5 group relative transition-all duration-300 ${
                          canManage ? 'hover:border-primary/50 hover:shadow-2xl hover:-translate-y-1.5' : ''
                        }`}
                      >
                        {canManage && (
                          <div className="absolute top-5 right-5 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-50">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openEditModal(entry);
                              }}
                              className="p-3 text-text-muted hover:text-primary hover:bg-primary/10 rounded-2xl border border-white/10 transition-all backdrop-blur-xl bg-white/5"
                              title="Edit Entry"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDeleting(entry.id);
                              }}
                              className="p-3 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl border border-white/10 transition-all backdrop-blur-xl bg-white/5"
                              title="Delete Entry"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                        
                        <div 
                          className="cursor-pointer"
                          onClick={() => canManage && openEditModal(entry)}
                        >
                          <div className="flex items-start gap-3 mb-6">
                            <div 
                              className="w-2 h-12 absolute left-0 top-8 rounded-r-xl" 
                              style={{ backgroundColor: entry.color || '#3b82f6' }} 
                            />
                            <div className="flex flex-col gap-3 pr-2">
                              <span className="text-lg font-bold text-text-primary uppercase tracking-tight leading-tight block break-words">
                                {entry.unitName}
                              </span>
                              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 w-fit">
                                 <Clock size={14} className="text-primary" />
                                 <span className="text-xs font-bold text-primary uppercase tracking-[0.1em] leading-none">
                                   {entry.startTime}
                                 </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-start gap-4 text-sm font-bold text-text-secondary">
                              <div className="w-10 h-10 rounded-2xl bg-success/10 flex items-center justify-center text-success shrink-0 shadow-inner">
                                 <UserIcon size={18} />
                              </div>
                              <div className="flex flex-col pt-0.5">
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest leading-none mb-1">Teacher</span>
                                <span className="leading-tight break-words">{entry.teacherName}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-4 text-sm font-bold text-text-secondary">
                              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
                                 <Clock size={18} />
                              </div>
                              <div className="flex flex-col pt-0.5">
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest leading-none mb-1">Schedule</span>
                                <span className="leading-tight">{entry.startTime} — {entry.endTime}</span>
                              </div>
                            </div>

                            {entry.room && (
                              <div className="flex items-start gap-4 text-sm font-bold text-text-secondary">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 shadow-inner">
                                   <MapPin size={18} />
                                </div>
                                <div className="flex flex-col pt-0.5">
                                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest leading-none mb-1">Location</span>
                                  <span className="leading-tight break-words">{entry.room}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[32px] group hover:border-white/10 transition-colors bg-white/[0.02]">
                      <p className="text-xs font-bold uppercase text-text-muted/30 tracking-[0.3em] italic">No Lessons</p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Calendar size={28} />
            </div>
            <h1 className="text-4xl font-bold text-text-primary tracking-tight">Academic Timetable</h1>
          </div>
          <p className="text-lg font-medium text-text-secondary max-w-2xl">
            Real-time lesson orchestration for the current academic session. Manage schedules, rooms, and teaching assignments.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {canManage && (
            <>
              <button
                onClick={() => setIsAutoGeneratingConfirm(true)}
                disabled={isGenerating}
                className="flex items-center gap-2 bg-amber-500 text-white px-6 py-3.5 rounded-2xl hover:bg-amber-600 transition-all shadow-xl shadow-amber-500/20 font-bold uppercase text-xs tracking-widest disabled:opacity-50"
              >
                <Calendar size={18} />
                {isGenerating ? 'GENERATING...' : 'AUTO-GENERATE'}
              </button>
              <button
                onClick={() => {
                  setEditingEntry(null);
                  setNewEntry({
                    day: 'Monday',
                    startTime: '08:00',
                    endTime: '09:00',
                    color: '#3b82f6'
                  });
                  setIsAdding(true);
                }}
                className="flex items-center gap-2 bg-primary text-white px-6 py-3.5 rounded-2xl hover:bg-primary-hover transition-all shadow-xl shadow-primary/20 font-bold uppercase text-xs tracking-widest"
              >
                <Plus size={20} />
                ADD LESSON
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-bg-card/30 backdrop-blur-md p-6 rounded-[32px] shadow-2xl border border-white/5 flex flex-col lg:flex-row gap-6 items-center">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-text-muted border border-white/5">
            <Filter size={24} />
          </div>
          <div className="flex flex-col gap-1 flex-1 lg:flex-none">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] ml-1">Viewing Schedule For</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={isStudent}
              className="w-full lg:w-72 px-5 py-3 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm text-slate-900 focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 appearance-none cursor-pointer"
            >
              {classes.map(cls => (
                <option key={cls.id} value={cls.id} className="bg-bg-card">{cls.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="hidden lg:block h-12 w-px bg-white/5 mx-2" />
        
        <div className="flex flex-col gap-1 w-full lg:w-auto">
           <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] ml-1">Current Academic Focus</label>
           <div className="flex items-center gap-3 text-sm font-bold text-text-primary bg-white/5 px-6 py-3 rounded-2xl border border-white/5">
            <BookOpen size={18} className="text-primary" />
            <span className="uppercase tracking-widest">{settings?.activeSession || '2024/2025 Semester 1'}</span>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-4 px-6 py-3 bg-success/10 rounded-2xl border border-success/10 text-success">
           <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
           <span className="text-xs font-bold uppercase tracking-widest">System Online</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        renderTimetable()
      )}

      {/* Entry Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsAdding(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-bg-card border border-white/5 rounded-3xl p-8 w-full max-w-lg shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-text-primary">{editingEntry ? 'Edit Lesson' : 'Add Lesson to Timetable'}</h2>
                <button 
                  onClick={() => setIsAdding(false)}
                  className="p-2 hover:bg-white/10 rounded-full text-text-muted transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] ml-1">Day of Week</label>
                    <select
                      required
                      value={newEntry.day || 'Monday'}
                      onChange={(e) => setNewEntry({ ...newEntry, day: e.target.value as DayOfWeek })}
                      className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm text-slate-900 focus:ring-2 focus:ring-primary outline-none transition-all"
                    >
                      {DAYS.map(day => <option key={day} value={day} className="bg-bg-card">{day}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] ml-1">Color Tag</label>
                    <div className="flex gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
                      {['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'].map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewEntry({ ...newEntry, color })}
                          className={`w-8 h-8 rounded-full transition-all ${newEntry.color === color ? 'ring-4 ring-primary/20 scale-110 shadow-lg' : 'hover:scale-105 opacity-60 hover:opacity-100'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] ml-1">Academic Unit</label>
                  <div className="relative">
                    <BookOpen className="absolute left-5 top-1/2 -translate-y-1/2 text-primary" size={20} />
                    <select
                      required
                      value={newEntry.unitId || ''}
                      onChange={(e) => setNewEntry({ ...newEntry, unitId: e.target.value })}
                      className="w-full pl-14 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm text-slate-900 focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
                    >
                      <option value="" className="bg-bg-card">Select Unit Name</option>
                      {units.map(sub => <option key={sub.id} value={sub.id} className="bg-bg-card">{sub.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] ml-1">Assigned Teacher</label>
                  <div className="relative">
                    <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-success" size={20} />
                    <select
                      required
                      value={newEntry.teacherId || ''}
                      onChange={(e) => setNewEntry({ ...newEntry, teacherId: e.target.value })}
                      className="w-full pl-14 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm text-slate-900 focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
                    >
                      <option value="" className="bg-bg-card">Select Teacher</option>
                      {teachers.map(t => <option key={t.uid} value={t.uid} className="bg-bg-card">{t.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] ml-1">Start Time</label>
                    <div className="relative">
                      <Clock className="absolute left-5 top-1/2 -translate-y-1/2 text-primary" size={20} />
                      <input
                        type="time"
                        required
                        value={newEntry.startTime || ''}
                        onChange={(e) => setNewEntry({ ...newEntry, startTime: e.target.value })}
                        className="w-full pl-14 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm text-slate-900 focus:ring-2 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] ml-1">End Time</label>
                    <div className="relative">
                      <Clock className="absolute left-5 top-1/2 -translate-y-1/2 text-rose-500" size={20} />
                      <input
                        type="time"
                        required
                        value={newEntry.endTime || ''}
                        onChange={(e) => setNewEntry({ ...newEntry, endTime: e.target.value })}
                        className="w-full pl-14 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm text-slate-900 focus:ring-2 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] ml-1">Physical Room / Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-amber-500" size={20} />
                    <input
                      type="text"
                      placeholder="e.g. Lab 1, Room 202..."
                      value={newEntry.room || ''}
                      onChange={(e) => setNewEntry({ ...newEntry, room: e.target.value })}
                      className="w-full pl-14 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm text-slate-900 placeholder:text-text-muted/40 focus:ring-2 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-6 py-4 bg-white/5 text-text-primary border border-white/10 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-white/10 transition-all"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] px-8 py-4 bg-primary text-white rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-primary-hover shadow-2xl shadow-primary/40 transition-all"
                  >
                    {editingEntry ? 'Confirm Changes' : 'Publish Entry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals for Confirmation */}
      <AnimatePresence>
        {isDeleting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDeleting(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-bg-card border border-white/5 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
              <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2 uppercase tracking-tight">Delete Scheduled Lesson?</h3>
              <p className="text-sm font-medium text-text-muted mb-8 uppercase tracking-widest leading-relaxed">This action is permanent. The lesson will be removed from the class schedule immediately.</p>
              <div className="flex gap-4">
                <button onClick={() => setIsDeleting(null)} className="flex-1 py-4 bg-white/5 text-text-primary rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-white/10 transition-all">Cancel</button>
                <button onClick={() => handleDeleteEntry(isDeleting)} className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-rose-600 shadow-xl shadow-rose-500/20 transition-all">Delete</button>
              </div>
            </motion.div>
          </div>
        )}

        {isAutoGeneratingConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAutoGeneratingConfirm(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-bg-card border border-white/5 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 mx-auto mb-6">
                <Calendar size={32} />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2 uppercase tracking-tight">Regenerate Timetable?</h3>
              <p className="text-sm font-medium text-text-muted mb-8 uppercase tracking-widest leading-relaxed">This will clear ALL existing entries for this class and generate a fresh schedule with 13 slots. Continue?</p>
              <div className="flex gap-4">
                <button onClick={() => setIsAutoGeneratingConfirm(false)} className="flex-1 py-4 bg-white/5 text-text-primary rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-white/10 transition-all">No, Cancel</button>
                <button onClick={handleAutoGenerate} className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-amber-600 shadow-xl shadow-amber-500/20 transition-all">Yes, Generate</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
};

