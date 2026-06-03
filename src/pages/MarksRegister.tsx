import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, addDoc, doc, updateDoc, getDocs, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Exam, Submission, User, Class, ExamAttendance, Grade, AppNotification, Unit } from '../types';
import { Search, Filter, Save, Send, CheckCircle, XCircle, AlertCircle, ClipboardCheck, Award, Settings, Paperclip, File as FileIcon, Image as ImageIcon, Loader2, X, FileText, Link as LinkIcon, BookOpen, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Toast, ToastMessage } from '../components/Toast';

export const MarksRegister: React.FC = () => {
  const { user, userData } = useAuth();
  const location = useLocation();
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [examAttendance, setExamAttendance] = useState<ExamAttendance[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isManagingGrades, setIsManagingGrades] = useState(false);
  const [isUploadingResult, setIsUploadingResult] = useState<string | null>(null); // studentId
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [isSendingResult, setIsSendingResult] = useState(false);
  const [selectedStudentForResult, setSelectedStudentForResult] = useState<User | null>(null);
  const [resultForm, setResultForm] = useState({
    marks: 0,
    feedback: '',
    attachment: null as File | null,
    manualUrl: '',
    isUploading: false,
    uploadProgress: 0
  });
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
  
  useEffect(() => {
    if (location.state?.prefillClassId) {
      setSelectedClassId(location.state.prefillClassId);
    }
    if (location.state?.prefillUnitId) {
      setSelectedUnitId(location.state.prefillUnitId);
    }
  }, [location.state]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const snapClasses = await getDocs(collection(db, 'classes'));
        setClasses(snapClasses.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));

        const snapUnits = await getDocs(collection(db, 'units'));
        setUnits(snapUnits.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));

        const snapGrades = await getDocs(collection(db, 'grades'));
        const g = snapGrades.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)).sort((a, b) => b.minPercentage - a.minPercentage);
        setGrades(g);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'initial-marks-data');
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!selectedClassId) {
      setExams([]);
      setStudents([]);
      return;
    }

    const fetchClassData = async () => {
      try {
        const examsQ = selectedUnitId 
          ? query(collection(db, 'exams'), where('classId', '==', selectedClassId), where('unitId', '==', selectedUnitId))
          : query(collection(db, 'exams'), where('classId', '==', selectedClassId));
        const snapExams = await getDocs(examsQ);
        setExams(snapExams.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam)));

        const studentsQ = query(collection(db, 'users'), where('classIds', 'array-contains', selectedClassId), where('role', '==', 'student'));
        const snapStudents = await getDocs(studentsQ);
        setStudents(snapStudents.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'class-marks-data');
      }
    };
    fetchClassData();
  }, [selectedClassId, selectedUnitId]);

  useEffect(() => {
    if (!selectedExamId) {
      setSubmissions([]);
      setExamAttendance([]);
      return;
    }

    const fetchExamData = async () => {
      try {
        const subsQ = query(collection(db, 'submissions'), where('examId', '==', selectedExamId));
        const snapSubs = await getDocs(subsQ);
        setSubmissions(snapSubs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));

        const attendQ = query(collection(db, 'exam_attendance'), where('examId', '==', selectedExamId));
        const snapAttend = await getDocs(attendQ);
        setExamAttendance(snapAttend.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamAttendance)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'exam-marks-data');
      }
    };
    fetchExamData();
  }, [selectedExamId]);

  const handleMarkAttendance = async (studentId: string, status: 'present' | 'absent' | 'excused') => {
    try {
      const existing = examAttendance.find(a => a.studentId === studentId);
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
      addToast("Attendance updated");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'exam_attendance');
    }
  };

  const handleUpdateMarks = async (studentId: string, marks: number) => {
    try {
      const submissionId = `${selectedExamId}_${studentId}`;
      await setDoc(doc(db, 'submissions', submissionId), {
        examId: selectedExamId,
        studentId,
        grade: marks,
        submittedAt: new Date().toISOString()
      }, { merge: true });
      
      addToast("Marks updated");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'submissions');
    }
  };

  const handleUploadResultFile = async (studentId: string) => {
    if (!resultFile || isUploadingResult !== studentId) return;
    
    setResultForm(prev => ({ ...prev, isUploading: true, uploadProgress: 0 }));
    console.log(">>> [MarksRegister] Starting standalone file upload for student:", studentId);

    try {
      let attachmentUrl = '';
      let attachmentType: 'image' | 'pdf' | 'word' = 'image';
      let attachmentName = resultFile.name;

      // Check Cloudinary
      let cloudinaryConfig: any = null;
      try {
        const configResp = await fetch('/api/cloudinary-config', { credentials: 'include' });
        if (configResp.ok) {
          const config = await configResp.json();
          if (config.enabled) cloudinaryConfig = config;
        }
      } catch (e) {
        console.log('[UPLOAD] Cloudinary check skipped');
      }

      const formData = new FormData();
      formData.append('file', resultFile);

      if (cloudinaryConfig) {
        formData.append('api_key', cloudinaryConfig.api_key);
        formData.append('timestamp', cloudinaryConfig.timestamp.toString());
        formData.append('signature', cloudinaryConfig.signature);
        formData.append('folder', cloudinaryConfig.folder);

        const xhr = new XMLHttpRequest();
        const uploadPromise = new Promise<{ secure_url: string }>((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) setResultForm(prev => ({ ...prev, uploadProgress: (e.loaded / e.total) * 100 }));
          });
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
            else reject(new Error(`Cloudinary error: ${xhr.statusText}`));
          });
          xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloud_name}/auto/upload`);
          xhr.send(formData);
        });
        const result = await uploadPromise;
        attachmentUrl = result.secure_url;
      } else {
        const xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        const uploadPromise = new Promise<{ url: string }>((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) setResultForm(prev => ({ ...prev, uploadProgress: (e.loaded / e.total) * 100 }));
          });
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
            else reject(new Error(`Server error: ${xhr.status}`));
          });
          xhr.open('POST', '/api/upload');
          xhr.send(formData);
        });
        const result = await uploadPromise;
        attachmentUrl = result.url;
      }

      attachmentType = resultFile.type.startsWith('image/') ? 'image' : 
                       resultFile.type === 'application/pdf' ? 'pdf' : 
                       (resultFile.type.includes('msword') || resultFile.type.includes('officedocument')) ? 'word' : 'image';

      const submissionId = `${selectedExamId}_${studentId}`;
      await setDoc(doc(db, 'submissions', submissionId), {
        attachmentUrl,
        attachmentName,
        attachmentType,
        submittedAt: new Date().toISOString()
      }, { merge: true });

      setResultFile(null);
      setIsUploadingResult(null);
      addToast("Result file uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      addToast(error instanceof Error ? error.message : "Failed to upload file", "error");
    } finally {
      setResultForm(prev => ({ ...prev, isUploading: false, uploadProgress: 0 }));
    }
  };

  const getGrade = (percentage: number) => {
    const grade = grades.find(g => percentage >= g.minPercentage && percentage <= g.maxPercentage);
    return grade ? grade.label : '-';
  };

  const sendPortalResult = async (student: User, exam: Exam, submission?: Submission) => {
    setSelectedStudentForResult(student);
    setResultForm({
      marks: submission?.grade || 0,
      feedback: submission?.feedback || '',
      attachment: null,
      manualUrl: submission?.attachmentUrl && !submission.attachmentUrl.includes('firebasestorage') ? submission.attachmentUrl : '',
      isUploading: false,
      uploadProgress: 0
    });
    setIsSendingResult(true);
  };

  const handleFinalizeAndSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForResult || !selectedExamId) return;

    setResultForm(prev => ({ ...prev, isUploading: true, uploadProgress: 0 }));
    console.log(">>> Starting result publication process...");

    try {
      let fileUrl = '';
      let fileName = '';
      let fileType: 'image' | 'pdf' | 'word' = 'image';

      // Handle file upload if present in modal
      if (resultForm.attachment) {
        const file = resultForm.attachment;
        // Check Cloudinary
        let cloudinaryConfig: any = null;
        try {
          const configResp = await fetch('/api/cloudinary-config', { credentials: 'include' });
          if (configResp.ok) {
            const config = await configResp.json();
            if (config.enabled) cloudinaryConfig = config;
          }
        } catch (e) {
          console.log('[UPLOAD] Cloudinary check skipped');
        }

        const formData = new FormData();
        formData.append('file', file);

        if (cloudinaryConfig) {
          formData.append('api_key', cloudinaryConfig.api_key);
          formData.append('timestamp', cloudinaryConfig.timestamp.toString());
          formData.append('signature', cloudinaryConfig.signature);
          formData.append('folder', cloudinaryConfig.folder);

          const xhr = new XMLHttpRequest();
          const uploadPromise = new Promise<{ secure_url: string }>((resolve, reject) => {
            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) setResultForm(prev => ({ ...prev, uploadProgress: (e.loaded / e.total) * 100 }));
            });
            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
              else reject(new Error(`Cloudinary error: ${xhr.statusText}`));
            });
            xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloud_name}/auto/upload`);
            xhr.send(formData);
          });
          const result = await uploadPromise;
          fileUrl = result.secure_url;
        } else {
          const xhr = new XMLHttpRequest();
          xhr.withCredentials = true;
          const uploadPromise = new Promise<{ url: string }>((resolve, reject) => {
            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) setResultForm(prev => ({ ...prev, uploadProgress: (e.loaded / e.total) * 100 }));
            });
            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
              else reject(new Error(`Server error: ${xhr.status}`));
            });
            xhr.open('POST', '/api/upload');
            xhr.send(formData);
          });
          const result = await uploadPromise;
          fileUrl = result.url;
        }
        fileName = file.name;
        fileType = file.type.startsWith('image/') ? 'image' : 
                   file.type === 'application/pdf' ? 'pdf' : 
                   (file.type.includes('msword') || file.type.includes('officedocument')) ? 'word' : 'image';
      } else if (resultForm.manualUrl) {
        fileUrl = resultForm.manualUrl;
        fileName = 'Result Document';
        fileType = resultForm.manualUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : 
                   (resultForm.manualUrl.toLowerCase().includes('doc') ? 'word' : 'image');
      }

      const submissionId = `${selectedExamId}_${selectedStudentForResult.uid}`;
      const exam = exams.find(e => e.id === selectedExamId);
      if (!exam) throw new Error("Exam not found");
      
      console.log(">>> Updating submission record in Firestore...");
      const updateData: any = {
        examId: selectedExamId,
        studentId: selectedStudentForResult.uid,
        grade: resultForm.marks,
        feedback: resultForm.feedback || '',
        submittedAt: new Date().toISOString()
      };

      if (fileUrl) {
        updateData.attachmentUrl = fileUrl;
        updateData.attachmentName = fileName;
        updateData.attachmentType = fileType;
      }

      await setDoc(doc(db, 'submissions', submissionId), updateData, { merge: true });
      console.log(">>> Submission updated.");

      // Send Notification
      console.log(">>> Creating notification...");
      const percentage = (resultForm.marks / (exam.maxMarks || 1)) * 100;
      const grade = getGrade(percentage);
      const isPass = resultForm.marks >= (exam.passingMarks || 0);
      
      const message = `Hi ${selectedStudentForResult.name}, your results for ${exam.title} are ready. Marks: ${resultForm.marks}/${exam.maxMarks}, Grade: ${grade}. Status: ${isPass ? 'PASS' : 'FAIL'}${resultForm.feedback ? `\n\nFeedback: ${resultForm.feedback}` : ''}`;
      
      const notificationData: any = {
        userId: selectedStudentForResult.uid,
        title: 'Exam Results Published',
        message: message,
        type: 'grade',
        read: false,
        createdAt: new Date().toISOString(),
        link: '/results'
      };

      const existingSub = submissions.find(s => s.id === submissionId);
      if (fileUrl) {
        notificationData.attachmentUrl = fileUrl;
        notificationData.attachmentName = fileName;
        notificationData.attachmentType = fileType;
      } else if (existingSub?.attachmentUrl) {
        notificationData.attachmentUrl = existingSub.attachmentUrl;
        notificationData.attachmentName = existingSub.attachmentName || 'Attachment';
        notificationData.attachmentType = existingSub.attachmentType || 'image';
      }

      Object.keys(notificationData).forEach(key => {
        if (notificationData[key] === undefined) delete notificationData[key];
      });

      await addDoc(collection(db, 'notifications'), notificationData);
      console.log(">>> Notification sent.");
      
      addToast(`Results sent to ${selectedStudentForResult.name}'s portal`);
      setIsSendingResult(false);
      setSelectedStudentForResult(null);
    } catch (error) {
      console.error(">>> Finalize and send error:", error);
      addToast(error instanceof Error ? error.message : "Failed to send results", "error");
    } finally {
      setResultForm(prev => ({ ...prev, isUploading: false, uploadProgress: 0 }));
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marks Register</h1>
          <p className="text-gray-500">Manage exam attendance and marks</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => setIsManagingGrades(true)}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Settings size={20} />
              Grading Scale
            </button>
          )}
          {selectedExamId && (isAdmin || isTeacher) && (
            <Link
              to="/exams/attendance"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
            >
              <ClipboardCheck size={20} />
              Exam Attendance
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedUnitId('');
                setSelectedExamId('');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
            >
              <option value="">Select Class</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select
              value={selectedUnitId}
              onChange={(e) => {
                setSelectedUnitId(e.target.value);
                setSelectedExamId('');
              }}
              disabled={!selectedClassId}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
            >
              <option value="">Select Unit</option>
              {units.filter(u => u.classId === selectedClassId).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam / Assessment</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              disabled={!selectedClassId}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
            >
              <option value="">Select Exam</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>{e.title} ({e.type})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Student</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Name or Email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            </div>
          </div>
        </div>
      </div>

      {selectedExamId ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Student</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Attendance</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Marks ({selectedExam?.maxMarks})</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Result Slip</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Grade</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStudents.map((student, idx) => {
                  const submission = submissions.find(s => s.studentId === student.uid);
                  const attendance = examAttendance.find(a => a.studentId === student.uid);
                  const marks = submission?.grade || 0;
                  const percentage = selectedExam ? (marks / selectedExam.maxMarks) * 100 : 0;
                  const grade = getGrade(percentage);
                  const isPass = selectedExam ? marks >= selectedExam.passingMarks : false;

                  return (
                    <tr key={`${student.uid || 'stub'}_${selectedExamId || 'exam'}_${idx}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.email}</p>
                            {student.admissionNumber && (
                              <p className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit mt-1 uppercase tracking-tight">
                                {student.admissionNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={attendance?.status || ''}
                          onChange={(e) => handleMarkAttendance(student.uid, e.target.value as any)}
                          className={`text-xs font-medium px-2 py-1 rounded-lg border ${
                            attendance?.status === 'present' ? 'bg-green-50 text-green-700 border-green-200' :
                            attendance?.status === 'absent' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          <option value="">Mark</option>
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="excused">Excused</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={submission?.grade || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) handleUpdateMarks(student.uid, val);
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-slate-900"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 min-w-[140px]">
                          {submission?.attachmentUrl ? (
                            <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1.5 rounded-lg border border-blue-100">
                              <a
                                href={submission.attachmentUrl.startsWith('http') ? `/api/download?url=${encodeURIComponent(submission.attachmentUrl)}&filename=${encodeURIComponent(submission.attachmentName || 'attachment')}` : submission.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 hover:underline"
                                title="View/Download Attachment"
                              >
                                {submission.attachmentType === 'pdf' ? <FileIcon size={14} /> : 
                                 submission.attachmentType === 'word' ? <FileText size={14} /> : 
                                 <ImageIcon size={14} />}
                                <span className="truncate max-w-[80px] font-medium">{submission.attachmentName}</span>
                              </a>
                              <button 
                                onClick={async () => {
                                  if (confirm("Remove this attachment?")) {
                                    await updateDoc(doc(db, 'submissions', submission.id), {
                                      attachmentUrl: null,
                                      attachmentName: null,
                                      attachmentType: null
                                    });
                                    addToast("Attachment removed");
                                  }
                                }}
                                className="ml-1 text-red-500 hover:text-red-700 p-0.5 hover:bg-red-50 rounded"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1.5 cursor-pointer px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-xs font-bold uppercase tracking-wider shadow-sm" title="Upload Result Document">
                                  <Paperclip size={14} />
                                  <span>{resultFile && isUploadingResult === student.uid ? 'Selected' : 'Attach Result'}</span>
                                  <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*,.pdf,.doc,.docx"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        setResultFile(file);
                                        setIsUploadingResult(student.uid);
                                      }
                                    }}
                                  />
                                </label>
                                {resultFile && isUploadingResult === student.uid && (
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={() => handleUploadResultFile(student.uid)}
                                      className="text-xs bg-green-600 text-white px-2 py-1.5 rounded-lg hover:bg-green-700 font-bold uppercase shadow-sm"
                                    >
                                      Upload
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setResultFile(null);
                                        setIsUploadingResult(null);
                                      }}
                                      className="text-gray-400 hover:text-red-500 p-1"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                )}
                              </div>
                              {isUploadingResult === student.uid && resultFile && (
                                <p className="text-xs text-blue-500 truncate max-w-[120px] italic font-medium">
                                  {resultFile.name}
                                </p>
                              )}
                              {isUploadingResult === student.uid && !resultFile && (
                                <div className="flex items-center gap-1 text-blue-600">
                                  <Loader2 size={12} className="animate-spin" />
                                  <span className="text-xs font-bold">Uploading...</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-gray-900">{grade}</span>
                      </td>
                      <td className="px-6 py-4">
                        {submission ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                            isPass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {isPass ? <CheckCircle size={12} /> : <XCircle size={12} />}
                            {isPass ? 'PASS' : 'FAIL'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No record</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => sendPortalResult(student, selectedExam!, submission)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Send Results to Student Portal"
                        >
                          <Send size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedUnitId ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <BookOpen className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-bold text-gray-900">
            No Assessment Selected for {units.find(u => u.id === selectedUnitId)?.name}
          </h3>
          <p className="text-gray-500 mb-6">Select an existing assessment or create a new one to start marking.</p>
          <div className="flex justify-center gap-4">
             <Link
              to="/exams"
              state={{ prefillUnitId: selectedUnitId, prefillClassId: selectedClassId }}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            >
              <Plus size={20} />
              Create New Assessment
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <ClipboardCheck className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900">Select a Class and Unit</h3>
          <p className="text-gray-500">Choose a class and a unit to view assessments and marks</p>
        </div>
      )}

      {/* Grading Scale Modal */}
      <AnimatePresence>
        {isManagingGrades && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsManagingGrades(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-2xl p-8 w-full max-w-2xl shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Grading Scale</h2>
                <button onClick={() => setIsManagingGrades(false)} className="text-gray-400 hover:text-gray-600">
                  <XCircle size={32} />
                </button>
              </div>

              <div className="space-y-4 mb-8">
                {grades.map((grade) => (
                  <div key={grade.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Grade</label>
                      <input
                        type="text"
                        value={grade.label || ''}
                        onChange={(e) => updateDoc(doc(db, 'grades', grade.id), { label: e.target.value })}
                        className="w-full px-3 py-1 border border-gray-300 rounded-lg text-slate-900"
                        title="Label"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Min %</label>
                      <input
                        type="number"
                        value={grade.minPercentage || 0}
                        onChange={(e) => updateDoc(doc(db, 'grades', grade.id), { minPercentage: parseInt(e.target.value) })}
                        className="w-full px-3 py-1 border border-gray-300 rounded-lg text-slate-900"
                        title="Minimum Percentage"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Max %</label>
                      <input
                        type="number"
                        value={grade.maxPercentage || 0}
                        onChange={(e) => updateDoc(doc(db, 'grades', grade.id), { maxPercentage: parseInt(e.target.value) })}
                        className="w-full px-3 py-1 border border-gray-300 rounded-lg text-slate-900"
                        title="Maximum Percentage"
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => addDoc(collection(db, 'grades'), { label: 'New', minPercentage: 0, maxPercentage: 0 })}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Add Grade Level
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setIsManagingGrades(false)}
                  className="bg-blue-600 text-white font-bold px-8 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Send Result Modal */}
      <AnimatePresence>
        {isSendingResult && selectedStudentForResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsSendingResult(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Send Results</h2>
                  <p className="text-xs text-gray-500 font-medium">Publish results to student portal</p>
                </div>
                <button onClick={() => setIsSendingResult(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <XCircle size={28} />
                </button>
              </div>

              <form onSubmit={handleFinalizeAndSend} className="space-y-5">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-blue-600 font-black shadow-sm">
                    {selectedStudentForResult.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900">{selectedStudentForResult.name}</p>
                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">{selectedExam?.title}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Marks Obtained</label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        max={selectedExam?.maxMarks}
                        value={resultForm.marks || 0}
                        onChange={(e) => setResultForm(prev => ({ ...prev, marks: parseInt(e.target.value) || 0 }))}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 transition-all text-slate-900"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                        / {selectedExam?.maxMarks}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Grade</label>
                    <div className={`px-4 py-3 border rounded-xl font-black text-center transition-all ${
                      getGrade((resultForm.marks / (selectedExam?.maxMarks || 1)) * 100) !== '-' 
                      ? 'bg-blue-50 border-blue-100 text-blue-700' 
                      : 'bg-gray-100 border-gray-200 text-gray-400'
                    }`}>
                      {getGrade((resultForm.marks / (selectedExam?.maxMarks || 1)) * 100)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Teacher's Feedback</label>
                  <textarea
                    placeholder="Add a comment for the student..."
                    value={resultForm.feedback || ''}
                    onChange={(e) => setResultForm(prev => ({ ...prev, feedback: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 transition-all text-sm text-slate-900"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Result Slip (Optional)</label>
                    <div className="space-y-3">
                      {submissions.find(s => s.id === `${selectedExamId}_${selectedStudentForResult.uid}`)?.attachmentUrl && !resultForm.attachment && !resultForm.manualUrl && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-100 text-green-700 text-xs font-bold">
                          <CheckCircle size={14} />
                          <span className="truncate flex-1">Existing: {submissions.find(s => s.id === `${selectedExamId}_${selectedStudentForResult.uid}`)?.attachmentName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all">
                          <Paperclip size={20} className="text-gray-400" />
                          <span className="text-xs text-gray-600 font-bold truncate">
                            {resultForm.attachment ? resultForm.attachment.name : 'Upload File'}
                          </span>
                          <input 
                            type="file" 
                            accept="image/*,application/pdf,.doc,.docx" 
                            onChange={(e) => setResultForm(prev => ({ ...prev, attachment: e.target.files?.[0] || null, manualUrl: '' }))} 
                            className="hidden" 
                          />
                        </label>
                        {resultForm.attachment && (
                          <button
                            type="button"
                            onClick={() => setResultForm(prev => ({ ...prev, attachment: null }))}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <X size={20} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-gray-100"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-gray-400 font-black tracking-widest">OR</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Result Link (URL)</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="url"
                        placeholder="Paste Google Drive/Dropbox link..."
                        value={resultForm.manualUrl || ''}
                        onChange={(e) => setResultForm(prev => ({ ...prev, manualUrl: e.target.value, attachment: null }))}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 transition-all text-sm text-slate-900"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-400 font-medium italic">Use this if file upload is blocked by your plan.</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resultForm.isUploading}
                  className="w-full bg-blue-600 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    {resultForm.isUploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    {resultForm.isUploading ? 'Uploading...' : 'Publish to Portal'}
                  </div>
                  {resultForm.isUploading && resultForm.uploadProgress > 0 && (
                    <div className="w-48 h-1 bg-blue-400 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="h-full bg-white transition-all duration-300" 
                        style={{ width: `${resultForm.uploadProgress}%` }}
                      />
                    </div>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
};
