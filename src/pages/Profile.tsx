import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { User, Submission, Class, Unit } from '../types';
import { 
  Settings, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  Award, 
  TrendingUp, 
  BookOpen, 
  GraduationCap,
  ShieldCheck,
  ChevronRight,
  Clock,
  Briefcase,
  X,
  Camera,
  Save,
  Loader2,
  Users,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toast, ToastMessage } from '../components/Toast';

import { uploadFile } from '../services/uploadService';

const SYSTEM_COURSES = [
  "Diploma in Beauty Therapy, Skincare & Professional Makeup",
  "Certificate in Hairdressing, Advanced Styling & Barbering",
  "Diploma in Software Engineering & Web Development",
  "Certificate in Computer Packages & Digital Commerce Systems",
  "Certificate in Healthcare Support Services & Caregiver",
  "Diploma in Nursing Aide, Anatomy & Patient Nutrition",
  "Certificate in Professional Cookery, General Baking & Cake Decoration",
  "Diploma in Catering & Hospitality Management",
  "Certificate in Solar PV Technology & Electrical Wiring",
  "Diploma in Domestic & Industrial Electrical Engineering",
  "Certificate in Theology & Biblical Studies",
  "Diploma in Theology & Christian Ministry"
];

export const Profile: React.FC = () => {
  const { user, userData, settings } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const directFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isCustomCourseSelected, setIsCustomCourseSelected] = useState(false);

  useEffect(() => {
    if (userData) {
      const course = userData.course || '';
      const isSystem = SYSTEM_COURSES.includes(course) || course === '';
      setIsCustomCourseSelected(!isSystem);
    }
  }, [userData]);

  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    photoUrl: '',
    residence: 'Nairobi, Kenya',
    bloodGroup: 'O+',
    course: '', // Used as Department for teachers
    admissionNumber: '', // Used as Staff ID for teachers
    year: '1', // Used as Experience for teachers
    admissionDate: '',
    specialization: '',
    idNumber: '',
    nationality: '',
    gender: '',
    religion: '',
    emergencyContact: '',
    emergencyPhone: '',
    address: '',
    fatherName: '',
    fatherPhone: '',
    fatherOccupation: '',
    motherName: '',
    motherPhone: '',
    motherOccupation: '',
    guardianName: '',
    guardianPhone: '',
    guardianRelation: '',
    guardianEmail: '',
    guardianAddress: ''
  });

  const addToast = (text: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
  };

  useEffect(() => {
    if (userData) {
      setEditForm({
        name: userData.name || '',
        phone: userData.phone || '',
        photoUrl: userData.photoUrl || '',
        residence: userData.residence || 'Nairobi, Kenya',
        bloodGroup: userData.bloodGroup || 'O+',
        course: userData.course || '',
        admissionNumber: userData.admissionNumber || '',
        year: userData.year || '1',
        admissionDate: userData.admissionDate || '',
        specialization: userData.specialization || '',
        idNumber: userData.idNumber || '',
        nationality: userData.nationality || '',
        gender: userData.gender || '',
        religion: userData.religion || '',
        emergencyContact: userData.emergencyContact || '',
        emergencyPhone: userData.emergencyPhone || '',
        address: userData.address || '',
        fatherName: userData.fatherName || '',
        fatherPhone: userData.fatherPhone || '',
        fatherOccupation: userData.fatherOccupation || '',
        motherName: userData.motherName || '',
        motherPhone: userData.motherPhone || '',
        motherOccupation: userData.motherOccupation || '',
        guardianName: userData.guardianName || '',
        guardianPhone: userData.guardianPhone || '',
        guardianRelation: userData.guardianRelation || '',
        guardianEmail: userData.guardianEmail || '',
        guardianAddress: userData.guardianAddress || ''
      });
    }
  }, [userData]);

  useEffect(() => {
    if (!user) return;

    const fetchProfileData = async () => {
      try {
        const subsSnap = await getDocs(query(collection(db, 'submissions'), where('studentId', '==', user.uid)));
        setSubmissions(subsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));

        const unitsSnap = await getDocs(collection(db, 'units'));
        setUnits(unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));

        const classesSnap = await getDocs(collection(db, 'classes'));
        setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'profile-data');
      }
    };
    fetchProfileData();
  }, [user]);

  const calculateGPA = () => {
    if (submissions.length === 0) return "0.0";
    const gradedSubmissions = submissions.filter(s => s.grade !== undefined);
    if (gradedSubmissions.length === 0) return "0.0";
    
    // Simple conversion of 0-100 to 4.0 scale
    const totalPoints = gradedSubmissions.reduce((acc, curr) => acc + ((curr.grade || 0) / 25), 0);
    return (totalPoints / gradedSubmissions.length).toFixed(2);
  };

  const isStudent = userData?.role === 'student';
  const isAdmin = userData?.role === 'admin';

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast('Photo must be less than 5MB', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const uploadResult = await uploadFile(file);
      setEditForm(prev => ({ ...prev, photoUrl: uploadResult.url }));
      addToast('Photo uploaded successfully');
    } catch (error) {
      console.error('Photo upload failed:', error);
      addToast('Failed to upload photo', 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoUploadDirect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast('Photo must be less than 5MB', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const uploadResult = await uploadFile(file);
      await updateDoc(doc(db, 'users', user.uid), {
        photoUrl: uploadResult.url,
        updatedAt: new Date().toISOString()
      });
      addToast('Profile photo updated successfully!');
    } catch (error) {
      console.error('Direct photo upload failed:', error);
      addToast('Failed to update profile photo', 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeletePhotoDirect = async () => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete your profile photo?')) return;

    setIsUploadingPhoto(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        photoUrl: '',
        updatedAt: new Date().toISOString()
      });
      addToast('Profile photo deleted successfully!');
    } catch (error) {
      console.error('Direct photo deletion failed:', error);
      addToast('Failed to delete profile photo', 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const dataToSave = { ...editForm };
      if (!isAdmin) {
        dataToSave.admissionDate = userData?.admissionDate || '';
      }
      await updateDoc(doc(db, 'users', user.uid), {
        ...dataToSave,
        updatedAt: new Date().toISOString()
      });
      addToast('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      addToast('Failed to update profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`space-y-8 ${isStudent ? 'text-white' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className={`text-4xl font-bold uppercase tracking-tighter ${isStudent ? 'text-white' : 'text-gray-900'}`}>
          My Profile
        </h1>
        <button 
          onClick={() => setIsEditing(true)}
          className={`p-4 rounded-3xl border transition-all active:scale-95 ${
            isStudent ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-100 text-gray-400 hover:text-gray-600 shadow-sm'
          }`}
        >
          <Settings size={28} />
        </button>
      </div>

      {/* Profile Hero Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-[48px] p-10 text-center relative overflow-hidden ${
          isStudent ? 'bg-[#1A1F2E] border border-white/5 shadow-2xl' : 'bg-white border border-gray-100 shadow-sm'
        }`}
      >
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative inline-block mb-8">
          <div className={`w-36 h-36 rounded-full p-2 border-2 ${isStudent ? 'border-blue-500/30 bg-blue-500/10' : 'border-blue-100 bg-blue-50'}`}>
            <div className={`w-full h-full rounded-full flex items-center justify-center text-white font-bold overflow-hidden shadow-2xl relative group/avatar ${
              isStudent ? 'bg-blue-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
            }`}>
              {userData?.photoUrl ? (
                <img src={userData.photoUrl} alt={userData.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-5xl">{userData?.name?.charAt(0)}</span>
              )}
              
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                <input
                  type="file"
                  ref={directFileInputRef}
                  onChange={handlePhotoUploadDirect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => directFileInputRef.current?.click()}
                  className="w-full text-[10px] font-black tracking-wider uppercase text-white bg-blue-600 hover:bg-blue-700 py-1.5 rounded-lg transition-all active:scale-95"
                >
                  Change
                </button>
                {userData?.photoUrl && (
                  <button
                    type="button"
                    onClick={handleDeletePhotoDirect}
                    className="w-full text-[10px] font-black tracking-wider uppercase text-white bg-rose-600 hover:bg-rose-700 py-1 rounded-lg transition-all active:scale-95"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="absolute bottom-1 right-1 bg-blue-500 text-white p-2.5 rounded-2xl shadow-xl border-4 border-[#1A1F2E]">
            <ShieldCheck size={20} />
          </div>
        </div>

        {/* Profile Photo Actions for Mobile and Convenience */}
        <div className="flex justify-center gap-3 mt-1 mb-6">
          <button
            type="button"
            onClick={() => directFileInputRef.current?.click()}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm ${
              isStudent ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
          </button>
          {userData?.photoUrl && (
            <button
              type="button"
              onClick={handleDeletePhotoDirect}
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all shadow-sm"
            >
              Delete Photo
            </button>
          )}
        </div>

        <div className="space-y-2 mb-8">
          <h2 className={`text-4xl font-bold tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>
            {userData?.name}
          </h2>
          <p className={`text-sm font-bold uppercase tracking-[0.2em] opacity-60 ${isStudent ? 'text-blue-400' : 'text-primary'}`}>
            {isStudent ? 'Admission Num: ' : 'Staff ID: '}{userData?.admissionNumber || (isStudent ? 'BITC/2026/001' : 'STF/2026/001')}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <span className={`px-8 py-3 rounded-2xl text-xs font-bold uppercase tracking-[0.2em] shadow-lg ${
            isStudent ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-500'
          }`}>
            {isStudent ? `Year ${userData?.year || '1'}` : `${userData?.year || '1'} Years Exp`}
          </span>
          <span className="px-8 py-3 rounded-2xl text-xs font-bold uppercase tracking-[0.2em] bg-blue-600 text-white shadow-xl shadow-blue-500/20">
            {isStudent ? (userData?.course || 'Certificate ICT') : (userData?.course || 'Department Not Set')}
          </span>
        </div>
      </motion.div>

      {/* Basic Stats */}
      <div className="grid grid-cols-3 gap-6">
        {(isStudent ? [
          { label: 'GPA', value: calculateGPA(), icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'RANK', value: '#4', icon: Award, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'CREDITS', value: '124', icon: GraduationCap, color: 'text-indigo-500', bg: 'bg-indigo-500/10' }
        ] : [
          { label: 'UNITS', value: `${classes.filter(c => c.teacherId === user?.uid).reduce((acc, c) => acc + (c.unitIds?.length || 0), 0)}`, icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'CLASSES', value: `${classes.filter(c => c.teacherId === user?.uid).length}`, icon: Users, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'EXP', value: `${userData?.year || '0'}y`, icon: Briefcase, color: 'text-indigo-500', bg: 'bg-indigo-500/10' }
        ]).map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className={`rounded-[32px] p-8 text-center border relative overflow-hidden group hover:scale-[1.02] transition-transform ${
              isStudent ? 'bg-[#1A1F2E] border-white/5' : 'bg-white border-gray-100 shadow-sm'
            }`}
          >
            <div className={`absolute top-0 right-0 w-16 h-16 ${stat.bg} rounded-bl-[40px] opacity-20 -mr-2 -mt-2 group-hover:scale-110 transition-transform`} />
            <p className={`text-xs font-bold uppercase tracking-[0.3em] mb-4 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>
              {stat.label}
            </p>
            <p className={`text-4xl font-bold ${(isStudent || !isStudent) ? (isStudent ? 'text-white' : 'text-gray-900') : ''} flex flex-col items-center`}>
              {stat.value}
              {isStudent && stat.label === 'GPA' && <span className="text-xs opacity-50 font-bold mt-1">/ 4.0</span>}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Academic Completion / Professional Growth */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`rounded-[40px] p-8 sm:p-10 border ${
          isStudent ? 'bg-[#1A1F2E] border-white/5 text-white' : 'bg-white border-gray-100 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-10">
          <h3 className={`text-xs font-bold uppercase tracking-[0.3em] ${isStudent ? 'text-blue-400' : 'text-primary'}`}>
            {isStudent ? 'Academic Completion' : 'Teaching Progress'}
          </h3>
          <div className={`px-4 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-widest ${
            isStudent ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}>
            {isStudent ? 'Current Semester: Sem 1' : 'Academic Year: 2026/2027'}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-2xl font-black ${isStudent ? 'text-white' : 'text-gray-900'}`}>
              {isStudent ? '32% Complete' : 'Syllabus Coverage: 75%'}
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-40">
              {isStudent ? 'Target graduation: 2029' : 'Next Review: June 2026'}
            </span>
          </div>
          <div className={`h-4 rounded-full overflow-hidden ${isStudent ? 'bg-white/5' : 'bg-gray-100'}`}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: isStudent ? '32%' : '75%' }}
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
            />
          </div>
        </div>
      </motion.div>

      {/* Identification Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`rounded-[40px] p-10 border ${
            isStudent ? 'bg-[#1A1F2E] border-white/5' : 'bg-white border-gray-100 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-4 mb-10">
            <div className={`p-4 rounded-2xl ${isStudent ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className={`text-xl font-bold tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>Identity Details</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted mt-0.5">Personal Verification</p>
            </div>
          </div>

          <div className="space-y-8">
            {isStudent && (
              <>
                {(userData?.fatherName || userData?.motherName) && (
                  <div className="p-6 bg-white/5 rounded-[32px] border border-white/5 space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400 opacity-60">Parents Info</p>
                    <div className="flex flex-col gap-3">
                      {userData?.fatherName && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-text-muted">Father:</span>
                          <span className="text-xs font-bold">{userData.fatherName}</span>
                        </div>
                      )}
                      {userData?.motherName && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-text-muted">Mother:</span>
                          <span className="text-xs font-bold">{userData.motherName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {userData?.guardianName && (
                  <div className="p-6 bg-white/5 rounded-[32px] border border-white/5 space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400 opacity-60">Guardian Info</p>
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-text-muted">Name:</span>
                        <span className="text-xs font-bold">{userData.guardianName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-text-muted">Relation:</span>
                        <span className="text-xs font-bold">{userData.guardianRelation || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-text-muted">Phone:</span>
                        <span className="text-xs font-bold">{userData.guardianPhone || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center gap-6 group">
              <div className={`p-5 rounded-3xl transition-colors ${isStudent ? 'bg-white/5 text-gray-400 group-hover:text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                <ShieldCheck size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">ID / Birth Cert Number</p>
                <p className={`font-bold tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>{userData?.idNumber || 'Not Set'}</p>
              </div>
            </div>

            <div className="flex items-center gap-6 group">
              <div className={`p-5 rounded-3xl transition-colors ${isStudent ? 'bg-white/5 text-gray-400 group-hover:text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                <MapPin size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Nationality</p>
                <p className={`font-bold tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>{userData?.nationality || 'Kenyan'}</p>
              </div>
            </div>

            <div className="flex items-center gap-6 group">
              <div className={`p-5 rounded-3xl transition-colors ${isStudent ? 'bg-white/5 text-gray-400 group-hover:text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                <Calendar size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Date of Birth</p>
                <p className={`font-bold tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>{userData?.dateOfBirth || 'Not Set'}</p>
              </div>
            </div>

            <div className="flex items-center gap-6 group">
              <div className={`p-5 rounded-3xl transition-colors ${isStudent ? 'bg-white/5 text-gray-400 group-hover:text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                <Info size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Gender / Religion</p>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isStudent ? 'bg-white/5 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    {userData?.gender || 'Not Set'}
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isStudent ? 'bg-white/5 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                    {userData?.religion || 'Not Set'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 group">
              <div className={`p-5 rounded-3xl transition-colors ${isStudent ? 'bg-white/5 text-gray-400 group-hover:text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                {isStudent ? <GraduationCap size={22} /> : <Briefcase size={22} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">{isStudent ? 'Year of Study' : 'Experience'}</p>
                <p className={`font-black tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>
                  {isStudent 
                    ? (userData?.year ? `Year ${userData.year}` : 'Not Set')
                    : (userData?.year ? `${userData.year} Years Teaching` : 'Experience Not Set')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 group">
              <div className={`p-5 rounded-3xl transition-colors ${isStudent ? 'bg-white/5 text-gray-400 group-hover:text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                <BookOpen size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">{isStudent ? 'Course / Programme' : 'Department'}</p>
                <p className={`font-black tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>
                  {isStudent ? (userData?.course || 'Not Set') : (userData?.course || 'Department Not Set')}
                </p>
              </div>
            </div>

            {!isStudent && userData?.specialization && (
              <div className="flex items-center gap-6 group">
                <div className={`p-5 rounded-3xl transition-colors ${isStudent ? 'bg-white/5 text-gray-400 group-hover:text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                  <Award size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Specialization</p>
                  <p className={`font-bold tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>{userData.specialization}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-6 group">
              <div className={`p-5 rounded-3xl transition-colors ${isStudent ? 'bg-white/5 text-gray-400 group-hover:text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                <Mail size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Email Address</p>
                <p className={`font-bold tracking-tight truncate ${isStudent ? 'text-white' : 'text-gray-900 line-clamp-1'}`}>{userData?.email}</p>
              </div>
              <ChevronRight size={18} className="text-text-muted opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
            </div>

            <div className="flex items-center gap-6 group">
              <div className={`p-5 rounded-3xl transition-colors ${isStudent ? 'bg-white/5 text-gray-400 group-hover:text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                <Phone size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Phone Number</p>
                <p className={`font-bold tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>{userData?.phone || '+254 712 345678'}</p>
              </div>
              <ChevronRight size={18} className="text-text-muted opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`rounded-[40px] p-10 border ${
            isStudent ? 'bg-[#1A1F2E] border-white/5' : 'bg-white border-gray-100 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-4 mb-10">
            <div className={`p-4 rounded-2xl ${isStudent ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <MapPin size={24} />
            </div>
            <div>
              <h3 className={`text-xl font-bold tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>Location & Origin</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted mt-0.5">Residence Info</p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-6 group">
              <div className={`p-5 rounded-3xl transition-colors ${isStudent ? 'bg-white/5 text-gray-400 group-hover:text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                <Calendar size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Admission Date</p>
                <p className={`font-bold tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>{userData?.admissionDate || 'Not Set'}</p>
              </div>
            </div>

            <div className="flex items-center gap-6 group">
              <div className={`p-5 rounded-3xl transition-colors ${isStudent ? 'bg-white/5 text-gray-400 group-hover:text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                <MapPin size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Current Residence</p>
                <p className={`font-bold tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>{userData?.residence || 'Nairobi, Kenya'}</p>
              </div>
            </div>

            <div className="flex items-center gap-6 group">
              <div className={`p-5 rounded-3xl transition-colors ${isStudent ? 'bg-white/5 text-gray-400 group-hover:text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                <Phone size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Emergency Contact</p>
                <p className={`font-black tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>
                  {userData?.emergencyContact || 'Not Set'}
                </p>
                {userData?.emergencyPhone && (
                  <p className="text-xs font-bold text-blue-400 mt-1">{userData.emergencyPhone}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6 group">
              <div className={`p-5 rounded-3xl transition-colors ${isStudent ? 'bg-white/5 text-gray-400 group-hover:text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                <Briefcase size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Blood Group</p>
                <p className={`font-bold tracking-tight ${isStudent ? 'text-white' : 'text-gray-900'}`}>{userData?.bloodGroup || 'O+'}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden border flex flex-col max-h-[85vh] ${
                isStudent ? 'bg-[#1A1F2E] border-white/10' : 'bg-white border-gray-100'
              }`}
            >
              <div className="p-8 sm:p-10 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-8 sticky top-0 bg-inherit z-10 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Edit Profile</h2>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400 mt-1">Update your info</p>
                  </div>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="p-3 rounded-2xl hover:bg-white/5 transition-colors text-text-muted"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="space-y-5">
                    <div className="group">
                      <label className={`block text-xs font-bold uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>Full Name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none ${
                          isStudent 
                          ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                          : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                        }`}
                        required
                      />
                    </div>

                    <div className="group">
                      <label className={`block text-xs font-bold uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>Phone Number</label>
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none ${
                          isStudent 
                          ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                          : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                        }`}
                        placeholder="+254 ..."
                      />
                    </div>

                    <div className="group">
                      <label className={`block text-xs font-bold uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>Profile Photo</label>
                      <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-2xl overflow-hidden border-2 mb-2 ${isStudent ? 'border-blue-500/30' : 'border-blue-100'}`}>
                          {editForm.photoUrl ? (
                            <img src={editForm.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                              <Camera size={20} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handlePhotoUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingPhoto}
                            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                              isStudent ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-900 hover:bg-gray-200 shadow-sm'
                            }`}
                          >
                            {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
                          </button>
                          {editForm.photoUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditForm(prev => ({ ...prev, photoUrl: '' }));
                                addToast('Photo deleted from preview. Save changes to commit.');
                              }}
                              className="px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all border border-rose-500/10 ml-2"
                            >
                              Delete Photo
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="url"
                          value={editForm.photoUrl}
                          onChange={(e) => setEditForm({ ...editForm, photoUrl: e.target.value })}
                          className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none pr-14 ${
                            isStudent 
                            ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                            : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                          }`}
                          placeholder="https://..."
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-blue-500/10 text-blue-500">
                          <Mail size={18} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="group">
                        <label className={`block text-xs font-black uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>
                          {isStudent ? 'Admission Number' : 'Staff ID'}
                        </label>
                        <input
                          type="text"
                          value={editForm.admissionNumber}
                          onChange={(e) => setEditForm({ ...editForm, admissionNumber: e.target.value })}
                          className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none ${
                            isStudent 
                            ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                            : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                          }`}
                          placeholder={isStudent ? "BITC/..." : "STF/..."}
                        />
                      </div>
                      <div className="group">
                        <label className={`block text-xs font-black uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>
                          {isStudent ? 'Course / Programme' : 'Department'}
                        </label>
                        {isStudent ? (
                          <>
                            <select
                              value={isCustomCourseSelected ? 'custom' : editForm.course}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'custom') {
                                  setIsCustomCourseSelected(true);
                                  const isExistingCustom = editForm.course && !SYSTEM_COURSES.includes(editForm.course);
                                  if (!isExistingCustom) {
                                    setEditForm({ ...editForm, course: '' });
                                  }
                                } else {
                                  setIsCustomCourseSelected(false);
                                  setEditForm({ ...editForm, course: val });
                                }
                              }}
                              className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none ${
                                isStudent 
                                ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                                : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                              }`}
                            >
                              <option value="" className="text-gray-900">Select Course</option>
                              {SYSTEM_COURSES.map((c, idx) => (
                                <option key={idx} value={c} className="text-gray-900">{c}</option>
                              ))}
                              <option value="custom" className="text-gray-900">✍️ Custom Course (Enter manually)</option>
                            </select>

                            {isCustomCourseSelected && (
                              <div className="mt-2 animate-fadeIn">
                                <input
                                  type="text"
                                  value={editForm.course}
                                  onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                                  placeholder="Type custom course name..."
                                  className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none uppercase ${
                                    isStudent 
                                    ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                                    : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                                  }`}
                                />
                              </div>
                            )}
                          </>
                        ) : (
                          <input
                            type="text"
                            value={editForm.course}
                            onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                            className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none ${
                              isStudent 
                              ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                              : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                            }`}
                            placeholder="e.g. Computer Science"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="group">
                        <label className={`block text-xs font-black uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>Gender</label>
                        <select
                          value={editForm.gender}
                          onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                          className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none appearance-none ${
                            isStudent 
                            ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                            : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                          }`}
                        >
                          <option value="">Select Gender</option>
                          <option value="male" className="bg-[#1A1F2E]">Male</option>
                          <option value="female" className="bg-[#1A1F2E]">Female</option>
                          <option value="other" className="bg-[#1A1F2E]">Other</option>
                        </select>
                      </div>
                      <div className="group">
                        <label className={`block text-xs font-black uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>Religion</label>
                        <input
                          type="text"
                          value={editForm.religion}
                          onChange={(e) => setEditForm({ ...editForm, religion: e.target.value })}
                          className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none ${
                            isStudent 
                            ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                            : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                          }`}
                          placeholder="e.g. Christian"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="group">
                        <label className={`block text-xs font-black uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>ID / Birth Cert Num</label>
                        <input
                          type="text"
                          value={editForm.idNumber}
                          onChange={(e) => setEditForm({ ...editForm, idNumber: e.target.value })}
                          className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none ${
                            isStudent 
                            ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                            : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                          }`}
                        />
                      </div>
                      <div className="group">
                        <label className={`block text-xs font-black uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>Nationality</label>
                        <input
                          type="text"
                          value={editForm.nationality}
                          onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })}
                          className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none ${
                            isStudent 
                            ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                            : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                          }`}
                        />
                      </div>
                    </div>

                    {!isStudent && (
                      <div className="group">
                        <label className={`block text-xs font-bold uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>Specialization</label>
                        <input
                          type="text"
                          value={editForm.specialization}
                          onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                          className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none ${
                            isStudent 
                            ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                            : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                          }`}
                          placeholder="e.g. Network Security, Web Dev"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="group">
                        <label className={`block text-xs font-black uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>
                          {isStudent ? 'Study Year' : 'Experience (Years)'}
                        </label>
                        {isStudent ? (
                          <select
                            value={editForm.year}
                            onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                            className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none appearance-none ${
                              isStudent 
                              ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                              : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                            }`}
                          >
                            {['1', '2', '3', '4'].map(y => (
                              <option key={y} value={y} className="bg-[#1A1F2E] text-white">Year {y}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="number"
                            value={editForm.year}
                            min="0"
                            onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                            className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none ${
                              isStudent 
                              ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                              : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                            }`}
                          />
                        )}
                      </div>
                      <div className="group">
                        <label className={`block text-xs font-bold uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>Residence</label>
                        <input
                          type="text"
                          value={editForm.residence}
                          onChange={(e) => setEditForm({ ...editForm, residence: e.target.value })}
                          className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none ${
                            isStudent 
                            ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                            : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                          }`}
                        />
                      </div>
                    </div>

                    {isStudent && (
                      <div className="group">
                        <label className={`block text-xs font-bold uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>
                          Date of Admission {!isAdmin && <span className="text-[10px] text-gray-500 font-normal lowercase italic">(admin only)</span>}
                        </label>
                        <input
                          type="date"
                          value={editForm.admissionDate}
                          onChange={(e) => setEditForm({ ...editForm, admissionDate: e.target.value })}
                          disabled={!isAdmin}
                          className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none ${
                            isStudent 
                            ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                            : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                          } ${!isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    )}

                    {isStudent && (
                      <div className="space-y-4 pt-4 border-t border-white/10">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400">Parent / Guardian Details</p>
                        <div className="grid grid-cols-2 gap-4">
                          <input
                            type="text"
                            placeholder="Father's Name"
                            value={editForm.fatherName}
                            onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm focus:border-blue-500 outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Father's Phone"
                            value={editForm.fatherPhone}
                            onChange={(e) => setEditForm({ ...editForm, fatherPhone: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm focus:border-blue-500 outline-none"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Father's Occupation"
                          value={editForm.fatherOccupation}
                          onChange={(e) => setEditForm({ ...editForm, fatherOccupation: e.target.value })}
                          className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm focus:border-blue-500 outline-none"
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <input
                            type="text"
                            placeholder="Mother's Name"
                            value={editForm.motherName}
                            onChange={(e) => setEditForm({ ...editForm, motherName: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm focus:border-blue-500 outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Mother's Phone"
                            value={editForm.motherPhone}
                            onChange={(e) => setEditForm({ ...editForm, motherPhone: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm focus:border-blue-500 outline-none"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Mother's Occupation"
                          value={editForm.motherOccupation}
                          onChange={(e) => setEditForm({ ...editForm, motherOccupation: e.target.value })}
                          className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm focus:border-blue-500 outline-none"
                        />
                        <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20 space-y-4">
                          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400">Emergency Contact</p>
                          <input
                            type="text"
                            placeholder="Emergency Contact Name"
                            value={editForm.emergencyContact}
                            onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm focus:border-blue-500 outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Emergency Contact Phone"
                            value={editForm.emergencyPhone}
                            onChange={(e) => setEditForm({ ...editForm, emergencyPhone: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 space-y-4">
                          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400">Guardian Contact</p>
                          <input
                            type="text"
                            placeholder="Guardian Name"
                            value={editForm.guardianName}
                            onChange={(e) => setEditForm({ ...editForm, guardianName: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm focus:border-amber-500 outline-none"
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <input
                              type="text"
                              placeholder="Guardian Phone"
                              value={editForm.guardianPhone}
                              onChange={(e) => setEditForm({ ...editForm, guardianPhone: e.target.value })}
                              className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm focus:border-amber-500 outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Guardian Relation"
                              value={editForm.guardianRelation}
                              onChange={(e) => setEditForm({ ...editForm, guardianRelation: e.target.value })}
                              className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm focus:border-amber-500 outline-none"
                            />
                          </div>
                          <input
                            type="email"
                            placeholder="Guardian Email"
                            value={editForm.guardianEmail}
                            onChange={(e) => setEditForm({ ...editForm, guardianEmail: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm focus:border-amber-500 outline-none"
                          />
                          <textarea
                            placeholder="Guardian Address"
                            value={editForm.guardianAddress}
                            onChange={(e) => setEditForm({ ...editForm, guardianAddress: e.target.value })}
                            rows={2}
                            className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-sm focus:border-amber-500 outline-none resize-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="group">
                      <label className={`block text-xs font-bold uppercase tracking-[0.2em] mb-2 ml-1 ${isStudent ? 'text-gray-400' : 'text-gray-500'}`}>Blood Group</label>
                      <select
                        value={editForm.bloodGroup}
                        onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
                        className={`w-full px-6 py-4 rounded-2xl border font-bold text-sm transition-all outline-none appearance-none ${
                          isStudent 
                          ? 'bg-white/10 border-white/20 text-white focus:border-blue-500 focus:bg-white/20' 
                          : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-blue-500 focus:bg-white shadow-sm'
                        }`}
                      >
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                          <option key={bg} value={bg} className="bg-[#1A1F2E] text-white">{bg}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-6 sticky bottom-0 bg-inherit z-10 py-4 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className={`flex-1 px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${
                        isStudent ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={18} />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast messages={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
};
