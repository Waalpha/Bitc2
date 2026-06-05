import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Exam, Question } from '../types';
import { CheckCircle, ArrowRight, ArrowLeft, Clock, FileText, MapPin, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

export const ExamTaking: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const { user, studentContext } = useAuth();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  useEffect(() => {
    if (!examId) return;
    const fetchExam = async () => {
      try {
        const docRef = doc(db, 'exams', examId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const examData = { id: docSnap.id, ...docSnap.data() } as Exam;
          setExam(examData);
          if (examData.duration) {
            setTimeLeft(examData.duration * 60);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `exams/${examId}`);
      }
    };
    fetchExam();
  }, [examId]);

  useEffect(() => {
    if (timeLeft === null || isFinished || autoSubmitted) return;

    if (timeLeft <= 0) {
      handleAutoSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isFinished, autoSubmitted]);

  const handleAutoSubmit = async () => {
    if (autoSubmitted) return;
    setAutoSubmitted(true);
    await handleSubmit();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (!exam || !user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'submissions'), {
        examId: exam.id,
        studentId: studentContext?.uid || user.uid,
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
        submittedAt: new Date().toISOString(),
      });
      setIsFinished(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'submissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!exam) return <div className="flex items-center justify-center min-h-screen">Loading exam...</div>;

  if (exam.isOffline) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 px-6">
        <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600 shadow-xl shadow-blue-100">
          <FileText size={48} />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-4 uppercase tracking-tight">Physical Examination</h1>
        <p className="text-gray-500 mb-8 font-medium italic">
          This is a regular offline exam taking place at a physical location. You do not need to submit anything online. 
          Your results will be posted here once your teacher has graded your paper.
        </p>
        <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 text-left space-y-4 mb-8">
          {exam.examDate && (
            <div className="flex items-center gap-3">
               <Clock className="text-blue-500" size={20} />
               <div>
                  <p className="text-xs font-black uppercase text-gray-400">Date & Time</p>
                  <p className="font-bold text-gray-900">{format(new Date(exam.examDate), 'MMMM dd, yyyy @ HH:mm')}</p>
               </div>
            </div>
          )}
          {exam.location && (
            <div className="flex items-center gap-3">
               <MapPin className="text-blue-500" size={20} />
               <div>
                  <p className="text-xs font-black uppercase text-gray-400">Location</p>
                  <p className="font-bold text-gray-900">{exam.location}</p>
               </div>
            </div>
          )}
        </div>
        <button 
          onClick={() => navigate('/results')}
          className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all shadow-xl"
        >
          Back to Results
        </button>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
          <CheckCircle size={48} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Exam Submitted!</h1>
        <p className="text-gray-500 mb-8">Your answers have been successfully submitted for grading. Your teacher will provide feedback soon.</p>
        <button
          onClick={() => navigate('/exams')}
          className="bg-blue-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors"
        >
          Back to Exams
        </button>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentQuestionIdx];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{exam.title}</h1>
          <p className="text-sm text-gray-500">Question {currentQuestionIdx + 1} of {exam.questions.length}</p>
        </div>
        <div className={`flex items-center gap-2 font-bold transition-colors ${timeLeft !== null && timeLeft < 60 ? 'text-red-600 animate-pulse' : 'text-orange-600'}`}>
          <Clock size={20} />
          <span>{timeLeft !== null ? formatTime(timeLeft) : 'No Time Limit'}</span>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 min-h-[400px] flex flex-col">
        <div className="flex-1">
          <h2 className="text-2xl font-semibold text-gray-900 mb-8">{currentQuestion.text}</h2>
          
          <div className="space-y-4">
            {currentQuestion.options?.map((option, idx) => (
              <button
                key={`${option}_${idx}`}
                onClick={() => handleAnswer(currentQuestion.id, option)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                  answers[currentQuestion.id] === option
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-100 bg-gray-50 hover:border-blue-200 text-gray-700'
                }`}
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                  answers[currentQuestion.id] === option ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-400'
                }`}>
                  {String.fromCharCode(65 + idx)}
                </div>
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 flex justify-between items-center pt-8 border-t border-gray-100">
          <button
            disabled={currentQuestionIdx === 0}
            onClick={() => setCurrentQuestionIdx(prev => prev - 1)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-semibold disabled:opacity-30"
          >
            <ArrowLeft size={20} />
            Previous
          </button>

          {currentQuestionIdx === exam.questions.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-green-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle size={20} />
              {isSubmitting ? 'Submitting...' : 'Finish Exam'}
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestionIdx(prev => prev + 1)}
              className="bg-blue-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              Next
              <ArrowRight size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
          style={{ width: `${((currentQuestionIdx + 1) / exam.questions.length) * 100}%` }}
        />
      </div>
    </div>
  );
};
