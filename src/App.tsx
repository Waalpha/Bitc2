declare module 'react-router-dom';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { NotificationManager } from './components/NotificationManager';
import { LiveLessonManager } from './components/LiveLessonManager';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { InactivityTimer } from './components/InactivityTimer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { Classes } from './pages/Classes';
import { Units } from './pages/Units';
import { MyUnits } from './pages/MyUnits';
import { Attendance } from './pages/Attendance';
import { Exams } from './pages/Exams';
import { ExamTaking } from './pages/ExamTaking';
import { ExamResults } from './pages/ExamResults';
import { ExamAttendance } from './pages/ExamAttendance';
import { Fees } from './pages/Fees';
import { MarksRegister } from './pages/MarksRegister';
import { AdminSettings } from './pages/AdminSettings';
import { Students } from './pages/Students';
import { StudentAdmission } from './pages/StudentAdmission';
import { Chat } from './pages/Chat';
import { WhatsApp } from './pages/WhatsApp';
import { Timetable } from './pages/Timetable';
import { Profile } from './pages/Profile';

const ProtectedRoute = ({ 
  children, 
  requiredRole, 
  excludeRole 
}: { 
  children: JSX.Element | JSX.Element[], 
  requiredRole?: string,
  excludeRole?: string 
}) => {
  const { user, userData, loading, isAuthReady } = useAuth();

  if (!isAuthReady || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !userData) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && userData.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  if (excludeRole && userData.role === excludeRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <InactivityTimer>
      <Layout>{children}</Layout>
    </InactivityTimer>
  );
};

const NavigateWrapper = () => {
  const { userData } = useAuth();
  const fallback = userData?.role === 'student' ? '/dashboard' : '/dashboard';
  return <Navigate to={fallback} replace />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationManager />
        <LiveLessonManager />
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
            <Route path="/students/admission" element={<ProtectedRoute><StudentAdmission /></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute><Classes /></ProtectedRoute>} />
            <Route path="/units" element={<ProtectedRoute><Units /></ProtectedRoute>} />
            <Route path="/my-units" element={<ProtectedRoute requiredRole="student"><MyUnits /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/exams" element={<ProtectedRoute><Exams /></ProtectedRoute>} />
            <Route path="/exams/attendance" element={<ProtectedRoute><ExamAttendance /></ProtectedRoute>} />
            <Route path="/results" element={<ProtectedRoute><ExamResults /></ProtectedRoute>} />
            <Route path="/exams/take/:examId" element={<ProtectedRoute><ExamTaking /></ProtectedRoute>} />
            <Route path="/fees" element={<ProtectedRoute><Fees /></ProtectedRoute>} />
            <Route path="/marks" element={<ProtectedRoute><MarksRegister /></ProtectedRoute>} />
            <Route path="/chat" element={<Navigate to="/whatsapp" replace />} />
            <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/timetable" element={<ProtectedRoute><Timetable /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminSettings /></ProtectedRoute>} />
            <Route path="*" element={<NavigateWrapper />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
