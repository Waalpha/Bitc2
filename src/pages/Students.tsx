import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, query, where, doc, updateDoc, addDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { User, Class, AppNotification } from '../types';
import { Search, GraduationCap, Mail, Calendar, BookOpen, Settings2, X, Printer, Send, Paperclip, Loader2, MessageSquare, Clock, User2, Phone, MapPin, ShieldCheck, Briefcase, HeartPulse, Info, Eye, Check, Save, RefreshCw, AlertTriangle, FileText, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toast, ToastMessage } from '../components/Toast';

export const Students: React.FC = () => {
  const { user, userData, hasPermission, settings } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [viewingStudent, setViewingStudent] = useState<User | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [messagingStudents, setMessagingStudents] = useState<User[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [messageForm, setMessageForm] = useState({
    title: '',
    message: '',
    file: null as File | null
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toggleStudentSelection = (uid: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(uid)) {
      next.delete(uid);
    } else {
      next.add(uid);
    }
    setSelectedStudentIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map(s => s.uid)));
    }
  };

  const openBulkMessage = () => {
    const selected = students.filter(s => selectedStudentIds.has(s.uid));
    if (selected.length > 0) {
      setMessagingStudents(selected);
    }
  };

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
  const canManageStudents = isTeacher || isAdmin;

  const handlePrintTerminationLetter = (student: User) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const schoolName = settings?.schoolName || settings?.appTitle || 'Breakthrough International Training College';
    const schoolAddress = settings?.publicAddress || 'P.O. Box 1234-01000, Thika, Kenya';
    const schoolPhone = settings?.publicPhone || '+254 7XX XXX XXX';
    const schoolEmail = settings?.publicEmail || 'info@bitc.ac.ke';
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Professional default text
    const defaultMisconduct = "Gross misconduct and persistent violation of the Institution's Code of Conduct and Student Handbook. This includes but is not limited to significant breaches of disciplinary protocols that have compromised the learning environment and safety of the institutional community.";
    
    const html = `
      <html>
        <head>
          <title>Termination Letter - ${student.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              line-height: 1.5; 
              color: #1a202c; 
              padding: 30px 40px;
              max-width: 850px;
              margin: 0 auto;
              background: white;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px double #e2e8f0; 
              padding-bottom: 10px; 
              margin-bottom: 20px; 
            }
            .logo { max-height: 70px; margin-bottom: 10px; }
            .school-name { font-size: 24px; font-weight: 800; color: #1a365d; margin: 0; text-transform: uppercase; letter-spacing: 1.2px; }
            .school-info { font-size: 12px; color: #4a5568; margin: 2px 0; font-weight: 500; }
            
            .letter-meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .date { font-weight: 700; color: #2d3748; font-size: 13px; }
            .ref-no { font-size: 11px; color: #718096; }
            
            .recipient { margin-bottom: 20px; border-left: 2px solid #e2e8f0; padding-left: 15px; }
            .recipient p { margin: 2px 0; color: #2d3748; text-transform: uppercase; font-size: 13px; }
            .recipient-label { font-size: 10px; color: #718096; font-weight: 700; letter-spacing: 0.5px; }
            
            .subject { 
              font-weight: 800; 
              text-decoration: underline; 
              text-transform: uppercase; 
              margin-bottom: 20px;
              font-size: 16px;
              text-align: center;
              color: #2d3748;
            }
            
            .content p { margin-bottom: 15px; text-align: justify; font-size: 14px; }
            .misconduct-box { 
              background: #fdf2f2; 
              border: 1px solid #feb2b2;
              border-left: 4px solid #f56565; 
              padding: 15px 20px; 
              margin: 15px 0; 
              font-style: normal;
              font-weight: 500;
              color: #9b2c2c;
              border-radius: 4px;
              font-size: 14px;
            }
            
            .closing { margin-top: 30px; page-break-inside: avoid; }
            .signature-space { height: 70px; margin-top: 15px; position: relative; }
            .stamp { position: absolute; top: -15px; left: 15px; max-height: 90px; opacity: 0.85; mix-blend-mode: multiply; }
            .signature-line { border-top: 1px solid #1a202c; width: 250px; margin-top: 10px; }
            .signatory-name { font-weight: 800; margin-top: 5px; font-size: 14px; }
            .signatory-title { font-size: 12px; color: #4a5568; font-weight: 600; text-transform: uppercase; }
            
            .footer { 
              margin-top: 40px; 
              font-size: 9px; 
              border-top: 1px solid #edf2f7; 
              padding-top: 10px;
              text-align: center;
              color: #a0aec0;
              font-style: italic;
            }

            @media print {
              body { padding: 30px 40px; margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${settings?.logoUrl ? `<img src="${settings.logoUrl}" class="logo" alt="School Logo" />` : ''}
            <h1 class="school-name">${schoolName}</h1>
            <p class="school-info">${schoolAddress}</p>
            <p class="school-info">TEL: ${schoolPhone} | EMAIL: ${schoolEmail}</p>
          </div>

          <div class="letter-meta">
            <div class="date">DATE: ${today}</div>
            <div class="ref-no">REF: BITC/REG/DISC/${new Date().getFullYear()}/${student.admissionNumber || 'ADM'}</div>
          </div>

          <div class="recipient">
            <p><span class="recipient-label">TO:</span> ${student.name.toUpperCase()}</p>
            <p><span class="recipient-label">ADM NO:</span> ${student.admissionNumber || 'N/A'}</p>
            <p><span class="recipient-label">COURSE:</span> ${student.course || 'N/A'}</p>
          </div>

          <div class="subject">
            FORMAL NOTICE OF TERMINATION OF STUDENTSHIP
          </div>

          <div class="content">
            <p>Dear ${student.name.split(' ')[0]},</p>
            
            <p>
              This is to formally notify you that the Management Board of <strong>${schoolName}</strong> has reached a definitive 
              and final decision to terminate your studentship with the institution, effective immediately as of 
              <strong>${today}</strong>.
            </p>

            <p>
              This administrative action has been taken following a thorough review of your conduct, which has been found to be 
              in manifest violation of the Institutional Code of Conduct. The specific grounds for this termination are 
              identified as:
            </p>
            
            <div class="misconduct-box">
              "${defaultMisconduct}"
            </div>

            <p>
              Your actions represent a fundamental breach of the contract between <strong>${schoolName}</strong> and yourself. 
              The Institution maintains a strict policy on discipline to ensure an environment conducive to academic 
              excellence and personal growth for all students. Your continued association with the institution has been deemed 
              untenable.
            </p>

            <p>
              Consequently, you are hereby directed to:
            </p>
            <ol style="margin-bottom: 15px; font-size: 14px;">
              <li>Surrender your Student Identification Card and any other institutional property to the Registrar's Office.</li>
              <li>Clear any outstanding administrative requirements with the Finance Department.</li>
              <li>Vacate the institution's premises with immediate effect.</li>
            </ol>

            <p>
              Please be advised that you are no longer authorized to access the campus or represent yourself as a student of 
              this college. Any unauthorized entry onto the premises will be treated as trespass.
            </p>

            <p>We wish you the best in your future endeavors as you seek alternate paths for your development.</p>
          </div>

          <div class="closing">
            <p>Yours Faithfully,</p>
            <div class="signature-space">
              ${settings?.stampUrl ? `<img src="${settings.stampUrl}" class="stamp" />` : ''}
            </div>
            <div class="signature-line"></div>
            <div class="signatory-name">OFFICE OF THE REGISTRAR</div>
            <div class="signatory-title">${schoolName}</div>
          </div>

          <div class="footer">
            THIS IS AN OFFICIAL ELECTRONICALLY GENERATED COMMUNICATION OF ${schoolName}. NO ALTERATIONS PERMITTED.
          </div>

          <script>
            window.onload = function() { 
              window.print(); 
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintWarningLetter = (student: User) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const schoolName = settings?.schoolName || settings?.appTitle || 'Breakthrough International Training College';
    const schoolAddress = settings?.publicAddress || 'P.O. Box 1234-01000, Thika, Kenya';
    const schoolPhone = settings?.publicPhone || '+254 7XX XXX XXX';
    const schoolEmail = settings?.publicEmail || 'info@bitc.ac.ke';
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const defaultIssue = "Frequent absenteeism, lack of engagement in academic activities, and minor breaches of the institutional code of conduct. This behavior is inconsistent with the standards expected of a student at this institution.";
    
    const html = `
      <html>
        <head>
          <title>Warning Letter - ${student.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              line-height: 1.4; 
              color: #1a202c; 
              padding: 20px 40px;
              max-width: 850px;
              margin: 0 auto;
              background: white;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px double #e2e8f0; 
              padding-bottom: 8px; 
              margin-bottom: 15px; 
            }
            .logo { max-height: 60px; margin-bottom: 8px; }
            .school-name { font-size: 22px; font-weight: 800; color: #1a365d; margin: 0; text-transform: uppercase; letter-spacing: 1.2px; }
            .school-info { font-size: 11px; color: #4a5568; margin: 2px 0; font-weight: 500; }
            
            .letter-meta { display: flex; justify-content: space-between; margin-bottom: 15px; }
            .date { font-weight: 700; color: #2d3748; font-size: 12px; }
            .ref-no { font-size: 10px; color: #718096; }
            
            .recipient { margin-bottom: 15px; border-left: 2px solid #e2e8f0; padding-left: 15px; }
            .recipient p { margin: 2px 0; color: #2d3748; text-transform: uppercase; font-size: 12px; }
            .recipient-label { font-size: 9px; color: #718096; font-weight: 700; letter-spacing: 0.5px; }
            
            .subject { 
              font-weight: 800; 
              text-decoration: underline; 
              text-transform: uppercase; 
              margin-bottom: 15px;
              font-size: 14px;
              text-align: center;
              color: #2d3748;
            }
            
            .content p { margin-bottom: 10px; text-align: justify; font-size: 13.5px; }
            .warning-box { 
              background: #fffbef; 
              border: 1px solid #fbd38d;
              border-left: 4px solid #ed8936; 
              padding: 12px 18px; 
              margin: 12px 0; 
              color: #744210;
              border-radius: 4px;
              font-size: 13px;
              font-weight: 500;
            }
            
            .closing { margin-top: 25px; page-break-inside: avoid; }
            .signature-space { height: 60px; margin-top: 10px; position: relative; }
            .stamp { position: absolute; top: -10px; left: 10px; max-height: 80px; opacity: 0.85; mix-blend-mode: multiply; }
            .signature-line { border-top: 1px solid #1a202c; width: 220px; margin-top: 8px; }
            .signatory-name { font-weight: 800; margin-top: 5px; font-size: 13px; }
            .signatory-title { font-size: 11px; color: #4a5568; font-weight: 600; text-transform: uppercase; }
            
            .footer { 
              margin-top: 30px; 
              font-size: 8px; 
              border-top: 1px solid #edf2f7; 
              padding-top: 8px;
              text-align: center;
              color: #a0aec0;
              font-style: italic;
            }

            @media print {
              body { padding: 20px 40px; margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${settings?.logoUrl ? `<img src="${settings.logoUrl}" class="logo" alt="School Logo" />` : ''}
            <h1 class="school-name">${schoolName}</h1>
            <p class="school-info">${schoolAddress}</p>
            <p class="school-info">TEL: ${schoolPhone} | EMAIL: ${schoolEmail}</p>
          </div>

          <div class="letter-meta">
            <div class="date">DATE: ${today}</div>
            <div class="ref-no">REF: BITC/REG/WARN/${new Date().getFullYear()}/${student.admissionNumber || 'ADM'}</div>
          </div>

          <div class="recipient">
            <p><span class="recipient-label">TO:</span> ${student.name.toUpperCase()}</p>
            <p><span class="recipient-label">ADM NO:</span> ${student.admissionNumber || 'N/A'}</p>
            <p><span class="recipient-label">COURSE:</span> ${student.course || 'N/A'}</p>
          </div>

          <div class="subject">
            FIRST OFFICIAL WARNING REGARDING CONDUCT AND ACADEMICS
          </div>

          <div class="content">
            <p>Dear ${student.name.split(' ')[0]},</p>
            
            <p>
              This is to formally caution you regarding your recent conduct and academic performance at <strong>${schoolName}</strong>. 
              Our records and reports from various departments indicate areas of concern that require your immediate attention.
            </p>

            <p>The specific grounds for this warning include:</p>
            
            <div class="warning-box">
              "${defaultIssue}"
            </div>

            <p>
              We wish to remind you that by enrolling in this institution, you committed to upholding high standards of discipline 
              and academic excellence. Your current trajectory is inconsistent with these commitments and the Institutional 
              Code of Conduct.
            </p>

            <p>
              By virtue of this letter, you are hereby advised to:
            </p>
            <ol style="margin-bottom: 15px; font-size: 14px;">
              <li>Show immediate and sustained improvement in your conduct and attendance.</li>
              <li>Seek guidance from the Dean of Students or your Academic Advisor if you are facing challenges.</li>
              <li>Familiarize yourself once again with the Student Handbook.</li>
            </ol>

            <p>
              Please be advised that this is your first official warning. Should there be no significant improvement or further 
              breaches of regulations, the institution will be compelled to take more severe disciplinary measures, which 
              may include suspension or termination of studentship.
            </p>

            <p>We believe in your potential and hope that this notice serves as a constructive call to realign yourself with 
            the values of BITC.</p>
          </div>

          <div class="closing">
            <p>Yours Faithfully,</p>
            <div class="signature-space">
              ${settings?.stampUrl ? `<img src="${settings.stampUrl}" class="stamp" />` : ''}
            </div>
            <div class="signature-line"></div>
            <div class="signatory-name">OFFICE OF THE REGISTRAR</div>
            <div class="signatory-title">${schoolName}</div>
          </div>

          <div class="footer">
            THIS IS AN OFFICIAL ELECTRONICALLY GENERATED COMMUNICATION OF ${schoolName}. NO ALTERATIONS PERMITTED.
          </div>

          <script>
            window.onload = function() { 
              window.print(); 
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const className = selectedClassId === 'all' 
      ? 'All Students' 
      : selectedClassId === '' 
        ? 'Students with No Class' 
        : classes.find(c => c.id === selectedClassId)?.name || 'Student List';

    const html = `
      <html>
        <head>
          <title>${className}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1 { color: #333; }
            .header { display: flex; justify-content: mb-20px; align-items: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .footer { margin-top: 20px; font-size: 10px; color: #666; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            ${settings?.logoUrl ? `<img src="${settings.logoUrl}" alt="School Logo" style="max-height: 50px; width: auto; margin-right: 20px;" />` : ''}
            <h1>BITC - ${className}</h1>
          </div>
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Adm No.</th>
                <th>Name</th>
                <th>Email</th>
                <th>Class(es)</th>
                <th>Subject</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStudents.map((s, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${s.admissionNumber || 'N/A'}</td>
                  <td>${s.name}</td>
                  <td>${s.email}</td>
                  <td>${getClassNames(s.classIds)}</td>
                  <td>${s.course || 'N/A'}</td>
                  <td>${new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            Printed on ${new Date().toLocaleString()}
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

  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all students
      const studentsQ = query(collection(db, 'users'), where('role', '==', 'student'));
      const studentSnap = await getDocs(studentsQ);
      setStudents(studentSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));

      // Fetch all classes for filtering
      const classesQ = query(collection(db, 'classes'));
      const classSnap = await getDocs(classesQ);
      setClasses(classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const filteredStudents = students.filter(student => {
    const searchLow = searchTerm.toLowerCase();
    const admNum = student.admissionNumber ? String(student.admissionNumber).toLowerCase() : '';
    
    const matchesSearch = 
      student.name.toLowerCase().includes(searchLow) ||
      student.email.toLowerCase().includes(searchLow) ||
      admNum.includes(searchLow);
      
    const matchesClass = selectedClassId === 'all' || (student.classIds && student.classIds.includes(selectedClassId));
    return matchesSearch && matchesClass;
  });

  const getClassNames = (classIds?: string[]) => {
    if (!classIds || classIds.length === 0) return 'Not Assigned';
    return classIds.map(id => {
      const cls = classes.find(c => c.id === id);
      return cls ? cls.name : 'Unknown';
    }).join(', ');
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      addToast("Permission denied: Only admin can edit student information", "error");
      return;
    }
    if (!editingStudent) return;

    try {
      await updateDoc(doc(db, 'users', editingStudent.uid), {
        name: editingStudent.name,
        disabled: editingStudent.disabled || false,
        admissionNumber: editingStudent.admissionNumber || '',
        classIds: editingStudent.classIds || [],
        phone: editingStudent.phone || '',
        idNumber: editingStudent.idNumber || '',
        gender: editingStudent.gender || '',
        dateOfBirth: editingStudent.dateOfBirth || '',
        nationality: editingStudent.nationality || '',
        religion: editingStudent.religion || '',
        bloodGroup: editingStudent.bloodGroup || '',
        admissionDate: editingStudent.admissionDate || '',
        emergencyContact: editingStudent.emergencyContact || '',
        emergencyPhone: editingStudent.emergencyPhone || '',
        residence: editingStudent.residence || '',
        fatherName: editingStudent.fatherName || '',
        fatherPhone: editingStudent.fatherPhone || '',
        motherName: editingStudent.motherName || '',
        motherPhone: editingStudent.motherPhone || '',
        guardianName: editingStudent.guardianName || '',
        guardianPhone: editingStudent.guardianPhone || '',
        year: editingStudent.year || '1',
        course: editingStudent.course || '',
        earlyCheckoutAllowed: editingStudent.earlyCheckoutAllowed || false
      });
      setEditingStudent(null);
      addToast("Student profile updated successfully!");
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${editingStudent.uid}`);
      addToast("Failed to update student", "error");
    }
  };

  const handleUpdateClasses = async (studentUid: string, classIds: string[]) => {
    if (!isAdmin) {
      addToast("Permission denied: Only admin can assign student classes", "error");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', studentUid), {
        classIds: classIds || []
      });
      addToast("Student classes updated successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${studentUid}`);
      addToast("Failed to update student classes", "error");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (messagingStudents.length === 0 || !user || !messageForm.title || !messageForm.message) return;

    setIsSending(true);

    try {
      let attachmentUrl = '';
      let attachmentName = '';
      let attachmentType: any = undefined;

      if (messageForm.file) {
        console.log(">>> [Students] Starting file upload for message...");
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
        formData.append('file', messageForm.file);

        if (cloudinaryConfig) {
          formData.append('api_key', cloudinaryConfig.api_key);
          formData.append('timestamp', cloudinaryConfig.timestamp.toString());
          formData.append('signature', cloudinaryConfig.signature);
          formData.append('folder', cloudinaryConfig.folder);

          const xhr = new XMLHttpRequest();
          const uploadPromise = new Promise<{ secure_url: string }>((resolve, reject) => {
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
        attachmentName = messageForm.file.name;
        attachmentType = messageForm.file.type.startsWith('image/') ? 'image' : 
                         messageForm.file.type === 'application/pdf' ? 'pdf' : 
                         (messageForm.file.type.includes('msword') || messageForm.file.type.includes('officedocument')) ? 'word' : 'file';
      }

      const batch = writeBatch(db);
      console.log(`Preparing batch for ${messagingStudents.length} notifications...`);
      
      messagingStudents.forEach(student => {
        const notifRef = doc(collection(db, 'notifications'));
        const notification: any = {
          userId: student.uid,
          senderId: user.uid,
          title: messageForm.title,
          message: messageForm.message,
          type: messagingStudents.length > 1 ? 'broadcast' : 'announcement',
          read: false,
          createdAt: new Date().toISOString()
        };

        if (attachmentUrl) notification.attachmentUrl = attachmentUrl;
        if (attachmentName) notification.attachmentName = attachmentName;
        if (attachmentType) notification.attachmentType = attachmentType;

        batch.set(notifRef, notification);
      });

      await batch.commit();
      addToast(`Message sent to ${messagingStudents.length} students!`);
      setMessagingStudents([]);
      setSelectedStudentIds(new Set());
      setMessageForm({ title: '', message: '', file: null });
    } catch (error) {
      console.error("Error sending message:", error);
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
      addToast("Failed to send message", "error");
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Student Directory</h1>
          <p className="text-text-secondary">View and search all students in the system</p>
        </div>
      </div>

      <div className="bg-bg-card p-4 rounded-xl shadow-xl border border-white/5 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-slate-900"
          />
        </div>
        <div className="w-full md:w-64">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary font-medium text-slate-900"
          >
            <option value="all">All Classes</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
            <option value="">No Class Assigned</option>
          </select>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {selectedStudentIds.size > 0 && (
            <button
              onClick={openBulkMessage}
              className="flex items-center gap-2 bg-success text-white px-4 py-2 rounded-lg hover:bg-success-hover transition-colors shadow-lg shadow-success/20 font-bold flex-1 md:flex-none justify-center"
            >
              <Send size={18} />
              Message ({selectedStudentIds.size})
            </button>
          )}
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 bg-white/5 text-text-primary px-4 py-2 rounded-lg hover:bg-white/10 transition-colors border border-white/10 font-bold flex-1 md:flex-none justify-center"
          >
            {selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0 ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-white/5 text-text-primary px-4 py-2 rounded-lg hover:bg-white/10 transition-colors border border-white/10 font-bold flex-1 md:flex-none justify-center disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 font-bold flex-1 md:flex-none justify-center"
          >
            <Printer size={18} />
            Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.map((student, idx) => (
          <motion.div
            key={`${student.uid || 'student'}_${idx}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`
              relative bg-white p-6 rounded-2xl shadow-sm border transition-all
              ${selectedStudentIds.has(student.uid) ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-gray-200 hover:shadow-md'}
            `}
          >
            <div 
              className="absolute top-4 left-4 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selectedStudentIds.has(student.uid)}
                onChange={() => toggleStudentSelection(student.uid)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>

            <div className="flex items-start gap-4 pl-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-lg font-bold relative">
                {student.name.charAt(0)}
                {/* Online Status Dot */}
                {(() => {
                  const lastActive = student.lastActive ? new Date(student.lastActive).getTime() : 0;
                  const isOnline = Date.now() - lastActive < 300000; // 5 minutes threshold
                  return (
                    <div 
                      className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`}
                      title={isOnline ? 'Online' : student.lastActive ? `Last seen: ${new Date(student.lastActive).toLocaleString()}` : 'Offline'}
                    />
                  );
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-gray-900 truncate">{student.name}</h3>
                  {student.admissionNumber && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase whitespace-nowrap">
                      {student.admissionNumber}
                    </span>
                  )}
                  {student.disabled && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-extrabold uppercase whitespace-nowrap">
                      🔴 Deactivated
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Mail size={16} />
                    <span className="truncate">{student.email}</span>
                  </div>
                  {student.lastActive && (
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                      <Clock size={12} />
                      <span>Active {new Date(student.lastActive).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <BookOpen size={16} />
                    <span className="truncate" title={getClassNames(student.classIds)}>{getClassNames(student.classIds)}</span>
                  </div>
                  {student.course && (
                    <div className="flex items-center gap-2 text-sm font-bold text-blue-600">
                      <GraduationCap size={16} />
                      <span className="truncate">{student.course}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar size={16} />
                    <span>Joined {new Date(student.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              {canManageStudents && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setViewingStudent(student)}
                    className="text-gray-400 hover:text-emerald-600 transition-colors"
                    title="View Full Profile"
                  >
                    <Eye size={20} />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setEditingStudent(student)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Manage Student"
                    >
                      <Settings2 size={20} />
                    </button>
                  )}
                  <button
                    onClick={() => setMessagingStudents([student])}
                    className="text-gray-400 hover:text-emerald-600 transition-colors"
                    title="Send Message"
                  >
                    <MessageSquare size={20} />
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => handlePrintWarningLetter(student)}
                        className="text-gray-400 hover:text-amber-600 transition-colors"
                        title="Generate Warning Letter"
                      >
                        <AlertCircle size={20} />
                      </button>
                      <button
                        onClick={() => handlePrintTerminationLetter(student)}
                        className="text-gray-400 hover:text-rose-600 transition-colors"
                        title="Generate Termination Letter"
                      >
                        <FileText size={20} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {viewingStudent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setViewingStudent(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-200">
                    {viewingStudent.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{viewingStudent.name}</h2>
                    <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">{viewingStudent.admissionNumber || 'No Admission Number'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingStudent(null)} 
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <User2 size={14} className="text-blue-500" />
                        Personal Information
                      </h3>
                      <div className="grid grid-cols-2 gap-6 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Gender</p>
                          <p className="font-bold text-gray-900 capitalize">{viewingStudent.gender || 'Not Set'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nationality</p>
                          <p className="font-bold text-gray-900">{viewingStudent.nationality || 'Kenyan'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Religion</p>
                          <p className="font-bold text-gray-900">{viewingStudent.religion || 'Not Set'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ID / Birth Cert</p>
                          <p className="font-bold text-gray-900">{viewingStudent.idNumber || 'Not Set'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Date of Birth</p>
                          <p className="font-bold text-gray-900">{viewingStudent.dateOfBirth || 'Not Set'}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <MapPin size={14} className="text-emerald-500" />
                        Contact & Location
                      </h3>
                      <div className="space-y-4 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Email Address</p>
                          <p className="font-bold text-gray-900">{viewingStudent.email}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Phone Number</p>
                          <p className="font-bold text-gray-900">{viewingStudent.phone || 'Not Set'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Residence / Area</p>
                          <p className="font-bold text-gray-900">{viewingStudent.residence || 'Not Set'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <GraduationCap size={14} className="text-purple-500" />
                        Academic Details
                      </h3>
                      <div className="grid grid-cols-2 gap-6 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Assigned Classes</p>
                          <p className="font-bold text-gray-900">{getClassNames(viewingStudent.classIds)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Course / Program</p>
                          <p className="font-bold text-blue-600">{viewingStudent.course || 'Not Set'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Study Year</p>
                          <p className="font-bold text-gray-900">Year {viewingStudent.year || '1'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Admission Date</p>
                          <p className="font-bold text-gray-900">{viewingStudent.admissionDate || new Date(viewingStudent.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <HeartPulse size={14} className="text-rose-500" />
                        Family & Emergency
                      </h3>
                      <div className="space-y-4 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Father's Name</p>
                            <p className="font-bold text-gray-900">{viewingStudent.fatherName || 'Not Set'}</p>
                            {viewingStudent.fatherPhone && <p className="text-xs text-blue-500 font-bold mt-0.5">{viewingStudent.fatherPhone}</p>}
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Mother's Name</p>
                            <p className="font-bold text-gray-900">{viewingStudent.motherName || 'Not Set'}</p>
                            {viewingStudent.motherPhone && <p className="text-xs text-blue-500 font-bold mt-0.5">{viewingStudent.motherPhone}</p>}
                          </div>
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">Emergency Contact</p>
                          <p className="font-black text-gray-900">{viewingStudent.emergencyContact || viewingStudent.guardianName || 'Not Set'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Phone size={12} className="text-gray-400" />
                            <p className="text-sm font-bold text-blue-600">{viewingStudent.emergencyPhone || viewingStudent.guardianPhone || 'Not Set'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                <button 
                  onClick={() => setViewingStudent(null)}
                  className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Close
                </button>
                {isAdmin && (
                  <button 
                    onClick={() => {
                      setEditingStudent(viewingStudent);
                      setViewingStudent(null);
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 flex items-center gap-2"
                  >
                    <Settings2 size={18} />
                    Manage Student
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {messagingStudents.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => !isSending && setMessagingStudents([])}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
              
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                    <Send size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Send Message</h2>
                    <p className="text-xs text-gray-500">
                      To: {messagingStudents.length === 1 ? messagingStudents[0].name : `${messagingStudents.length} Students`}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => !isSending && setMessagingStudents([])} 
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  disabled={isSending}
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSendMessage} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Subject / Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Assignment Reminder, Fee Query..."
                    value={messageForm.title || ''}
                    onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })}
                    className="w-full px-5 py-3 bg-white border border-gray-300 rounded-2xl text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Message Content</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Write your message here..."
                    value={messageForm.message || ''}
                    onChange={(e) => setMessageForm({ ...messageForm, message: e.target.value })}
                    className="w-full px-5 py-3 bg-white border border-gray-300 rounded-2xl text-sm font-medium text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none placeholder:text-gray-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Attachment (Optional)</label>
                  <div className="relative group">
                    <input
                      type="file"
                      id="message-attachment"
                      className="hidden"
                      onChange={(e) => setMessageForm({ ...messageForm, file: e.target.files?.[0] || null })}
                    />
                    <label 
                      htmlFor="message-attachment"
                      className={`
                        flex items-center justify-between px-5 py-4 bg-gray-50 border border-dashed rounded-2xl cursor-pointer transition-all
                        ${messageForm.file ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/10'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <Paperclip size={20} className={messageForm.file ? 'text-emerald-600' : 'text-gray-400'} />
                        <span className={`text-sm font-bold ${messageForm.file ? 'text-emerald-700 truncate max-w-[200px]' : 'text-gray-500'}`}>
                          {messageForm.file ? messageForm.file.name : 'Choose file...'}
                        </span>
                      </div>
                      {messageForm.file && (
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setMessageForm({ ...messageForm, file: null });
                          }}
                          className="text-emerald-600 hover:text-emerald-800"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </label>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 ml-1 italic">PDFs, Images, and Word docs supported</p>
                </div>

                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                >
                  {isSending ? (
                    <>
                      <Loader2 size={24} className="animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      <span>Send to {messagingStudents.length === 1 ? messagingStudents[0].name.split(' ')[0] : `${messagingStudents.length} Students`}</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {editingStudent && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setEditingStudent(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold">
                    {editingStudent.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Edit Student Profile</h2>
                    <p className="text-xs text-gray-500">Updating recorded information for {editingStudent.name}</p>
                  </div>
                </div>
                <button onClick={() => setEditingStudent(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <form id="edit-student-form" onSubmit={handleUpdateStudent} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4 lg:col-span-3">
                      <h3 className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
                        <User2 size={14} />
                        Basic Information
                      </h3>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                      <input
                         type="text"
                         required
                         value={editingStudent.name}
                         onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                         className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:bg-white focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Admission Number</label>
                      <input
                        type="text"
                        value={editingStudent.admissionNumber || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, admissionNumber: e.target.value })}
                        placeholder="e.g. 342"
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:bg-white focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Course / Program</label>
                      <input
                        type="text"
                        value={editingStudent.course || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, course: e.target.value })}
                        placeholder="e.g. Computer Science"
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:bg-white focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Account Status</label>
                      <select
                        value={editingStudent.disabled ? 'disabled' : 'active'}
                        onChange={(e) => setEditingStudent({ ...editingStudent, disabled: e.target.value === 'disabled' })}
                        className={`w-full px-5 py-3 border rounded-2xl focus:ring-4 outline-none transition-all text-sm font-bold ${
                          editingStudent.disabled
                            ? 'bg-rose-50 border-rose-200 text-rose-700 focus:ring-rose-100 focus:border-rose-500'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-emerald-100 focus:border-emerald-500'
                        }`}
                      >
                        <option value="active">🟢 Active Student</option>
                        <option value="disabled">🔴 Disabled / Deactivated</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Early Check-Out Permission</label>
                      <select
                        value={editingStudent.earlyCheckoutAllowed ? 'allowed' : 'restricted'}
                        onChange={(e) => setEditingStudent({ ...editingStudent, earlyCheckoutAllowed: e.target.value === 'allowed' })}
                        className={`w-full px-5 py-3 border rounded-2xl focus:ring-4 outline-none transition-all text-sm font-bold ${
                          editingStudent.earlyCheckoutAllowed
                            ? 'bg-purple-50 border-purple-200 text-purple-700 focus:ring-purple-100 focus:border-purple-500'
                            : 'bg-amber-50 border-amber-200 text-amber-700 focus:ring-amber-100 focus:border-amber-500'
                        }`}
                      >
                        <option value="restricted">🚫 Locked (Pre-4PM restricted)</option>
                        <option value="allowed">✅ Allowed (Can early checkout)</option>
                      </select>
                    </div>

                    {/* Personal Details */}
                    <div className="space-y-4 lg:col-span-3 pt-4">
                      <h3 className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-2">
                        <ShieldCheck size={14} />
                        Identity & Personal Details
                      </h3>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">ID / Birth Cert Number</label>
                      <input
                        type="text"
                        value={editingStudent.idNumber || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, idNumber: e.target.value })}
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:bg-white focus:border-emerald-500 outline-none transition-all text-sm font-bold text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Gender</label>
                      <select
                        value={editingStudent.gender || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, gender: e.target.value })}
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:bg-white focus:border-emerald-500 outline-none transition-all text-sm font-bold text-gray-900 appearance-none"
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Date of Birth</label>
                      <input
                        type="date"
                        value={editingStudent.dateOfBirth || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, dateOfBirth: e.target.value })}
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:bg-white focus:border-emerald-500 outline-none transition-all text-sm font-bold text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Nationality</label>
                      <input
                        type="text"
                        value={editingStudent.nationality || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, nationality: e.target.value })}
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:bg-white focus:border-emerald-500 outline-none transition-all text-sm font-bold text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Religion</label>
                      <input
                        type="text"
                        value={editingStudent.religion || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, religion: e.target.value })}
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:bg-white focus:border-emerald-500 outline-none transition-all text-sm font-bold text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Blood Group</label>
                      <select
                        value={editingStudent.bloodGroup || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, bloodGroup: e.target.value })}
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:bg-white focus:border-emerald-500 outline-none transition-all text-sm font-bold text-gray-900 appearance-none"
                      >
                        <option value="">Unknown</option>
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

                    {/* Contact & Family */}
                    <div className="space-y-4 lg:col-span-3 pt-4">
                      <h3 className="text-xs font-black text-orange-600 uppercase tracking-[0.2em] flex items-center gap-2">
                        <HeartPulse size={14} />
                        Family & Emergency Contact
                      </h3>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Emergency Contact Name</label>
                      <input
                        type="text"
                        value={editingStudent.emergencyContact || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, emergencyContact: e.target.value })}
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-orange-100 focus:bg-white focus:border-orange-500 outline-none transition-all text-sm font-bold text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Emergency Phone</label>
                      <input
                        type="text"
                        value={editingStudent.emergencyPhone || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, emergencyPhone: e.target.value })}
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-orange-100 focus:bg-white focus:border-orange-500 outline-none transition-all text-sm font-bold text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Father's Name</label>
                      <input
                        type="text"
                        value={editingStudent.fatherName || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, fatherName: e.target.value })}
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-orange-100 focus:bg-white focus:border-orange-500 outline-none transition-all text-sm font-bold text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Mother's Name</label>
                      <input
                        type="text"
                        value={editingStudent.motherName || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, motherName: e.target.value })}
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-orange-100 focus:bg-white focus:border-orange-500 outline-none transition-all text-sm font-bold text-gray-900"
                      />
                    </div>

                    {/* Class Selection */}
                    <div className="space-y-4 lg:col-span-3 pt-4">
                      <h3 className="text-xs font-black text-purple-600 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Settings2 size={14} />
                        Class Assignment
                      </h3>
                    </div>

                    <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-4 bg-gray-50 rounded-3xl border border-gray-100">
                      {classes.map((cls, idx) => (
                        <label 
                          key={`${cls.id || 'cls'}_${idx}`}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                            (editingStudent.classIds || []).includes(cls.id)
                              ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-100'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={(editingStudent.classIds || []).includes(cls.id)}
                            onChange={(e) => {
                              const currentIds = editingStudent.classIds || [];
                              const newIds = e.target.checked 
                                ? [...currentIds, cls.id]
                                : currentIds.filter(id => id !== cls.id);
                              
                              setEditingStudent({ ...editingStudent, classIds: newIds });
                            }}
                          />
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            (editingStudent.classIds || []).includes(cls.id)
                              ? 'bg-white text-purple-600 border-white'
                              : 'bg-gray-50 border-gray-300'
                          }`}>
                            {(editingStudent.classIds || []).includes(cls.id) && <Check size={10} strokeWidth={4} />}
                          </div>
                          <span className="text-xs font-bold truncate leading-none">{cls.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                <button 
                  onClick={() => setEditingStudent(null)}
                  className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="edit-student-form"
                  className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-3"
                >
                  <Save size={18} />
                  Update Student Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {filteredStudents.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <GraduationCap size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">No students found matching your criteria.</p>
        </div>
      )}
      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
};
