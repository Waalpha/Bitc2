import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, addDoc, doc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Exam, Unit, Question, Submission, User, Class } from '../types';
import { Plus, Trash2, FileText, Send, Eye, Edit, CheckCircle, XCircle, Clock, ChevronRight, ChevronLeft, Save, AlertCircle, Info, Check, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Link, useLocation } from 'react-router-dom';
import { Toast, ToastMessage } from '../components/Toast';

export const Exams: React.FC = () => {
  const { user, userData, hasPermission } = useAuth();
  const location = useLocation();
  const [exams, setExams] = useState<Exam[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [viewingSubmissions, setViewingSubmissions] = useState<Exam | null>(null);
  const [examSubmissions, setExamSubmissions] = useState<Submission[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [newExam, setNewExam] = useState<Partial<Exam>>({
    title: '',
    type: 'Quiz',
    unitId: '',
    classId: '',
    questions: [],
    published: false,
    isOffline: false,
    maxMarks: 100,
    passingMarks: 40,
    duration: 60,
    examDate: '',
    location: '',
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    if (location.state?.prefillUnitId) {
      setNewExam(prev => ({
        ...prev,
        unitId: location.state.prefillUnitId,
        classId: location.state.prefillClassId || prev.classId
      }));
      setIsCreating(true);
      setCreateStep(1);
    }
  }, [location.state]);

  const addToast = (text: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const isTeacher = userData?.role === 'teacher' || userData?.role === 'admin' || hasPermission('manage_exams');

  useEffect(() => {
    if (!user) return;
    
    const fetchExamsData = async () => {
      try {
        const examsQ = isTeacher
          ? query(collection(db, 'exams'), where('teacherId', '==', user.uid))
          : query(collection(db, 'exams'), where('published', '==', true));

        const examsSnap = await getDocs(examsQ);
        setExams(examsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam)));

        const unitsSnap = await getDocs(collection(db, 'units'));
        setUnits(unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));

        const classesSnap = await getDocs(collection(db, 'classes'));
        setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));

        const studentsQ = query(collection(db, 'users'), where('role', '==', 'student'));
        const studentsSnap = await getDocs(studentsQ);
        setStudents(studentsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'exams-data');
      }
    };

    fetchExamsData();
  }, [user, isTeacher]);

  useEffect(() => {
    if (!viewingSubmissions) {
      setExamSubmissions([]);
      return;
    }

    const fetchSubmissions = async () => {
      try {
        const q = query(collection(db, 'submissions'), where('examId', '==', viewingSubmissions.id));
        const snap = await getDocs(q);
        setExamSubmissions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'submissions');
      }
    };

    fetchSubmissions();
  }, [viewingSubmissions]);

  const handleGradeSubmission = async (submission: Submission, grade: number, feedback: string) => {
    try {
      await updateDoc(doc(db, 'submissions', submission.id), {
        grade,
        feedback
      });

      // Notify student
      const exam = exams.find(e => e.id === submission.examId);
      await addDoc(collection(db, 'notifications'), {
        userId: submission.studentId,
        title: 'New Grade Available',
        message: `Your submission for "${exam?.title}" has been graded. Grade: ${grade}%`,
        type: 'grade',
        read: false,
        createdAt: new Date().toISOString(),
        link: `/marks` // Redirect to marks register or results page
      });

      addToast("Submission graded successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `submissions/${submission.id}`);
      addToast("Failed to grade submission", "error");
    }
  };

  const handleAddQuestion = () => {
    const q: Question = {
      id: Math.random().toString(36).substr(2, 9),
      text: '',
      type: 'multiple-choice',
      options: ['', '', '', ''],
      correctAnswer: '',
    };
    setNewExam(prev => ({ ...prev, questions: [...(prev.questions || []), q] }));
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExam.title || !newExam.unitId || !newExam.classId || !user) return;

    try {
      await addDoc(collection(db, 'exams'), {
        ...newExam,
        teacherId: user.uid,
        createdAt: new Date().toISOString(),
      });
      setIsCreating(false);
      setCreateStep(1);
      setNewExam({ 
        title: '', 
        type: 'Quiz',
        unitId: '', 
        classId: '',
        questions: [], 
        published: false,
        isOffline: false,
        maxMarks: 100,
        passingMarks: 40,
        duration: 60,
        examDate: '',
        location: ''
      });
      addToast("Exam created successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'exams');
      addToast("Failed to create exam", "error");
    }
  };

  const togglePublish = async (exam: Exam) => {
    try {
      const newPublishedStatus = !exam.published;
      await updateDoc(doc(db, 'exams', exam.id), {
        published: newPublishedStatus
      });
      
      if (newPublishedStatus) {
        // Notify students in the class
        const unit = units.find(c => c.id === exam.unitId);
        if (unit) {
          const studentsQ = query(
            collection(db, 'users'), 
            where('classIds', 'array-contains', unit.classId), 
            where('role', '==', 'student')
          );
          const studentsSnap = await getDocs(studentsQ);
          
          const batch = writeBatch(db);
          studentsSnap.docs.forEach(studentDoc => {
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
              userId: studentDoc.id,
              title: 'New Exam Published',
              message: `A new exam "${exam.title}" has been published for ${unit.name}.`,
              type: 'exam',
              read: false,
              createdAt: new Date().toISOString(),
              link: exam.isOffline ? '/results' : `/exams/take/${exam.id}`
            });
          });
          await batch.commit();
        }
      }

      addToast(`Exam ${newPublishedStatus ? 'published' : 'unpublished'} successfully!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `exams/${exam.id}`);
      addToast("Failed to update exam", "error");
    }
  };

  const deleteExam = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'exams', id));
      addToast("Exam deleted successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `exams/${id}`);
      addToast("Failed to delete exam", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exams Portal</h1>
          <p className="text-gray-500 text-sm">Manage and monitor academic assessments</p>
        </div>
        {isTeacher && (
          <button
            onClick={() => {
              setIsCreating(true);
              setCreateStep(1);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus size={20} />
            Create New Exam
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.map((exam, idx) => (
          <div key={`${exam.id || 'exam'}_${idx}`} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all group">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-2xl ${exam.published ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                  <FileText size={24} />
                </div>
                {isTeacher && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => togglePublish(exam)}
                      className={`p-2 rounded-xl transition-all ${
                        exam.published ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50 hover:text-blue-600'
                      }`}
                      title={exam.published ? 'Unpublish' : 'Publish'}
                    >
                      <Send size={18} />
                    </button>
                    <button
                      onClick={() => deleteExam(exam.id)}
                      className="p-2 rounded-xl text-gray-400 bg-gray-50 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="space-y-1 mb-6">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-xs font-bold uppercase tracking-wider text-gray-500">
                    {exam.type}
                  </span>
                  {exam.published && (
                    <span className="px-2 py-0.5 rounded-md bg-green-100 text-xs font-bold uppercase tracking-wider text-green-600">
                      Live
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900 leading-tight">{exam.title}</h3>
                <p className="text-sm font-medium text-gray-500">
                  {units.find(c => c.id === exam.unitId)?.name || 'Unknown Unit'} • {classes.find(c => c.id === exam.classId)?.name || `Class ${exam.classId}`}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{exam.isOffline ? 'Exam Date' : 'Due Date'}</p>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
                    <Clock size={14} className="text-blue-500" />
                    {exam.isOffline 
                      ? (exam.examDate ? format(new Date(exam.examDate), 'MMM dd') : 'TBA') 
                      : (exam.dueDate ? format(new Date(exam.dueDate), 'MMM dd') : 'Open')}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{exam.isOffline ? 'Location' : 'Questions'}</p>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
                    {exam.isOffline ? (
                      <>
                        <MapPin size={14} className="text-blue-500" />
                        <span className="truncate">{exam.location || 'Hall'}</span>
                      </>
                    ) : (
                      <>
                        <FileText size={14} className="text-blue-500" />
                        {exam.questions.length} Items
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isTeacher ? (
                <button 
                  onClick={() => setViewingSubmissions(exam)}
                  className="w-full bg-gray-900 text-white font-bold py-3 rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
                >
                  <Eye size={18} />
                  {exam.isOffline ? 'Manage Marks' : 'Review Submissions'}
                </button>
              ) : (
                <>
                  {exam.isOffline ? (
                    <div className="w-full bg-gray-50 text-gray-500 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 border border-gray-100 text-xs italic">
                      <Info size={16} /> Physical Exam Only
                    </div>
                  ) : (
                    <Link
                      to={`/exams/take/${exam.id}`}
                      className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                    >
                      Start Assessment
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Submissions Modal */}
      <AnimatePresence>
        {viewingSubmissions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setViewingSubmissions(null)}
            />
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl p-8 w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Assessment Results</h2>
                  <p className="text-gray-500 font-medium">{viewingSubmissions.title}</p>
                </div>
                <button onClick={() => setViewingSubmissions(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <XCircle size={32} className="text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                {examSubmissions.length > 0 ? (
                  examSubmissions.map((sub, idx) => {
                    const student = students.find(s => s.uid === sub.studentId);
                    const isPassed = sub.grade !== undefined && sub.grade >= viewingSubmissions.passingMarks;
                    
                    return (
                      <div key={`${sub.id || 'sub'}_${idx}`} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-200 transition-all group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-blue-600 font-bold text-lg">
                              {(student?.name || 'S').charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{student?.name || 'Unknown Student'}</p>
                              <p className="text-xs text-gray-500 font-medium">{student?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Submitted</p>
                              <p className="text-sm font-bold text-gray-700">
                                {format(new Date(sub.submittedAt), 'MMM dd, HH:mm')}
                              </p>
                            </div>
                            {sub.grade !== undefined && (
                              <div className={`px-4 py-2 rounded-xl font-bold text-sm ${isPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {sub.grade}%
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Score (%)</label>
                            <input
                              type="number"
                              defaultValue={sub.grade}
                              onBlur={(e) => {
                                const grade = parseInt(e.target.value);
                                if (!isNaN(grade)) handleGradeSubmission(sub, grade, sub.feedback || '');
                              }}
                              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 transition-all text-slate-900"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Teacher Feedback</label>
                            <div className="relative">
                              <input
                                type="text"
                                defaultValue={sub.feedback}
                                onBlur={(e) => {
                                  if (e.target.value !== sub.feedback) handleGradeSubmission(sub, sub.grade || 0, e.target.value);
                                }}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 transition-all pr-10 text-slate-900"
                                placeholder="Add a comment..."
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300">
                                <Edit size={16} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm text-gray-300">
                      <FileText size={32} />
                    </div>
                    <p className="text-gray-500 font-bold">No submissions recorded yet.</p>
                    <p className="text-sm text-gray-400">Students will appear here once they complete the exam.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Exam Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsCreating(false)}
            />
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl p-0 w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Create New Exam</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`h-1.5 w-12 rounded-full transition-all ${createStep >= 1 ? 'bg-blue-600' : 'bg-gray-100'}`} />
                    <div className={`h-1.5 w-12 rounded-full transition-all ${createStep >= 2 ? 'bg-blue-600' : 'bg-gray-100'}`} />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Step {createStep} of 2</span>
                  </div>
                </div>
                <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <XCircle size={32} className="text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <form onSubmit={handleCreateExam} id="create-exam-form">
                  {createStep === 1 ? (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-8"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Exam Title</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Midterm Mathematics"
                              value={newExam.title}
                              onChange={(e) => setNewExam(prev => ({ ...prev, title: e.target.value }))}
                              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Assessment Type</label>
                            <div className="grid grid-cols-2 gap-3">
                              {['Quiz', 'Midterm', 'Final', 'Assignment', 'Practical', 'Physical'].map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => {
                                    setNewExam(prev => ({ 
                                      ...prev, 
                                      type: type as any,
                                      isOffline: type === 'Physical' ? true : prev.isOffline
                                    }));
                                  }}
                                  className={`px-4 py-3 rounded-2xl text-sm font-bold border transition-all ${
                                    newExam.type === type 
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' 
                                      : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'
                                  }`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Target Class</label>
                              <select
                                required
                                value={newExam.classId}
                                onChange={(e) => {
                                  const classId = e.target.value;
                                  setNewExam(prev => ({ ...prev, classId, unitId: '' }));
                                }}
                                className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                              >
                                <option value="">Select Class</option>
                                {classes.map(cls => (
                                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Unit</label>
                              <select
                                required
                                value={newExam.unitId}
                                onChange={(e) => setNewExam(prev => ({ ...prev, unitId: e.target.value }))}
                                className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                                disabled={!newExam.classId}
                              >
                                <option value="">Select Unit</option>
                                {units.filter(c => c.classId === newExam.classId).map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Max Marks</label>
                              <input
                                type="number"
                                required
                                value={newExam.maxMarks}
                                onChange={(e) => setNewExam(prev => ({ ...prev, maxMarks: parseInt(e.target.value) }))}
                                className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Passing Marks</label>
                              <input
                                type="number"
                                required
                                value={newExam.passingMarks}
                                onChange={(e) => setNewExam(prev => ({ ...prev, passingMarks: parseInt(e.target.value) }))}
                                className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Duration (Mins)</label>
                              <input
                                type="number"
                                required
                                value={newExam.duration}
                                onChange={(e) => setNewExam(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                                className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                              />
                            </div>
                          </div>

                          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 mb-6">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div 
                                onClick={() => setNewExam(prev => ({ ...prev, isOffline: !prev.isOffline }))}
                                className={`w-10 h-5 rounded-full transition-all relative ${newExam.isOffline ? 'bg-blue-600' : 'bg-gray-200'}`}
                              >
                                <div className={`absolute top-0.5 bottom-0.5 w-4 rounded-full bg-white shadow-sm transition-all ${newExam.isOffline ? 'right-0.5' : 'left-0.5'}`} />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-bold text-gray-900 leading-none mb-1">Regular (Physical) Exam</p>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Students won't take this exam online</p>
                              </div>
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Exam Date & Time</label>
                              <input
                                type="datetime-local"
                                value={newExam.examDate || ''}
                                onChange={(e) => setNewExam(prev => ({ ...prev, examDate: e.target.value }))}
                                className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Location / Room</label>
                              <input
                                type="text"
                                placeholder="e.g. Hall A, Room 302"
                                value={newExam.location || ''}
                                onChange={(e) => setNewExam(prev => ({ ...prev, location: e.target.value }))}
                                className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Submission Deadline (Optional)</label>
                            <input
                              type="datetime-local"
                              value={newExam.dueDate || ''}
                              onChange={(e) => setNewExam(prev => ({ ...prev, dueDate: e.target.value }))}
                              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 p-6 rounded-3xl flex gap-4 items-start border border-blue-100">
                        <div className="p-2 bg-white rounded-xl text-blue-600 shadow-sm">
                          <Info size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-blue-900">Pro Tip</p>
                          <p className="text-xs text-blue-700 leading-relaxed">
                            Setting clear passing marks helps students understand the assessment criteria. 
                            You can add questions in the next step.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-8"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">Assessment Questions</h3>
                          <p className="text-sm text-gray-500 font-medium">Add multiple choice questions for this exam</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddQuestion}
                          className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-gray-200"
                        >
                          <Plus size={18} /> Add Question
                        </button>
                      </div>

                      <div className="space-y-6">
                        {newExam.questions?.map((q, idx) => (
                          <div key={`${q.id || 'q'}_${idx}`} className="p-8 bg-gray-50 rounded-3xl border border-gray-100 space-y-6 relative group">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                                  {idx + 1}
                                </div>
                                <span className="text-sm font-bold text-gray-900 uppercase tracking-widest">Question</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const qs = [...(newExam.questions || [])];
                                  qs.splice(idx, 1);
                                  setNewExam(prev => ({ ...prev, questions: qs }));
                                }}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                            
                            <div className="space-y-4">
                              <input
                                type="text"
                                required
                                placeholder="Enter your question here..."
                                value={q.text}
                                onChange={(e) => {
                                  const qs = [...(newExam.questions || [])];
                                  qs[idx].text = e.target.value;
                                  setNewExam(prev => ({ ...prev, questions: qs }));
                                }}
                                className="w-full px-6 py-4 bg-white border border-gray-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 transition-all text-lg text-slate-900"
                              />
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {q.options?.map((opt, optIdx) => (
                                  <div key={`${q.id}_opt_${optIdx}`} className="relative">
                                    <input
                                      type="text"
                                      required
                                      placeholder={`Option ${optIdx + 1}`}
                                      value={opt}
                                      onChange={(e) => {
                                        const qs = [...(newExam.questions || [])];
                                        qs[idx].options![optIdx] = e.target.value;
                                        setNewExam(prev => ({ ...prev, questions: qs }));
                                      }}
                                      className={`w-full pl-12 pr-4 py-3 bg-white border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 transition-all text-sm text-slate-900 ${
                                        q.correctAnswer === opt && opt !== '' ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-100'
                                      }`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const qs = [...(newExam.questions || [])];
                                        qs[idx].correctAnswer = opt;
                                        setNewExam(prev => ({ ...prev, questions: qs }));
                                      }}
                                      className={`absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                        q.correctAnswer === opt && opt !== '' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                      }`}
                                    >
                                      <Check size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {(!newExam.questions || newExam.questions.length === 0) && (
                          <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                            <Plus className="mx-auto text-gray-300 mb-4" size={48} />
                            <p className="text-gray-500 font-bold">No questions added yet.</p>
                            <p className="text-sm text-gray-400 mb-6">Start by adding your first assessment item.</p>
                            <button
                              type="button"
                              onClick={handleAddQuestion}
                              className="bg-white text-gray-900 border border-gray-200 px-6 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm"
                            >
                              Add First Question
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </form>
              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (createStep === 1) setIsCreating(false);
                    else setCreateStep(1);
                  }}
                  className="flex items-center gap-2 px-6 py-3 text-gray-600 font-bold uppercase tracking-widest text-xs hover:text-gray-900 transition-colors"
                >
                  <ChevronLeft size={18} />
                  {createStep === 1 ? 'Cancel' : 'Back'}
                </button>
                
                <div className="flex gap-4">
                  {createStep === 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (newExam.title && newExam.classId && newExam.unitId) {
                          if (newExam.isOffline) handleCreateExam(new Event('submit') as any);
                          else setCreateStep(2);
                        }
                        else addToast("Please fill in all required fields", "error");
                      }}
                      className="bg-gray-900 text-white font-bold uppercase tracking-widest text-xs px-8 py-3 rounded-2xl hover:bg-black transition-all shadow-lg shadow-gray-200 flex items-center gap-2"
                    >
                      {newExam.isOffline ? 'Create Physical Exam' : 'Next Step'}
                      <ChevronRight size={18} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      form="create-exam-form"
                      className="bg-blue-600 text-white font-bold uppercase tracking-widest text-xs px-10 py-3 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
                    >
                      <Save size={18} />
                      Create Assessment
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
};
