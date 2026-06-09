import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, addDoc, doc, setDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import Papa from 'papaparse';
import { Class, User } from '../types';
import { 
  User as UserIcon, 
  Users, 
  BookOpen, 
  Calendar, 
  Upload, 
  Save, 
  FileDown, 
  Camera,
  ChevronRight,
  Info,
  Heart,
  Phone,
  Layout,
  File as FileIcon,
  Image as ImageIcon,
  X as XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toast, ToastMessage } from '../components/Toast';

const TABS = [
  { id: 'personal', name: 'PERSONAL INFO', icon: UserIcon },
  { id: 'parents', name: 'PARENTS & GUARDIAN INFO', icon: Users },
  { id: 'document', name: 'DOCUMENT INFO', icon: Upload },
  { id: 'previous', name: 'PREVIOUS SCHOOL INFORMATION', icon: BookOpen },
  { id: 'other', name: 'OTHER INFO', icon: Info },
  { id: 'custom', name: 'CUSTOM FIELD', icon: Layout },
];

import { uploadFile } from '../services/uploadService';

export const StudentAdmission: React.FC = () => {
  const { user, userData, hasPermission } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [classes, setClasses] = useState<Class[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    gender: '',
    dateOfBirth: '',
    religion: '',
    caste: '',
    admissionNumber: '',
    admissionDate: new Date().toISOString().split('T')[0],
    academicYear: '2026',
    classIds: [] as string[],
    course: '',
    roll: '',
    group: '',
    phone: '',
    bloodGroup: '',
    category: '',
    idNumber: '',
    nationality: 'Kenyan',
    emergencyContact: '',
    emergencyPhone: '',
    fatherName: '',
    fatherPhone: '',
    fatherOccupation: '',
    motherName: '',
    motherPhone: '',
    motherOccupation: '',
    guardianName: '',
    guardianRelation: '',
    guardianPhone: '',
    guardianOccupation: '',
    guardianAddress: '',
    guardianEmail: '',
    address: '',
  });

  const addToast = (text: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

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

  useEffect(() => {
    const fetchAdmissionNumber = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        let maxNum = 341;
        usersSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.admissionNumber) {
            const num = parseInt(data.admissionNumber || '');
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        });
        setFormData(prev => ({ 
          ...prev, 
          admissionNumber: prev.admissionNumber || (maxNum + 1).toString() 
        }));
      } catch (error) {
        console.error("Error fetching students for admission number:", error);
      }
    };
    fetchAdmissionNumber();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const [studentPhoto, setStudentPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<{ name: string, file: File }[]>([]);
  
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addToast("Photo must be less than 5MB", "error");
        return;
      }
      setStudentPhoto(file);
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
    }
  };

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newDocs = Array.from(files).map(file => ({ name: file.name, file }));
      setDocuments(prev => [...prev, ...newDocs]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email || formData.classIds.length === 0) {
      addToast("Please fill in all required fields", "error");
      return;
    }

    setLoading(true);
    setIsUploading(true);

    try {
      // Validate unique email first before starting uploads/admitting to prevent duplication
      const emailQuery = query(collection(db, 'users'), where('email', '==', formData.email.trim().toLowerCase()));
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) {
        addToast(`A user with the email address "${formData.email.trim()}" is already registered.`, "error");
        setLoading(false);
        setIsUploading(false);
        return;
      }

      let photoUrl = '';
      if (studentPhoto) {
        const photoUpload = await uploadFile(studentPhoto);
        photoUrl = photoUpload.url;
      }

      const uploadedDocs: { name: string, url: string, type: string, uploadedAt: string }[] = [];
      for (const doc of documents) {
        const docUpload = await uploadFile(doc.file);
        uploadedDocs.push({
          name: doc.name,
          url: docUpload.url,
          type: doc.file.type,
          uploadedAt: new Date().toISOString()
        });
      }

      const admissionRef = collection(db, 'users');
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
      
      const trimmedFormData = Object.entries(formData).reduce((acc, [key, value]) => {
        if (typeof value === 'string') {
          acc[key] = value.trim();
        } else {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      await addDoc(admissionRef, {
        ...trimmedFormData,
        name: fullName,
        role: 'student',
        photoUrl,
        documents: uploadedDocs,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      addToast("Student admitted successfully!", "success");
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        gender: '',
        dateOfBirth: '',
        religion: '',
        caste: '',
        admissionNumber: '',
        admissionDate: new Date().toISOString().split('T')[0],
        academicYear: '2026',
        classIds: [],
        course: '',
        roll: '',
        group: '',
        phone: '',
        bloodGroup: '',
        category: '',
        idNumber: '',
        nationality: 'Kenyan',
        emergencyContact: '',
        emergencyPhone: '',
        fatherName: '',
        fatherPhone: '',
        fatherOccupation: '',
        motherName: '',
        motherPhone: '',
        motherOccupation: '',
        guardianName: '',
        guardianRelation: '',
        guardianPhone: '',
        guardianOccupation: '',
        guardianAddress: '',
        guardianEmail: '',
        address: '',
      });
      setStudentPhoto(null);
      setPhotoPreview(null);
      setDocuments([]);
      setActiveTab('personal');
    } catch (error) {
      console.error("Admission error:", error);
      handleFirestoreError(error, OperationType.CREATE, 'users');
      addToast("Failed to admit student. Check attachments or network.", "error");
    } finally {
      setLoading(false);
      setIsUploading(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const batch = writeBatch(db);
          const studentsCollection = collection(db, 'users');
          let successCount = 0;
          let failCount = 0;

          // Get latest admission number and existing emails to continue sequence and prevent user duplication
          const usersSnapshot = await getDocs(query(collection(db, 'users')));
          let maxAdm = 341;
          const existingEmails = new Set<string>();
          usersSnapshot.docs.forEach(d => {
            const data = d.data();
            const adm = parseInt(data.admissionNumber);
            if (!isNaN(adm) && adm > maxAdm) maxAdm = adm;
            if (data.email) {
              existingEmails.add(data.email.toLowerCase().trim());
            }
          });

          for (const rawRow of results.data as any[]) {
            // Trim all string values in the row
            const row: any = {};
            Object.keys(rawRow).forEach(key => {
              row[key] = typeof rawRow[key] === 'string' ? rawRow[key].trim() : rawRow[key];
            });

            // Basic validation and duplicate prevention
            if (!row.firstName || !row.lastName || !row.email) {
              failCount++;
              continue;
            }

            const rowEmail = row.email.toLowerCase().trim();
            if (existingEmails.has(rowEmail)) {
              failCount++;
              continue;
            }
            existingEmails.add(rowEmail);

            // Resolve Class IDs if Class Names are provided
            let classIds: string[] = [];
            if (row.classIds) {
              const ids = row.classIds.split(',').map((id: string) => id.trim());
              classIds = ids;
            } else if (row.classNames) {
              const names = row.classNames.split(',').map((n: string) => n.trim().toLowerCase());
              classIds = classes
                .filter(c => names.includes(c.name.toLowerCase()))
                .map(c => c.id);
            } else if (row.classId) {
              classIds = [row.classId];
            } else if (row.className) {
              const matchedClass = classes.find(c => c.name.toLowerCase() === row.className.toLowerCase());
              if (matchedClass) classIds = [matchedClass.id];
            }

            const admissionNumber = row.admissionNumber || (++maxAdm).toString();
            const fullName = `${row.firstName} ${row.lastName}`;

            const newDocRef = doc(studentsCollection);
            batch.set(newDocRef, {
              ...row,
              name: fullName,
              role: 'student',
              admissionNumber,
              classIds,
              createdAt: new Date().toISOString(),
              admissionDate: row.admissionDate || new Date().toISOString().split('T')[0],
              academicYear: row.academicYear || '2026'
            });
            successCount++;
          }

          await batch.commit();
          addToast(`Successfully imported ${successCount} students!${failCount > 0 ? ` (${failCount} failed)` : ''}`, "success");
        } catch (error) {
          console.error("Import error:", error);
          addToast("Failed to import students. Check file format.", "error");
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error("CSV Parsing error:", error);
        addToast("Error parsing CSV file", "error");
        setLoading(false);
      }
    });
  };

  const selectedClasses = classes.filter(c => formData.classIds.includes(c.id));
  const availableUnits = Array.from(new Set(selectedClasses.flatMap(c => c.unitIds || []))).sort();

  const isAdmin = userData?.role === 'admin' || hasPermission('student_admission');

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center text-red-600 max-w-lg mx-auto mt-12 font-medium">
        Access Denied. Only system administrators can admit or register new students.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header section as per screenshot */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <nav className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2">
            <span>Dashboard</span>
            <ChevronRight size={12} />
            <span>Student Info</span>
            <ChevronRight size={12} />
            <span className="text-blue-600">Student Admission</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Student Admission</h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="hidden"
          />
          <button 
            type="button"
            onClick={handleImportClick}
            disabled={loading}
            className="flex items-center gap-2 bg-[#7c3aed] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-purple-200 hover:bg-[#6d28d9] transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
          >
            <FileDown size={18} />
            {loading ? 'IMPORTING...' : 'IMPORT STUDENT'}
          </button>
          <button 
            type="submit" 
            form="admission-form"
            disabled={loading || isUploading}
            className="flex items-center gap-2 bg-[#7c3aed] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-purple-200 hover:bg-[#6d28d9] transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
          >
            <Save size={18} />
            {isUploading ? 'UPLOADING...' : loading ? 'SAVING...' : 'SAVE STUDENT'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-100 shadow-sm'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <tab.icon size={16} />
            {tab.name}
          </button>
        ))}
      </div>

      <form id="admission-form" onSubmit={handleSubmit} className="space-y-8">
        <AnimatePresence mode="wait">
          {activeTab === 'personal' && (
            <motion.div
              key="personal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Academic Information Section */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-50 mb-4">
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <BookOpen className="text-blue-600 w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Academic Information</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Academic Year <span className="text-red-500">*</span></label>
                      <select 
                        name="academicYear"
                        value={formData.academicYear || '2026'}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 transition-all uppercase"
                      >
                        <option value="2026">2026 [Jan-Dec]</option>
                        <option value="2027">2027 [Jan-Dec]</option>
                      </select>
                    </div>
                    <div className="space-y-4 sm:col-span-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Classes (Select multiple) <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {classes.map((c, idx) => (
                          <label 
                            key={`${c.id || 'c'}_${idx}`} 
                            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                              formData.classIds.includes(c.id)
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-gray-50 border-transparent text-gray-600 hover:border-gray-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={formData.classIds.includes(c.id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setFormData(prev => ({
                                  ...prev,
                                  classIds: checked 
                                    ? [...prev.classIds, c.id]
                                    : prev.classIds.filter(id => id !== c.id)
                                }));
                              }}
                            />
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              formData.classIds.includes(c.id)
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-gray-300'
                            }`}>
                              {formData.classIds.includes(c.id) && <Save size={10} />}
                            </div>
                            <span className="text-xs font-bold leading-none">{c.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Unit</label>
                      <select 
                        name="course"
                        value={formData.course || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 transition-all uppercase"
                      >
                        <option value="">Select Unit</option>
                        {availableUnits.map((c, idx) => (
                          <option key={idx} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Admission Number <span className="text-red-500">*</span></label>
                      <input 
                        type="text"
                        name="admissionNumber"
                        value={formData.admissionNumber || ''}
                        onChange={handleChange}
                        required
                        placeholder="e.g. 343"
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-300 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Admission Date <span className="text-red-500">*</span></label>
                      <input 
                        type="date"
                        name="admissionDate"
                        value={formData.admissionDate || ''}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Roll</label>
                      <input 
                        type="text"
                        name="roll"
                        value={formData.roll || ''}
                        onChange={handleChange}
                        placeholder="Roll Number"
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-300 focus:ring-4 focus:ring-blue-100 transition-all"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Group</label>
                      <select 
                        name="group"
                        value={formData.group || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 transition-all uppercase"
                      >
                        <option value="">Select Group</option>
                        <option value="science">Science</option>
                        <option value="arts">Arts</option>
                        <option value="commerce">Commerce</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Personal Info Section */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-50 mb-4">
                    <div className="bg-emerald-50 p-2 rounded-lg">
                      <UserIcon className="text-emerald-600 w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Personal Info</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">First Name <span className="text-red-500">*</span></label>
                      <input 
                        name="firstName"
                        value={formData.firstName || ''}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-emerald-100 transition-all placeholder:text-gray-300"
                        placeholder="First Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Last Name <span className="text-red-500">*</span></label>
                      <input 
                        name="lastName"
                        value={formData.lastName || ''}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-emerald-100 transition-all placeholder:text-gray-300"
                        placeholder="Last Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Gender <span className="text-red-500">*</span></label>
                      <select 
                        name="gender"
                        value={formData.gender || ''}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-emerald-100 transition-all"
                      >
                        <option value="">Gender *</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Date of Birth <span className="text-red-500">*</span></label>
                      <input 
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth || ''}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-emerald-100 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Religion</label>
                      <select 
                        name="religion"
                        value={formData.religion || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-emerald-100 transition-all"
                      >
                        <option value="">Religion</option>
                        <option value="christian">Christianity</option>
                        <option value="islam">Islam</option>
                        <option value="hindu">Hinduism</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Caste</label>
                      <input 
                        name="caste"
                        value={formData.caste || ''}
                        onChange={handleChange}
                        placeholder="Caste"
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-emerald-100 transition-all placeholder:text-gray-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">ID / Birth Cert Number</label>
                      <input 
                        name="idNumber"
                        value={formData.idNumber || ''}
                        onChange={handleChange}
                        placeholder="ID or Birth Certificate Number"
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-emerald-100 transition-all placeholder:text-gray-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Nationality</label>
                      <input 
                        name="nationality"
                        value={formData.nationality || ''}
                        onChange={handleChange}
                        placeholder="e.g. Kenyan"
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-emerald-100 transition-all placeholder:text-gray-300"
                      />
                    </div>
                    <div className="space-y-4 sm:col-span-2">
                      <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="w-16 h-16 bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 shrink-0 overflow-hidden">
                          {photoPreview ? (
                            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <Camera size={20} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Student Photo</p>
                          <label className="inline-flex items-center gap-2 bg-[#7c3aed] text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#6d28d9] transition-all cursor-pointer">
                            <Camera size={12} />
                            {studentPhoto ? studentPhoto.name : 'Browse'}
                            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoSelect} />
                          </label>
                          {studentPhoto && (
                            <button 
                              type="button" 
                              onClick={() => { setStudentPhoto(null); setPhotoPreview(null); }}
                              className="ml-2 text-xs font-bold text-red-500"
                            >
                              REMOVE
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Information Section */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-50 mb-4">
                    <div className="bg-orange-50 p-2 rounded-lg">
                      <Phone className="text-orange-600 w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Contact Information</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Email Address</label>
                      <input 
                        type="email"
                        name="email"
                        value={formData.email || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-orange-100 transition-all placeholder:text-gray-300"
                        placeholder="Email Address"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Phone Number <span className="text-red-500">*</span></label>
                      <input 
                        type="tel"
                        name="phone"
                        value={formData.phone || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-orange-100 transition-all placeholder:text-gray-300"
                        placeholder="Phone Number *"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Emergency Contact Name</label>
                      <input 
                        name="emergencyContact"
                        value={formData.emergencyContact || ''}
                        onChange={handleChange}
                        placeholder="Emergency Contact Name"
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-orange-100 transition-all placeholder:text-gray-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Emergency Contact Phone</label>
                      <input 
                        name="emergencyPhone"
                        value={formData.emergencyPhone || ''}
                        onChange={handleChange}
                        placeholder="Emergency Contact Phone"
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-orange-100 transition-all placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Medical Record Section */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-50 mb-4">
                    <div className="bg-red-50 p-2 rounded-lg">
                      <Heart className="text-red-600 w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Medical Record</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Blood Group</label>
                      <select 
                        name="bloodGroup"
                        value={formData.bloodGroup || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-red-100 transition-all"
                      >
                        <option value="">Blood Group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Category</label>
                      <select 
                        name="category"
                        value={formData.category || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-red-100 transition-all"
                      >
                        <option value="">Category</option>
                        <option value="general">General</option>
                        <option value="obc">OBC</option>
                        <option value="sc/st">SC/ST</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          
          {activeTab === 'parents' && (
            <motion.div
              key="parents"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Father Information */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-50 mb-4">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                      <UserIcon size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Father Info</h2>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Father's Name</label>
                      <input 
                        name="fatherName"
                        value={formData.fatherName || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-gray-300"
                        placeholder="Father's Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Father's Phone</label>
                      <input 
                        name="fatherPhone"
                        value={formData.fatherPhone || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-gray-300"
                        placeholder="Father's Phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Father's Occupation</label>
                      <input 
                        name="fatherOccupation"
                        value={formData.fatherOccupation || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-gray-300"
                        placeholder="Father's Occupation"
                      />
                    </div>
                  </div>
                </div>

                {/* Mother Information */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-50 mb-4">
                    <div className="bg-pink-50 p-2 rounded-lg text-pink-600">
                      <UserIcon size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Mother Info</h2>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Mother's Name</label>
                      <input 
                        name="motherName"
                        value={formData.motherName || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-pink-100 transition-all placeholder:text-gray-300"
                        placeholder="Mother's Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Mother's Phone</label>
                      <input 
                        name="motherPhone"
                        value={formData.motherPhone || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-pink-100 transition-all placeholder:text-gray-300"
                        placeholder="Mother's Phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Mother's Occupation</label>
                      <input 
                        name="motherOccupation"
                        value={formData.motherOccupation || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-pink-100 transition-all placeholder:text-gray-300"
                        placeholder="Mother's Occupation"
                      />
                    </div>
                  </div>
                </div>

                {/* Guardian Information */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-50 mb-4">
                    <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
                      <Users size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Guardian Info</h2>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Guardian's Name</label>
                      <input 
                        name="guardianName"
                        value={formData.guardianName || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-amber-100 transition-all placeholder:text-gray-300"
                        placeholder="Guardian's Name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Relation</label>
                        <input 
                          name="guardianRelation"
                          value={formData.guardianRelation || ''}
                          onChange={handleChange}
                          className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-amber-100 transition-all placeholder:text-gray-300"
                          placeholder="e.g. Uncle"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Email</label>
                        <input 
                          name="guardianEmail"
                          type="email"
                          value={formData.guardianEmail || ''}
                          onChange={handleChange}
                          className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-amber-100 transition-all placeholder:text-gray-300"
                          placeholder="Email"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Phone Number</label>
                      <input 
                        name="guardianPhone"
                        value={formData.guardianPhone || ''}
                        onChange={handleChange}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-amber-100 transition-all placeholder:text-gray-300"
                        placeholder="Guardian Phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Address</label>
                      <textarea 
                        name="guardianAddress"
                        value={formData.guardianAddress || ''}
                        onChange={handleChange}
                        rows={2}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-amber-100 transition-all placeholder:text-gray-300 resize-none"
                        placeholder="Guardian Address"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'document' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-50 mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-50 p-2 rounded-lg">
                    <Upload className="text-purple-600 w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Document Info</h2>
                </div>
                <label className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-all">
                  Add Documents
                  <input type="file" className="hidden" multiple onChange={handleDocumentSelect} />
                </label>
              </div>

              <div className="space-y-4">
                {documents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 bg-white rounded-lg text-gray-400">
                            {doc.file.type.includes('image') ? <ImageIcon size={20} /> : <FileIcon size={20} />}
                          </div>
                          <span className="text-sm font-bold text-gray-900 truncate">{doc.name}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setDocuments(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <XCircle size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <Upload className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-gray-500 font-bold">No documents attached yet.</p>
                    <p className="text-sm text-gray-400 font-medium">Upload IDs, Birth Certificates, or other documents.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab !== 'personal' && activeTab !== 'parents' && activeTab !== 'document' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white p-12 rounded-[2rem] shadow-xl shadow-blue-900/5 border border-gray-100 text-center"
            >
              <Layout size={48} className="mx-auto text-blue-600 mb-6" />
              <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-tight mb-2">Section Under Development</h2>
              <p className="text-gray-500 font-medium max-w-sm mx-auto">This section is coming soon. Please complete the Personal Info to admit the student.</p>
              <button 
                type="button"
                onClick={() => setActiveTab('personal')}
                className="mt-8 text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline"
              >
                Go back to Personal Info
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
};
