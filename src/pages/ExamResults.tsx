import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Exam, Submission, Unit, Class } from '../types';
import { Award, BookOpen, Calendar, ChevronRight, FileText, TrendingUp, CheckCircle, XCircle, Clock, File as FileIcon, Image as ImageIcon, Download, PieChart as PieIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export const ExamResults: React.FC = () => {
  const { user, userData, studentContext } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const examsSnap = await getDocs(query(collection(db, 'exams')));
        setExams(examsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam)));

        const unitsSnap = await getDocs(query(collection(db, 'units')));
        setUnits(unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));

        const classesSnap = await getDocs(query(collection(db, 'classes')));
        setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));

        const isStudentOrParent = userData?.role === 'student' || userData?.role === 'parent';
        const targetStudentId = studentContext?.uid || user.uid;

        const submissionsQ = isStudentOrParent
          ? query(collection(db, 'submissions'), where('studentId', '==', targetStudentId))
          : query(collection(db, 'submissions'));

        const submissionsSnap = await getDocs(submissionsQ);
        setSubmissions(submissionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'exam-results');
        setLoading(false);
      }
    };

    fetchData();
  }, [user, userData, studentContext]);

  const getExamStats = (examId: string) => {
    const examSubmissions = submissions.filter(s => s.examId === examId);
    if (examSubmissions.length === 0) return null;

    const grades = examSubmissions.map(s => s.grade || 0);
    const average = grades.reduce((a, b) => a + b, 0) / grades.length;
    const passRate = (examSubmissions.filter(s => (s.grade || 0) >= (exams.find(e => e.id === examId)?.passingMarks || 40)).length / examSubmissions.length) * 100;

    return { average, passRate, count: examSubmissions.length };
  };

  const getGlobalStats = () => {
    if (submissions.length === 0) return null;
    
    const passed = submissions.filter(sub => {
      const exam = exams.find(e => e.id === sub.examId);
      return sub.grade !== undefined && exam && sub.grade >= exam.passingMarks;
    }).length;
    
    const failed = submissions.filter(sub => {
      const exam = exams.find(e => e.id === sub.examId);
      return sub.grade !== undefined && exam && sub.grade < exam.passingMarks;
    }).length;

    const ungraded = submissions.length - passed - failed;

    return [
      { name: 'Passed', value: passed, color: '#10B981' },
      { name: 'Failed', value: failed, color: '#EF4444' },
      { name: 'Ungraded', value: ungraded, color: '#94A3B8' }
    ].filter(d => d.value > 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const globalStats = getGlobalStats();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">Academic Performance</h1>
          <p className="text-gray-500 font-medium">Detailed breakdown of assessment results</p>
        </div>
        {userData?.role === 'student' && submissions.length > 0 && (
          <div className="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-lg shadow-blue-200 flex items-center gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-80">Overall Average</p>
              <p className="text-xl font-bold">
                {(submissions.reduce((a, b) => a + (b.grade || 0), 0) / submissions.length).toFixed(1)}%
              </p>
            </div>
            <TrendingUp size={24} className="opacity-50" />
          </div>
        )}
      </div>

      {userData?.role !== 'student' && globalStats && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-8 items-center"
        >
          <div className="md:col-span-1 h-[200px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={globalStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {globalStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 leading-none">Total</p>
              <p className="text-xl font-bold text-gray-900">{submissions.length}</p>
            </div>
          </div>
          
          <div className="md:col-span-2 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 leading-tight">System-wide Success Rate</h3>
              <p className="text-gray-500 font-medium italic mt-1 text-sm">Aggregated results across all exams and classes.</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              {globalStats.map((stat) => (
                <div key={stat.name} className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{stat.name}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs font-bold text-gray-400">
                    {((stat.value / submissions.length) * 100).toFixed(1)}% of total
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {userData?.role === 'student' ? (
        <div className="grid grid-cols-1 gap-6">
          {submissions.length > 0 ? (
            submissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).map((sub, idx) => {
              const exam = exams.find(e => e.id === sub.examId);
              const unit = units.find(c => c.id === exam?.unitId);
              const isPassed = sub.grade !== undefined && exam && sub.grade >= exam.passingMarks;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={`${sub.id || 'sub'}_${idx}`}
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl transition-all group"
                >
                  <div className="p-8 flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-bold uppercase tracking-widest text-gray-500">
                          {exam?.type || 'Assessment'}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-bold text-gray-400">
                          <Calendar size={14} />
                          {format(new Date(sub.submittedAt), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">
                          {exam?.title || 'Unknown Assessment'}
                        </h3>
                        <p className="text-gray-500 font-bold flex items-center gap-2 mt-1">
                          <BookOpen size={16} className="text-blue-500" />
                          {unit?.name || 'General Unit'}
                        </p>
                      </div>

                      {sub.feedback && (
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 italic text-gray-600 text-sm">
                          "{sub.feedback}"
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-center px-8 border-x border-gray-100">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Your Score</p>
                        <div className={`text-4xl font-bold ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
                          {sub.grade}%
                        </div>
                        <p className="text-xs font-bold text-gray-400 mt-1">out of {exam?.maxMarks || 100}</p>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center gap-2">
                        {isPassed ? (
                          <div className="w-12 h-12 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center shadow-inner">
                            <CheckCircle size={24} />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shadow-inner">
                            <XCircle size={24} />
                          </div>
                        )}
                        <span className={`text-xs font-bold uppercase tracking-widest ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
                          {isPassed ? 'Passed' : 'Failed'}
                        </span>
                      </div>
                    </div>

                    {sub.attachmentUrl && (
                      <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between bg-blue-50/50 -mx-8 -mb-8 px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${
                            sub.attachmentType === 'pdf' ? 'bg-red-100 text-red-600' : 
                            sub.attachmentType === 'word' ? 'bg-blue-600 text-white' : 
                            'bg-blue-100 text-blue-600'
                          }`}>
                            {sub.attachmentType === 'pdf' ? <FileIcon size={20} /> : 
                             sub.attachmentType === 'word' ? <FileText size={20} /> : 
                             <ImageIcon size={20} />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">Result Document</p>
                            <p className="text-xs font-bold text-gray-500 truncate max-w-[200px]">{sub.attachmentName}</p>
                          </div>
                        </div>
                        <a 
                          href={sub.attachmentUrl.startsWith('http') ? `/api/download?url=${encodeURIComponent(sub.attachmentUrl)}&filename=${encodeURIComponent(sub.attachmentName || 'attachment')}` : sub.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-sm hover:shadow-md transition-all border border-blue-100"
                        >
                          <FileText size={14} />
                          Open Result
                        </a>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="text-center py-32 bg-white rounded-3xl border-2 border-dashed border-gray-200">
              <Award className="mx-auto text-gray-200 mb-6" size={64} />
              <h3 className="text-xl font-bold text-gray-900">No Results Found</h3>
              <p className="text-gray-500 font-medium max-w-xs mx-auto mt-2">
                You haven't completed any assessments yet. Your grades will appear here once they are published.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam, idx) => {
            const stats = getExamStats(exam.id);
            const unit = units.find(c => c.id === exam.unitId);
            const cls = classes.find(c => c.id === exam.classId);

            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={`${exam.id || 'exam'}_${idx}`}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl transition-all"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
                      <TrendingUp size={24} />
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Submissions</p>
                      <p className="text-lg font-bold text-gray-900">{stats?.count || 0}</p>
                    </div>
                  </div>

                  <div className="space-y-1 mb-6">
                    <h3 className="text-lg font-bold text-gray-900 truncate">{exam.title}</h3>
                    <p className="text-xs font-bold text-gray-500">
                      {unit?.name} • {cls?.name || `Class ${exam.classId}`}
                    </p>
                  </div>

                  {stats ? (
                    <div className="space-y-6">
                      <div className="flex items-center gap-6">
                        <div className="w-24 h-24 flex-shrink-0 relative">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: 'Pass', value: Math.round(stats.count * (stats.passRate / 100)), color: '#10B981' },
                                  { name: 'Fail', value: stats.count - Math.round(stats.count * (stats.passRate / 100)), color: '#EF4444' }
                                ].filter(d => d.value > 0)}
                                cx="50%"
                                cy="50%"
                                innerRadius={25}
                                outerRadius={35}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {[{ color: '#10B981' }, { color: '#EF4444' }].map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                            <p className="text-xs font-bold text-gray-900">{Math.round(stats.passRate)}%</p>
                          </div>
                        </div>
                        <div className="flex-1 grid grid-cols-1 gap-4">
                          <div className="bg-gray-50 p-3 rounded-2xl">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1 leading-none">Avg. Score</p>
                            <p className="text-lg font-bold text-blue-600">{stats.average.toFixed(1)}%</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-2xl">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1 leading-none">Pass Rate</p>
                            <p className="text-lg font-bold text-green-600">{stats.passRate.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-green-500 h-full transition-all duration-1000" 
                          style={{ width: `${stats.passRate}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <p className="text-xs font-bold text-gray-400">No data available yet</p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
