import React, { useEffect, useState, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, addDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Exam, Class, User, ExamAttendance as ExamAttendanceType } from '../types';
import { 
  ClipboardCheck, 
  Search, 
  MapPin, 
  Clock, 
  User as UserIcon, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Save, 
  FileText,
  Filter,
  ChevronRight,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Toast, ToastMessage } from '../components/Toast';

type AttendanceStatus = 'present' | 'absent' | 'excused';

export const ExamAttendance: React.FC = () => {
  const { user, userData, settings } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<ExamAttendanceType[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (text: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const isTeacher = userData?.role === 'teacher';
  const isAdmin = userData?.role === 'admin';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const currentClass = classes.find(c => c.id === selectedClassId);
    const currentExam = exams.find(e => e.id === selectedExamId);
    
    const title = `Exam Attendance: ${currentExam?.title || 'Exam'} - ${currentClass?.name || 'Class'}`;

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; margin: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 12px; }
            th { background-color: #f8f9fa; color: #333; font-weight: bold; }
            .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 8px 16px; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 12px; }
            .info-item b { font-size: 10px; color: #666; text-transform: uppercase; display: block; margin: 0 0 2px 0; letter-spacing: 0.5px; }
            .info-item p { margin: 0; font-size: 13px; font-weight: 600; color: #111; }
            h1 { color: #111; font-size: 18px; margin: 0 0 10px 0; font-weight: 700; letter-spacing: -0.2px; }
            .status-present { color: green; font-weight: bold; }
            .status-absent { color: red; font-weight: bold; }
            .status-excused { color: orange; font-weight: bold; }
            .footer { margin-top: 20px; font-size: 10px; color: #666; display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 8px; }
            
            .watermark-container {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 100vw;
              height: 100vh;
              z-index: -1000;
              pointer-events: none;
              display: flex;
              align-items: center;
              justify-content: center;
              opacity: 0.10;
              overflow: hidden;
            }
            .watermark-img {
              width: 12cm;
              height: 12cm;
              max-width: 12cm;
              max-height: 12cm;
              object-fit: contain;
              filter: grayscale(100%);
            }
            .watermark-text {
              font-size: 36pt;
              font-weight: 900;
              font-family: 'Inter', sans-serif;
              color: #1e3a8a;
              transform: rotate(-30deg);
              text-align: center;
              white-space: nowrap;
              letter-spacing: 4px;
            }

            @media print {
              body { padding: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              .watermark-container { opacity: 0.14 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          </style>
        </head>
        <body>
          <div class="watermark-container">
            ${settings?.logoUrl 
              ? `<img src="${settings.logoUrl}" class="watermark-img" alt="" />` 
              : `<div class="watermark-text">${(settings?.schoolName || 'Breakthrough International').toUpperCase()}</div>`
            }
          </div>
          ${settings?.logoUrl ? `<img src="${settings.logoUrl}" alt="School Logo" style="max-height: 48px; width: auto; margin-bottom: 8px; display: block;" />` : ''}
          <h1>BITC - Exam Attendance Sheet</h1>
          <div class="info-grid">
            <div class="info-item">
              <b>Exam Title</b>
              <p>${currentExam?.title || 'N/A'}</p>
            </div>
            <div class="info-item">
              <b>Class</b>
              <p>${currentClass?.name || 'N/A'}</p>
            </div>
             <div class="info-item">
              <b>Date & Time</b>
              <p>${currentExam?.examDate ? format(new Date(currentExam.examDate), 'MMMM dd, yyyy @ HH:mm') : 'N/A'}</p>
            </div>
            <div class="info-item">
              <b>Location</b>
              <p>${currentExam?.location || 'N/A'}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px">No.</th>
                <th>Student Name</th>
                <th>Email</th>
                <th style="width: 100px">Status</th>
                <th style="width: 150px">Signature</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStudents.map((s, i) => {
                const record = attendanceRecords.find(r => r.studentId === s.uid);
                return `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${s.name}</td>
                    <td>${s.email}</td>
                    <td class="status-${record?.status || 'unmarked'}">
                      ${record?.status ? record.status.toUpperCase() : '---'}
                    </td>
                    <td></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            <span>Printed on ${new Date().toLocaleString()}</span>
            <span>Invigilator Signature: ___________________________</span>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const snap = await getDocs(collection(db, 'classes'));
        setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'classes');
      }
    };
    fetchClasses();
  }, []);

  // Fetch exams when class changes
  useEffect(() => {
    if (selectedClassId) {
      const fetchExams = async () => {
        try {
          const q = query(collection(db, 'exams'), where('classId', '==', selectedClassId));
          const snap = await getDocs(q);
          setExams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam)));
          setSelectedExamId('');
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'exams');
        }
      };
      fetchExams();
    } else {
      setExams([]);
      setSelectedExamId('');
    }
  }, [selectedClassId]);

  // Fetch students and attendance when class/exam changes
  useEffect(() => {
    if (selectedClassId && selectedExamId) {
      // Students in this class
      const studentsQ = query(
        collection(db, 'users'), 
        where('classIds', 'array-contains', selectedClassId), 
        where('role', '==', 'student')
      );
      const unsubStudents = onSnapshot(studentsQ, (snap) => {
        setStudents(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'exam-attendance-students');
      });

      // Attendance records for this exam
      const attendQ = query(
        collection(db, 'exam_attendance'),
        where('examId', '==', selectedExamId)
      );
      const unsubAttend = onSnapshot(attendQ, (snap) => {
        setAttendanceRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamAttendanceType)));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'exam-attendance-records');
      });

      return () => {
        unsubStudents();
        unsubAttend();
      };
    } else {
      setStudents([]);
      setAttendanceRecords([]);
    }
  }, [selectedClassId, selectedExamId]);

  const handleMarkAttendance = async (studentId: string, status: AttendanceStatus) => {
    if (!selectedExamId) return;
    
    try {
      const existing = attendanceRecords.find(a => a.studentId === studentId);
      if (existing) {
        await updateDoc(doc(db, 'exam_attendance', existing.id), {
          status,
          markedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'exam_attendance'), {
          examId: selectedExamId,
          studentId,
          status,
          markedAt: new Date().toISOString()
        });
      }
      // No toast here to avoid clutter during rapid marking, or a small one
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'exam_attendance');
      addToast("Failed to update attendance", "error");
    }
  };

  const filteredStudents = useMemo(() => {
    const search = (searchTerm || '').toLowerCase();
    return students.filter(s => 
      (s.name || '').toLowerCase().includes(search) ||
      (s.email || '').toLowerCase().includes(search)
    );
  }, [students, searchTerm]);

  const stats = useMemo(() => {
    const records = students.map(s => {
      const record = attendanceRecords.find(r => r.studentId === s.uid);
      return record?.status;
    });

    return {
      total: students.length,
      present: records.filter(r => r === 'present').length,
      absent: records.filter(r => r === 'absent').length,
      excused: records.filter(r => r === 'excused').length,
      unmarked: records.filter(r => !r).length
    };
  }, [students, attendanceRecords]);

  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exam Attendance</h1>
          <p className="text-gray-500 text-sm font-medium">Verify student presence for specific examinations</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total Students</span>
              <span className="text-lg font-bold text-gray-900 leading-none">{stats.total}</span>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-green-400 uppercase tracking-widest leading-none mb-1">Present</span>
              <span className="text-lg font-bold text-green-600 leading-none">{stats.present}</span>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-red-400 uppercase tracking-widest leading-none mb-1">Absent</span>
              <span className="text-lg font-bold text-red-600 leading-none">{stats.absent}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Select Class</label>
              <div className="space-y-2">
                {classes.map((cls, idx) => (
                  <button
                    key={`${cls.id || 'cls'}_${idx}`}
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${
                      selectedClassId === cls.id 
                        ? 'border-blue-600 bg-blue-50 text-blue-900' 
                        : 'border-gray-50 hover:border-gray-200 text-gray-600'
                    }`}
                  >
                    <span className="text-sm font-bold">{cls.name}</span>
                    <ChevronRight size={16} className={selectedClassId === cls.id ? 'text-blue-600' : 'text-gray-300'} />
                  </button>
                ))}
              </div>
            </div>

            {selectedClassId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Select Exam</label>
                <div className="space-y-2">
                  {exams.length > 0 ? (
                    exams.map((exam, idx) => (
                      <button
                        key={`${exam.id || 'exam'}_${idx}`}
                        onClick={() => setSelectedExamId(exam.id)}
                        className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                          selectedExamId === exam.id 
                            ? 'border-blue-600 bg-blue-50 text-blue-900' 
                            : 'border-gray-50 hover:border-gray-200 text-gray-600'
                        }`}
                      >
                        <p className="text-sm font-bold truncate">{exam.title}</p>
                        <p className="text-xs uppercase font-bold tracking-widest opacity-50">
                          {exam.examDate ? format(new Date(exam.examDate), 'MMM dd, HH:mm') : exam.dueDate ? format(new Date(exam.dueDate), 'MMM dd, HH:mm') : 'No Date'}
                        </p>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 italic p-4 text-center border-2 border-dashed border-gray-100 rounded-xl">
                      No exams found for this class
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {selectedExam && (
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-xl shadow-blue-100">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold">Exam Info</h3>
                {selectedExam.isOffline && (
                  <span className="bg-white/20 px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
                    Physical
                  </span>
                )}
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <FileText className="text-blue-200 mt-1" size={18} />
                  <div>
                    <p className="text-xs font-bold text-blue-200 uppercase tracking-widest">Title</p>
                    <p className="text-sm font-bold leading-tight">{selectedExam.title}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="text-blue-200 mt-1" size={18} />
                  <div>
                    <p className="text-xs font-bold text-blue-200 uppercase tracking-widest">Duration</p>
                    <p className="text-sm font-bold">{selectedExam.duration} Minutes</p>
                  </div>
                </div>
                {selectedExam.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="text-blue-200 mt-1" size={18} />
                    <div>
                      <p className="text-xs font-bold text-blue-200 uppercase tracking-widest">Room / Hall</p>
                      <p className="text-sm font-bold">{selectedExam.location}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Attendance List */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
            {selectedExamId ? (
              <>
                <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mr-2">Quick Filter:</span>
                    <button className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-xs font-bold uppercase hover:bg-gray-100 transition-colors">Show All</button>
                    <button className="px-3 py-1.5 rounded-lg bg-green-50 text-green-600 text-xs font-bold uppercase hover:bg-green-100 transition-colors">Present</button>
                    <button className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold uppercase hover:bg-red-100 transition-colors">Absent</button>
                    
                    <div className="h-6 w-px bg-gray-100 mx-2" />
                    
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-black transition-all shadow-lg shadow-gray-200"
                    >
                      <Printer size={16} />
                      <span className="text-xs uppercase tracking-widest font-bold">Print</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Student</th>
                        <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
                        <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map((student, idx) => {
                          const record = attendanceRecords.find(r => r.studentId === student.uid);
                          const status = record?.status;

                          return (
                            <motion.tr 
                              layout
                              key={`${student.uid || 'student'}_${idx}`} 
                              className="group hover:bg-gray-50/80 transition-colors"
                            >
                              <td className="px-8 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold shadow-sm group-hover:scale-110 transition-transform">
                                    {(student?.name || 'S').charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-900 leading-none mb-1">{student?.name || 'Unknown Student'}</p>
                                    <p className="text-xs font-bold text-gray-400">{student?.admissionNumber || 'No Admission #'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-4">
                                <div className="flex justify-center">
                                  {status ? (
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-all ${
                                      status === 'present' ? 'bg-green-50 text-green-700 border-green-200 shadow-sm shadow-green-100' :
                                      status === 'absent' ? 'bg-red-50 text-red-700 border-red-200 shadow-sm shadow-red-100' :
                                      'bg-blue-50 text-blue-700 border-blue-200 shadow-sm shadow-blue-100'
                                    }`}>
                                      {status === 'present' && <CheckCircle size={12} />}
                                      {status === 'absent' && <XCircle size={12} />}
                                      {status === 'excused' && <AlertCircle size={12} />}
                                      {status}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-bold text-gray-300 uppercase tracking-widest italic">Pending</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-8 py-4">
                                <div className="flex justify-center gap-2">
                                  {(['present', 'absent', 'excused'] as AttendanceStatus[]).map((s) => (
                                    <button
                                      key={s}
                                      onClick={() => handleMarkAttendance(student.uid, s)}
                                      className={`p-2.5 rounded-xl border-2 transition-all ${
                                        status === s 
                                          ? (s === 'present' ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100' : 
                                             s === 'absent' ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-100' :
                                             'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100')
                                          : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:text-gray-600'
                                      }`}
                                      title={s.charAt(0).toUpperCase() + s.slice(1)}
                                    >
                                      {s === 'present' && <CheckCircle size={18} />}
                                      {s === 'absent' && <XCircle size={18} />}
                                      {s === 'excused' && <AlertCircle size={18} />}
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-8 py-20 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center text-gray-300">
                                <UserIcon size={32} />
                              </div>
                              <p className="text-sm font-bold text-gray-400">No students matching your search</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-20 min-h-[500px]">
                <div className="w-24 h-24 rounded-[40px] bg-blue-50 flex items-center justify-center text-blue-600 mb-6 group hover:rotate-12 transition-transform duration-300">
                  <ClipboardCheck size={48} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to take attendance?</h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto mb-8 font-medium">
                  Select a class and an examination from the sidebar to start recording student attendance.
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
                  <Filter size={14} />
                  Choose Class & Exam to Start
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
};
