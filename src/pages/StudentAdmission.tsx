import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, addDoc, doc, setDoc, writeBatch, getDocs, where, updateDoc, deleteDoc } from 'firebase/firestore';
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
  ChevronDown,
  Info,
  Heart,
  Phone,
  Layout,
  File as FileIcon,
  Image as ImageIcon,
  X as XCircle,
  Inbox,
  Trash2,
  Sparkles,
  Check,
  Search,
  FileText,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toast, ToastMessage } from '../components/Toast';

const TABS = [
  { id: 'online-apps', name: 'ONLINE APPLICATIONS INBOX', icon: Inbox },
  { id: 'personal', name: 'DIRECT ADMISSION FORM', icon: UserIcon },
];

import { uploadFile } from '../services/uploadService';
import { getCourseAdmissionCode, formatAdmissionNumber, calculateNextAdmissionSerial, KNOWN_COURSES } from '../utils/admissionUtils';

const SYSTEM_COURSES = KNOWN_COURSES;

export const StudentAdmission: React.FC = () => {
  const { user, userData, hasPermission, settings } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [activeTab, setActiveTab] = useState('online-apps');
  const [classes, setClasses] = useState<Class[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [baseSerial, setBaseSerial] = useState(355);
  const [inboxExpanded, setInboxExpanded] = useState(true);
  const [lastAdmittedStudent, setLastAdmittedStudent] = useState<{
    name: string;
    course: string;
    phone: string;
    email: string;
    admissionNumber: string;
    admissionDate?: string;
    guardianName?: string;
    guardianPhone?: string;
    address?: string;
    intakePeriod?: string;
  } | null>(null);

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

  // Online Applications State
  const [onlineApplications, setOnlineApplications] = useState<any[]>([]);
  const [onlineSearch, setOnlineSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'processed' | 'archived'>('all');

  // Real-time listener for the 'admissions' Firestore collection
  useEffect(() => {
    const q = query(collection(db, 'admissions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Sort newest first
      apps.sort((a, b) => {
        const dateA = new Date(a.submittedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.submittedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      setOnlineApplications(apps);
    }, (error) => {
      console.error("Error watching admissions: ", error);
    });
    return () => unsubscribe();
  }, []);

  const handlePrintAdmissionLetter = (studentData: {
    name: string;
    course: string;
    phone: string;
    email: string;
    admissionNumber: string;
    admissionDate?: string;
    guardianName?: string;
    guardianPhone?: string;
    address?: string;
    intakePeriod?: string;
  }) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Popup blocker is preventing opening the print window. Please allow popups for active print-outs.");
      return;
    }

    const schoolName = settings?.schoolName || settings?.appTitle || 'Breakthrough International Training College';
    const schoolAddress = settings?.publicAddress || 'Main Highway, P.O. Box 1234-01000, Thika, Kenya';
    const schoolPhone = settings?.publicPhone || '+254 7XX XXX XXX';
    const schoolEmail = settings?.publicEmail || 'info@bitc.ac.ke';
    const today = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
    const logoHtml = settings?.logoUrl ? `<img src="${settings.logoUrl}" class="logo" alt="School Logo" />` : '';
    const stampHtml = settings?.stampUrl ? `<img src="${settings.stampUrl}" class="stamp" alt="Stamp" />` : '';
    const secureId = Math.random().toString(36).substring(2, 9).toUpperCase();

    const html = `
      <html>
        <head>
          <title>Admission Letter - ${studentData.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              line-height: 1.45; 
              color: #1a202c; 
              padding: 25px;
              max-width: 800px;
              margin: 0 auto;
              background: white;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px double #cbd5e1; 
              padding-bottom: 10px; 
              margin-bottom: 15px; 
            }
            .logo { max-height: 65px; margin-bottom: 6px; }
            .school-name { font-size: 20px; font-weight: 800; color: #1e3a8a; margin: 0; text-transform: uppercase; letter-spacing: 1.2px; }
            .school-info { font-size: 10px; color: #475569; margin: 2px 0; font-weight: 500; }
            
            .letter-meta { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 11px; }
            .date { font-weight: 700; color: #1e293b; }
            .ref-no { font-size: 10.5px; color: #64748b; font-family: monospace; }
            
            .recipient { margin-bottom: 15px; border-left: 3px solid #3b82f6; padding-left: 12px; background: #f8fafc; padding-top: 6px; padding-bottom: 6px; border-radius: 0 8px 8px 0; }
            .recipient p { margin: 2px 0; color: #1e293b; font-size: 12px; }
            .recipient-label { font-size: 9.5px; color: #64748b; font-weight: 700; letter-spacing: 0.5px; display: inline-block; width: 110px; }
            .recipient-value { font-weight: 700; }
            
            .subject { 
              font-weight: 800; 
              text-decoration: underline; 
              text-transform: uppercase; 
              margin-bottom: 15px;
              font-size: 13.5px;
              text-align: center;
              color: #1e3a8a;
            }
            
            .content { font-size: 12.5px; text-align: justify; }
            .content p { margin-bottom: 10px; }
            .requirements-list {
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-left: 4px solid #22c55e;
              padding: 10px 15px;
              margin: 12px 0;
              border-radius: 6px;
            }
            .requirements-title {
              font-weight: 800;
              color: #14532d;
              margin-bottom: 4px;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .requirements-list ul {
              margin: 0;
              padding-left: 18px;
            }
            .requirements-list li {
              margin-bottom: 3px;
              color: #166534;
              font-weight: 500;
            }
            
            .closing { margin-top: 20px; page-break-inside: avoid; }
            .signature-space { height: 80px; margin-top: 10px; position: relative; }
            .stamp { position: absolute; top: -25px; left: 120px; width: 4cm !important; height: 4cm !important; max-width: 4cm !important; max-height: 4cm !important; opacity: 0.95; mix-blend-mode: multiply; z-index: 1; }
            .signature-line { border-top: 1px solid #475569; width: 200px; margin-top: 5px; }
            .signatory-name { font-weight: 800; margin-top: 4px; font-size: 12px; color: #1e293b; }
            .signatory-title { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; }
            
            .footer { 
              margin-top: 20px; 
              font-size: 8.5px; 
              border-top: 1px solid #e2e8f0; 
              padding-top: 10px;
              text-align: center;
              color: #94a3b8;
              font-style: italic;
            }
 
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
              body { padding: 15px; margin: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .no-print { display: none; }
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
          <div class="header">
            ${logoHtml}
            <h1 class="school-name">${schoolName}</h1>
            <p class="school-info">${schoolAddress}</p>
            <p class="school-info">TEL: ${schoolPhone} | EMAIL: ${schoolEmail}</p>
          </div>
 
          <div class="letter-meta">
            <div class="date">DATE: ${studentData.admissionDate ? new Date(studentData.admissionDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : today}</div>
            <div class="ref-no">REF: BITC/ADM/${studentData.admissionNumber || 'REG-' + secureId}</div>
          </div>
 
          <div class="recipient">
            <p><span class="recipient-label">TO STUDENT:</span> <span class="recipient-value">${studentData.name.toUpperCase()}</span></p>
            <p><span class="recipient-label">ADMISSION NO:</span> <span class="recipient-value" style="color: #1e3a8a;">${studentData.admissionNumber}</span></p>
            <p><span class="recipient-label">EMAIL:</span> <span>${studentData.email || 'N/A'}</span></p>
            <p><span class="recipient-label">PHONE:</span> <span>${studentData.phone || 'N/A'}</span></p>
            <p><span class="recipient-label">COURSE OFFERED:</span> <span class="recipient-value">${studentData.course.toUpperCase()}</span></p>
            <p><span class="recipient-label">INTAKE PERIOD:</span> <span>${studentData.intakePeriod || 'September 2026 Intake'}</span></p>
          </div>
 
          <div class="subject">
            RE: OFFICIAL OFFER OF ADMISSION
          </div>
 
          <div class="content">
            <p>Dear ${studentData.name.split(' ')[0]},</p>
            
            <p>Following your application, we are pleased to inform you that you have been offered admission to Breakthrough International Training College (BITC) for the <strong>${studentData.course}</strong> program starting in our <strong>${studentData.intakePeriod || 'September 2026 Intake'}</strong>.</p>
            
            <p>Your official registration number is <strong>${studentData.admissionNumber}</strong>, which you should quote in all correspondence with the college administration.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
              <tr>
                <td style="width: 100%;">
                  <div class="requirements-list">
                    <div class="requirements-title">Official Reporting Checklist</div>
                    <ul>
                      <li>Original and copies of KCSE Result Slip/Certificate</li>
                      <li>National ID Card or Birth Certificate copy</li>
                      <li>Two recent passport-size color photographs</li>
                      <li>Fees deposit payment slip as specified in your syllabus package</li>
                    </ul>
                  </div>
                </td>
              </tr>
            </table>

            <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; padding: 12px; margin: 14px 0; border-radius: 8px;">
              <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Official Tuition & Fee Payment Account:</p>
              <p style="margin: 0; font-size: 11px; color: #334155; line-height: 1.45;">
                <strong>Bank Account Name:</strong> ${settings?.bankAccountName || 'BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE'}<br />
                <strong>Bank:</strong> ${settings?.bankName || 'Co-operative Bank of Kenya'} &bull; <strong>Branch:</strong> ${settings?.bankBranch || 'Thika Makongeni'}<br />
                <strong>Account Number:</strong> <span style="font-family: monospace; font-weight: 800; font-size: 12px; color: #0f172a;">${settings?.bankAccountNumber || '032000025240'}</span>
                ${settings?.bankPaybill ? `&bull; <strong>Paybill:</strong> ${settings.bankPaybill}` : ''}<br />
                <em style="color: #b91c1c; font-size: 10.5px;">${settings?.bankPaymentInstructions || 'Note: Quote your student Admission Number on all deposit slips. Cash payments on campus are strictly prohibited.'}</em>
              </p>
            </div>
            
            <p>Please report to the Registrar of Admissions desk to clear any pending fees, secure hostel rooms if applicable, and collect your timetable & orientation pack.</p>
            
            <p>Congratulations! We wish you a peaceful, successful, and inspiring course of study at our institution.</p>
          </div>
 
          <div class="closing">
            <p>Yours faithfully,</p>
            <div class="signature-space">
              ${stampHtml}
            </div>
            <div class="signature-line"></div>
            <div class="signatory-name">Admissions Registrar</div>
            <div class="signatory-title">Breakthrough International Training College</div>
          </div>
 
          <div class="footer">
            Breakthrough International Training College Registrar Portal. Generated securely on ${today}.
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Pre-fill student admission form from an online application
  const handleProcessApplication = (app: any) => {
    const fullName = app.fullName || app.applicantName || "";
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    setFormData(prev => ({
      ...prev,
      firstName,
      lastName,
      email: app.email || app.applicantEmail || "",
      phone: app.phone || app.applicantPhone || "",
      gender: app.gender || "Male",
      dateOfBirth: app.dateOfBirth || "",
      guardianName: app.guardianName || "",
      guardianPhone: app.guardianPhone || "",
      guardianEmail: app.email || app.applicantEmail || "",
      address: app.address || "Thika",
      course: app.courseInterest || "",
    }));

    addToast(`Pre-loaded details for ${fullName}! Choose classes and click Save Student.`, 'success');
    
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  // Change online application status
  const handleUpdateAppStatus = async (appId: string, status: 'pending_review' | 'processed' | 'archived') => {
    try {
      await updateDoc(doc(db, 'admissions', appId), { status });
      addToast(`Updated status to ${status.replace('_', ' ').toUpperCase()}`, 'success');
    } catch (err) {
      console.error("Error updating admission status:", err);
      addToast("Failed to update status", "error");
    }
  };

  // Delete online application
  const handleDeleteApplication = async (appId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this application?")) return;
    try {
      await deleteDoc(doc(db, 'admissions', appId));
      addToast("Application deleted successfully", "success");
    } catch (err) {
      console.error("Error deleting admission:", err);
      addToast("Failed to delete application", "error");
    }
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

  // Load highest base serial number from database or calculate dynamically
  useEffect(() => {
    const fetchBaseSerial = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        let existingList: Array<{ admissionNumber?: string; course?: string }> = [];
        usersSnap.docs.forEach(doc => {
          existingList.push(doc.data());
        });
        const serial = calculateNextAdmissionSerial(existingList, formData.course);
        setBaseSerial(serial);
      } catch (error) {
        console.error("Error fetching students for base serial:", error);
      }
    };
    fetchBaseSerial();
  }, [formData.course]);

  // Reactively calculate course-based automated admission number: BITC/course/serial/academicYear
  useEffect(() => {
    const yr = formData.academicYear || '2026';
    const formattedId = formatAdmissionNumber(formData.course, baseSerial, yr);
    
    setFormData(prev => ({
      ...prev,
      admissionNumber: formattedId
    }));
  }, [baseSerial, formData.course, formData.academicYear]);

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

      // Update the base serial internally so the next student is assigned the next incremental number
      setBaseSerial(prev => prev + 1);

      const admittedStudentDetails = {
        name: fullName,
        course: formData.course || 'Selected Course',
        phone: formData.phone || '',
        email: formData.email || '',
        admissionNumber: formData.admissionNumber,
        admissionDate: formData.admissionDate,
        guardianName: formData.guardianName || '',
        guardianPhone: formData.guardianPhone || '',
        address: formData.address || 'Thika',
        intakePeriod: formData.academicYear ? `${formData.academicYear} Intake` : '2026 Intake'
      };
      setLastAdmittedStudent(admittedStudentDetails);

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
        <div className="flex items-center gap-3 font-sans">
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
            className="flex items-center gap-2 bg-[#7c3aed] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-purple-100 hover:bg-[#6d28d9] transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <FileDown size={16} />
            {loading ? 'IMPORTING...' : 'IMPORT STUDENT'}
          </button>
          <button 
            type="submit" 
            form="admission-form"
            disabled={loading || isUploading}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-blue-105 hover:bg-blue-700 transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save size={16} />
            {isUploading ? 'UPLOADING...' : loading ? 'SAVING...' : 'SAVE STUDENT'}
          </button>
        </div>
      </div>

      {/* 1. ONLINE APPLICATIONS INBOX SECTION */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <button
          type="button"
          onClick={() => setInboxExpanded(!inboxExpanded)}
          className="w-full flex items-center justify-between p-6 bg-gray-50/50 hover:bg-gray-100/70 transition-all border-b border-gray-100 cursor-pointer text-left font-sans select-none"
        >
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 p-2.5 rounded-2xl text-blue-600">
              <Inbox size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-950 uppercase tracking-tight flex items-center gap-2 leading-none">
                Online Applications Inbox
                {onlineApplications.filter(app => app.status !== 'processed' && app.status !== 'archived').length > 0 && (
                  <span className="px-2 py-0.5 text-[9px] font-black bg-rose-500 text-white rounded-full animate-pulse tracking-normal">
                    {onlineApplications.filter(app => app.status !== 'processed' && app.status !== 'archived').length} NEW
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400 font-bold tracking-wider uppercase mt-1">Review and process internet-submitted applications</p>
            </div>
          </div>
          <div className="text-gray-400 font-bold text-xs uppercase flex items-center gap-2">
            <span>{inboxExpanded ? 'Hide Inbox' : 'Show Inbox'}</span>
            <ChevronDown size={14} className={`transition-transform duration-300 ${inboxExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        <AnimatePresence initial={false}>
          {inboxExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-6 border-t border-gray-50 space-y-6">
              {/* Filter controls panel */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {(['all', 'pending_review', 'processed', 'archived'] as const).map((filter) => {
                    const count = filter === 'all' 
                      ? onlineApplications.length
                      : onlineApplications.filter(app => app.status === filter).length;
                    return (
                      <button
                        type="button"
                        key={filter}
                        onClick={() => setStatusFilter(filter)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                          statusFilter === filter
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-150'
                        }`}
                      >
                        {filter.replace('_', ' ')} ({count})
                      </button>
                    );
                  })}
                </div>
                
                {/* Search Inbox */}
                <div className="relative w-full md:w-80 font-heading">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search applicants..."
                    value={onlineSearch}
                    onChange={(e) => setOnlineSearch(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl pl-11 pr-4 py-2.5 text-xs font-bold text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-blue-100 transition-all font-sans"
                  />
                </div>
              </div>

              {/* Grid representation */}
              {(() => {
                const filtered = onlineApplications.filter(app => {
                  const matchStatus = statusFilter === 'all' || app.status === statusFilter;
                  const searchLower = onlineSearch.toLowerCase();
                  const matchSearch = 
                    (app.fullName || app.applicantName || '').toLowerCase().includes(searchLower) ||
                    (app.email || app.applicantEmail || '').toLowerCase().includes(searchLower) ||
                    (app.phone || app.applicantPhone || '').toLowerCase().includes(searchLower) ||
                    (app.courseInterest || '').toLowerCase().includes(searchLower);
                  return matchStatus && matchSearch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="bg-white p-12 rounded-[2rem] shadow-sm border border-gray-100 text-center space-y-4">
                      <Inbox size={48} className="mx-auto text-gray-300 animate-bounce" />
                      <h3 className="text-lg font-bold text-gray-900 uppercase">No Online Applications</h3>
                      <p className="text-gray-500 text-sm font-medium max-w-sm mx-auto">
                        No online admission submissions match your filters right now. Direct applications from the public web portal will automatically persist here.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map((app) => {
                      const isApply = app.formCategory === 'apply';
                      return (
                        <div 
                          key={app.id} 
                          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5"
                        >
                          {/* Upper Card Header */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                isApply 
                                  ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                                  : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                              }`}>
                                {isApply ? 'Online Admission' : 'Inquiry Lead'}
                              </span>

                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                                app.status === 'processed' 
                                  ? 'bg-green-100 text-green-700' 
                                  : app.status === 'archived'
                                  ? 'bg-gray-100 text-gray-650'
                                  : 'bg-amber-100 text-amber-700 animate-pulse'
                              }`}>
                                {app.status === 'processed' ? 'Processed' : app.status === 'archived' ? 'Archived' : 'New Intake'}
                              </span>
                            </div>

                            <div>
                              <h3 className="text-base font-extrabold text-gray-900 tracking-tight font-heading">
                                {app.fullName || app.applicantName || 'Unnamed Applicant'}
                              </h3>
                              {app.courseInterest && (
                                <p className="text-xs text-blue-600 font-bold mt-1 uppercase flex items-center gap-1 font-sans">
                                  <Sparkles size={11} className="text-blue-500 animate-pulse" />
                                  {app.courseInterest}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Data Details List */}
                          <div className="space-y-2 border-t border-b border-gray-50 py-3 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-400 font-medium font-sans">Phone:</span>
                              <span className="font-bold text-gray-800 font-mono">{app.phone || app.applicantPhone || 'None'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400 font-medium font-sans">Email:</span>
                              <span className="font-bold text-gray-800 truncate max-w-[150px]">{app.email || app.applicantEmail || 'None'}</span>
                            </div>
                            {app.dateOfBirth && (
                              <div className="flex justify-between">
                                <span className="text-gray-400 font-medium font-sans">Birth Date:</span>
                                <span className="font-bold text-gray-800">{app.dateOfBirth} ({app.gender || 'M'})</span>
                              </div>
                            )}
                            {app.prevSchool && (
                              <div className="flex flex-col gap-0.5 pt-1">
                                <span className="text-gray-400 font-medium block font-sans">Previous School:</span>
                                <span className="font-bold text-gray-800 italic">{app.prevSchool}</span>
                              </div>
                            )}
                            {app.guardianName && (
                              <div className="bg-gray-50 p-2.5 rounded-xl text-[11px] mt-1 space-y-0.5">
                                <span className="text-gray-400 font-bold block uppercase text-[8px] tracking-wider font-sans">Parent/Guardian Info:</span>
                                <p className="font-extrabold text-gray-850">{app.guardianName}</p>
                                <p className="text-gray-500 font-mono text-[10px]">{app.guardianPhone}</p>
                              </div>
                            )}
                            {app.message && (
                              <div className="mt-2 text-gray-600 border-l-2 border-slate-200 pl-2 italic">
                                "{app.message}"
                              </div>
                            )}
                            {app.intakePeriod && (
                              <div className="flex justify-between text-[11px] font-sans pb-1">
                                <span className="text-slate-400">Intake Period:</span>
                                <span className="font-bold text-emerald-600">{app.intakePeriod}</span>
                              </div>
                            )}
                            <div className="text-[9px] text-gray-400 font-mono pt-1 text-right">
                              Recd: {new Date(app.submittedAt || app.createdAt || '').toLocaleString()}
                            </div>
                          </div>

                          {/* Action Buttons for Card */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleProcessApplication(app)}
                              className="flex-1 py-1 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm transition-all border-0 h-9"
                            >
                              <Check size={13} />
                              <span>Admit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handlePrintAdmissionLetter({
                                name: app.fullName || app.applicantName || 'Applicant Name',
                                course: app.courseInterest || 'Selected Program',
                                phone: app.phone || app.applicantPhone || '',
                                email: app.email || app.applicantEmail || '',
                                admissionNumber: app.admissionNumber || `APP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                                intakePeriod: app.intakePeriod || 'September 2026 Intake'
                              })}
                              className="py-1 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm transition-all border border-slate-200 h-9 shrink-0"
                              title="Print Provisional Admission Letter"
                            >
                              <Printer size={13} />
                              <span>Letter</span>
                            </button>

                            {app.status !== 'processed' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateAppStatus(app.id, 'processed')}
                                title="Mark Processed"
                                className="p-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 border border-green-100 transition-colors h-9 w-9 flex items-center justify-center"
                              >
                                <Check size={14} />
                              </button>
                            )}

                            {app.status !== 'archived' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateAppStatus(app.id, 'archived')}
                                title="Archive Application"
                                className="p-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-100 transition-colors h-9 w-9 flex items-center justify-center"
                              >
                                <Inbox size={14} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteApplication(app.id)}
                              title="Delete Record"
                              className="p-2 rounded-xl bg-red-50 hover:bg-red-105 text-red-650 border border-red-100 transition-colors h-9 w-9 flex items-center justify-center"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. DIRECT ADMISSION FORM SECTION */}
      <div className="flex items-center gap-4 pt-10">
        <div className="bg-[#7c3aed]/10 p-3 rounded-2xl text-[#7c3aed]">
          <UserIcon size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-[#7c3aed] uppercase tracking-tight">Direct Manual Student Admission</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Enroll a new student directly into the academic registry</p>
        </div>
      </div>

      <form id="admission-form" ref={formRef} onSubmit={handleSubmit} className="space-y-8 font-sans">
        <div className="space-y-8">
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
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Course <span className="text-red-500">*</span></label>
                      <select 
                        name="course"
                        value={formData.course || ''}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 transition-all uppercase"
                      >
                        <option value="">Select Course</option>
                        {SYSTEM_COURSES.map((c, idx) => (
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

              {/* Parents & Guardian Information Section Header */}
              <div className="flex items-center gap-3 pt-8 pb-2 border-t border-gray-150">
                <div className="bg-amber-55 p-2.5 rounded-2xl text-amber-600 bg-amber-50">
                  <Users size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900 uppercase tracking-tight">Parents & Guardian Info</h2>
                  <p className="text-xs text-gray-400 font-bold tracking-wider uppercase">Contact-details and emergency info</p>
                </div>
              </div>

              <div className="space-y-8">
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

              {/* Document Info Section Header */}
              <div className="flex items-center gap-3 pt-8 pb-2 border-t border-gray-150">
                <div className="bg-purple-50 p-2.5 rounded-2xl text-purple-600 bg-purple-50">
                  <Upload size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900 uppercase tracking-tight">Required Documents</h2>
                  <p className="text-xs text-gray-400 font-bold tracking-wider uppercase">Attach identification documents and certificates</p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
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

              {/* Bottom Actions inside form */}
              <div className="flex justify-end gap-4 pt-8">
                <button 
                  type="submit" 
                  disabled={loading || isUploading}
                  className="flex items-center gap-2 bg-[#7c3aed] text-white px-8 py-4 rounded-xl font-black text-sm shadow-lg shadow-purple-150 hover:bg-[#6d28d9] transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 uppercase tracking-widest cursor-pointer font-sans"
                >
                  <Save size={18} />
                  {isUploading ? 'UPLOADING...' : loading ? 'SAVING...' : 'SAVE & ADMIT STUDENT'}
                </button>
              </div>

              </div>
              </div>
            </div>
          </form>
      
      {/* Admission Success & Print Letter Overlay Modal */}
      {lastAdmittedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 text-left"
          >
            <div className="bg-gradient-to-br from-blue-700 to-indigo-950 p-8 text-white relative">
              <button 
                type="button" 
                onClick={() => setLastAdmittedStudent(null)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white border-0 transition-colors"
                title="Dismiss"
              >
                <XCircle size={18} />
              </button>
              <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-white text-2xl mb-4 animate-bounce">
                🎉
              </div>
              <h3 className="text-xl font-extrabold tracking-tight uppercase">Manual Admission Complete!</h3>
              <p className="text-blue-100 text-xs mt-1">
                The student has been successfully saved to the breakthrough records.
              </p>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs text-slate-700">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Admission ID:</span>
                  <span className="font-mono font-black text-blue-800 bg-blue-50/50 px-2.5 py-1 rounded text-xs select-all">
                    {lastAdmittedStudent.admissionNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Student Name:</span>
                  <span className="font-black text-slate-900 text-right">{lastAdmittedStudent.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Academic Course:</span>
                  <span className="font-extrabold text-slate-800 text-right max-w-[200px] truncate" title={lastAdmittedStudent.course}>
                    {lastAdmittedStudent.course}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Mobile Contact:</span>
                  <span className="font-bold text-slate-800">{lastAdmittedStudent.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Email Address:</span>
                  <span className="font-semibold text-slate-500 max-w-[180px] truncate" title={lastAdmittedStudent.email}>
                    {lastAdmittedStudent.email || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => handlePrintAdmissionLetter(lastAdmittedStudent)}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-md transition-all border-0 font-sans"
                >
                  <Printer size={15} />
                  <span>Print Admission Letter</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLastAdmittedStudent(null)}
                  className="py-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest border-0 font-sans"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
};
