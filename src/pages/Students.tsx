import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, query, where, doc, updateDoc, addDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { User, Class, AppNotification } from '../types';
import { Search, GraduationCap, Mail, Calendar, BookOpen, Settings2, X, Printer, Send, Paperclip, Loader2, MessageSquare, Clock, User2, Phone, MapPin, ShieldCheck, Briefcase, HeartPulse, Info, Eye, Check, Save, RefreshCw, AlertTriangle, FileText, AlertCircle, QrCode, CreditCard, Download, Image as ImageIcon } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { Toast, ToastMessage } from '../components/Toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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

  // Student ID Card Custom States
  const [selectedIdCardStudent, setSelectedIdCardStudent] = useState<User | null>(null);
  const [showBulkIdCards, setShowBulkIdCards] = useState(false);
  const [idCardThemeColor, setIdCardThemeColor] = useState<'indigo' | 'blue' | 'emerald' | 'rose' | 'amber' | 'slate'>('indigo');
  const [idCardOrientation, setIdCardOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [idCardShowBack, setIdCardShowBack] = useState(false);
  const [idCardCustomRole, setIdCardCustomRole] = useState('STUDENT');
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isSavingPng, setIsSavingPng] = useState(false);

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

  const handlePrintIdCards = (studentsToPrint: User[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast("Failed to open print window. Please allow popups.", "error");
      return;
    }

    const schoolName = settings?.schoolName || 'BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE';
    const schoolAddress = settings?.publicAddress || 'P.O. Box 1234-01000, Thika, Kenya';
    const schoolPhone = settings?.publicPhone || '+254 7XX XXX XXX';
    const schoolEmail = settings?.publicEmail || 'info@bitc.ac.ke';
    const schoolLogo = settings?.logoUrl || '';

    // Color definitions
    const colors = {
      indigo: { primary: '#4f46e5', text: '#ffffff', light: '#e0e7ff', border: '#c7d2fe' },
      blue: { primary: '#2563eb', text: '#ffffff', light: '#dbeafe', border: '#bfdbfe' },
      emerald: { primary: '#059669', text: '#ffffff', light: '#d1fae5', border: '#a7f3d0' },
      rose: { primary: '#e11d48', text: '#ffffff', light: '#ffe4e6', border: '#fecdd3' },
      amber: { primary: '#d97706', text: '#ffffff', light: '#fef3c7', border: '#fde68a' },
      slate: { primary: '#1e293b', text: '#ffffff', light: '#f1f5f9', border: '#e2e8f0' },
    };

    const scheme = colors[idCardThemeColor] || colors.indigo;

    // Build the bulk layout
    const cardsHtml = studentsToPrint.map(student => {
      // Get the QR code base64 from the DOM
      const canvasEl = document.getElementById(`qr-canvas-${student.uid}`) as HTMLCanvasElement;
      const qrDataUrl = canvasEl ? canvasEl.toDataURL() : '';

      const photoPlaceholder = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(student.name)}&backgroundColor=cbd5e1`;
      const photoSrc = student.photoUrl || photoPlaceholder;

      const classLabel = getClassNames(student.classIds) || 'Unassigned';

      if (idCardOrientation === 'portrait') {
        return `
          <div class="card-container portrait border-${idCardThemeColor}">
            <!-- Front Side -->
            <div class="card-side front">
              <!-- Top Header Wave bg -->
              <div class="card-header" style="background-color: ${scheme.primary}; color: ${scheme.text};">
                <div class="school-logo-container">
                  ${schoolLogo ? `<img src="${schoolLogo}" class="school-logo-img" />` : `<div class="logo-fallback">★</div>`}
                </div>
                <div class="school-header-text">
                  <div class="school-name">${schoolName}</div>
                  <div class="school-motto">EXCELLENCE & CREATIVITY</div>
                </div>
              </div>
              
              <div class="id-badge-tag" style="background-color: ${scheme.light}; color: ${scheme.primary}; border: 1px solid ${scheme.border};">
                ${idCardCustomRole.toUpperCase()}
              </div>

              <!-- Profile Space -->
              <div class="profile-row">
                <div class="photo-wrapper" style="border-color: ${scheme.primary};">
                  <img src="${photoSrc}" class="student-photo" crossorigin="anonymous" />
                </div>
              </div>

              <!-- Student Meta -->
              <div class="student-details">
                <div class="student-name">${student.name}</div>
                <div class="meta-item flex">
                  <span class="label">ADM NO:</span>
                  <span class="value val-bold">${student.admissionNumber || 'Pending'}</span>
                </div>
                <div class="meta-item flex">
                  <span class="label">COURSE:</span>
                  <span class="value truncate">${student.course || 'Technical Course'}</span>
                </div>
                <div class="meta-item flex">
                  <span class="label">CLASS:</span>
                  <span class="value truncate">${classLabel}</span>
                </div>
              </div>

              <!-- QR Code & Signature -->
              <div class="card-footer-row flex justify-between items-center bg-slate-50">
                <div class="qr-box">
                  ${qrDataUrl ? `<img src="${qrDataUrl}" class="qr-img" />` : `<div class="no-qr">No QR</div>`}
                  <div class="qr-caption" style="color: ${scheme.primary}">QR SECURE ID</div>
                </div>
                <div class="signature-box">
                  <div class="signature-line"></div>
                  <div class="signature-caption">AUTHORIZED SIGNATURE</div>
                </div>
              </div>
            </div>

            <!-- Back Side -->
            <div class="card-side back">
              <div class="back-accent" style="background-color: ${scheme.primary};"></div>
              <div class="back-header">
                <div class="school-title-back">${schoolName}</div>
                <div class="school-subtitle-back">STUDENT IDENTIFICATION RECORD</div>
              </div>
              
              <div class="bullet-rules">
                <div class="rule-title">TERMS & INSTRUCTIONS</div>
                <ul>
                  <li>This card is strictly non-transferable and remains the official property of the Institution.</li>
                  <li>It must be visibly displayed at all times when within the institution premises.</li>
                  <li>Required for entry at main gates, registration, examinations, and library loans.</li>
                  <li>If lost, report immediately to the Registrar's Office. Replacement fee applies.</li>
                  <li>In case of emergency, please alert the contacts shown below.</li>
                </ul>
              </div>

              <div class="emergency-contact-box bg-slate-50" style="border-top: 1px dashed ${scheme.border}">
                <div class="info-line"><span>Email:</span> ${schoolEmail}</div>
                <div class="info-line"><span>Phone:</span> ${schoolPhone}</div>
                <div class="info-line"><span>Address:</span> ${schoolAddress}</div>
              </div>

              <div class="back-footer flex items-center justify-between" style="background-color: ${scheme.primary}; color: #ffffff;">
                <span>STAY DISCIPLINED, EXCEL ALWAYS</span>
                <span>ID: ${student.uid.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>
          </div>
        `;
      } else {
        // Landscape Card Layout (designed after the provided reference image)
        const validUntil = getValidUntil(student);
        return `
          <div class="card-container landscape">
            <!-- Front Side -->
            <div class="card-side front flex flex-col justify-between">
              <!-- Top Header Banner -->
              <div class="bitc-header flex items-center justify-center">
                <div class="bitc-logo-container">
                  ${schoolLogo ? `<img src="${schoolLogo}" class="bitc-header-logo" crossorigin="anonymous" />` : `
                    <svg class="bitc-header-logo-svg" viewBox="0 0 100 100" width="36" height="36">
                      <polygon points="50,5 90,25 90,75 50,95 10,75 10,25" fill="#facc15" stroke="#ffffff" stroke-width="3"/>
                      <polygon points="50,12 82,28 82,72 50,88 18,72 18,28" fill="#0d1b94"/>
                      <path d="M50,22 L65,37 M50,22 L35,37 M50,22 L50,78" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
                      <circle cx="50" cy="50" r="12" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
                    </svg>
                  `}
                </div>
                <div class="bitc-header-titles">
                  <div class="bitc-title-main">Breakthrough International Training</div>
                  <div class="bitc-title-sub">College</div>
                </div>
              </div>

              <!-- Main Card Body -->
              <div class="bitc-body flex-1 flex row">
                <!-- Left column: Photo + Big QR Code -->
                <div class="bitc-left-col flex flex-col items-center justify-between">
                  <div class="bitc-photo-wrapper">
                    <img src="${photoSrc}" class="bitc-student-photo" crossorigin="anonymous" />
                  </div>
                  <div class="bitc-qr-wrapper">
                    ${qrDataUrl ? `<img src="${qrDataUrl}" class="bitc-qr-image" />` : `<div class="bitc-qr-fallback">QR</div>`}
                  </div>
                </div>

                <!-- Right column: Category Pill + Details Grid -->
                <div class="bitc-right-col flex-1 flex flex-col justify-between">
                  <!-- Red Pill Category tag stretching to the right edge of the card body -->
                  <div class="bitc-red-pill-outer">
                    <div class="bitc-red-pill">
                      Student ID Card
                    </div>
                  </div>

                  <!-- Details Grid -->
                  <div class="bitc-details-grid flex-1 flex flex-col justify-center">
                    <div class="bitc-grid-row">
                      <div class="bitc-key">Name</div>
                      <div class="bitc-colon">:</div>
                      <div class="bitc-val font-black-caps">${student.name}</div>
                    </div>
                    <div class="bitc-grid-row">
                      <div class="bitc-key">Adm No</div>
                      <div class="bitc-colon">:</div>
                      <div class="bitc-val font-black-caps">${student.admissionNumber || 'PENDING'}</div>
                    </div>
                    <div class="bitc-grid-row">
                      <div class="bitc-key">Course</div>
                      <div class="bitc-colon">:</div>
                      <div class="bitc-val font-black-caps">${student.course || 'COSMETOLOGY'}</div>
                    </div>
                    <div class="bitc-grid-row">
                      <div class="bitc-key">Valid Until</div>
                      <div class="bitc-colon">:</div>
                      <div class="bitc-val font-black-caps text-valid-until">${validUntil}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Bottom Footer Banner -->
              <div class="bitc-footer-stripe"></div>
            </div>

            <!-- Back Side -->
            <div class="card-side back flex flex-col justify-between">
              <div class="back-header-landscape flex justify-between items-center" style="background-color: #0d1b94; color: #ffffff;">
                <span class="school-title-back-landscape">${schoolName}</span>
                <span class="back-id">ID: ${student.uid.slice(0, 8).toUpperCase()}</span>
              </div>

              <div class="landscape-back-grid flex flex-1">
                <div class="landscape-rules-left flex-1 font-bold">
                  <div class="rule-title-landscape">RULES OF USE</div>
                  <p class="rule-p" style="font-size: 8px; color: #475569; line-height: 1.4; text-align: left;">
                    This card is the official property of Breakthrough International Training College.
                    It verifies active enrollment status and is non-transferable.
                    It must be carried at all times on campus.
                    If found, please return to the Registrar's Office.
                  </p>
                </div>
                <div class="landscape-emergency-right bg-slate-50 border-l border-slate-200" style="text-align: left;">
                  <div class="rule-title-landscape">EMERGENCY CONTACTS</div>
                  <div class="info-line"><span>Tel:</span> ${schoolPhone}</div>
                  <div class="info-line"><span>Mail:</span> ${schoolEmail}</div>
                  <div class="info-line"><span>Addr:</span> ${schoolAddress}</div>
                </div>
              </div>

              <div class="back-footer-landscape text-center" style="background-color: #f8fafc; color: #0d1b94; border-top: 1px solid #e2e8f0; font-size: 8px; font-weight: bold; letter-spacing: 0.5px; padding: 4px;">
                IF FOUND, PLEASE RETURN TO REGISTRAR'S OFFICE
              </div>
            </div>
          </div>
        `;
      }
    }).join('\n');

    const layoutCss = `
      @import url('https://fonts.googleapis.com/css2family=Inter:wght@400;500;600;700;800;900&display=swap');
      
      * {
        box-sizing: border-box;
      }
      body {
        font-family: 'Inter', sans-serif;
        background: #f1f5f9;
        margin: 0;
        padding: 40px 20px;
        display: flex;
        flex-wrap: wrap;
        gap: 30px;
        justify-content: center;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      /* Card Layout - 54mm x 85.6mm (CR80) mapped to 330px x 510px */
      .card-container {
        border-radius: 16px;
        width: 320px;
        height: 500px;
        background: #ffffff;
        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
        overflow: hidden;
        position: relative;
        page-break-inside: avoid;
        display: inline-block;
        border: 2px solid #e2e8f0;
      }

      .card-container.landscape {
        width: 500px;
        height: 320px;
      }

      /* Custom styles matching Breakthrough International Training College Reference ID card */
      .bitc-header {
        background-color: #0d1b94;
        color: #ffffff;
        padding: 4px 10px;
        height: 58px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        box-sizing: border-box;
        position: relative;
      }

      .bitc-logo-container {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .bitc-header-logo {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .bitc-header-logo-svg {
        max-width: 100%;
        max-height: 100%;
      }

      .bitc-header-titles {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        flex: 1;
        text-align: center;
        margin-right: 0;
        padding-left: 68px;
        padding-right: 14px;
      }

      .bitc-title-main {
        font-family: 'Inter', sans-serif;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: -0.2px;
        text-transform: uppercase;
        line-height: 1.1;
        color: #ffffff;
        white-space: nowrap;
      }

      .bitc-title-sub {
        font-family: 'Inter', sans-serif;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 0.1px;
        text-transform: uppercase;
        line-height: 1.1;
        color: #ffffff;
        margin-top: 1px;
        white-space: nowrap;
      }

      .bitc-body {
        background-color: #FFFDF6;
        padding: 8px 12px 6px 12px;
        display: flex;
        flex-direction: row;
        width: 100%;
        box-sizing: border-box;
      }

      .bitc-left-col {
        width: 110px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        margin-right: 12px;
        flex-shrink: 0;
        height: 100%;
      }

      .bitc-photo-wrapper {
        width: 98px;
        height: 102px;
        border-radius: 4px;
        border: 1px solid #c7d2fe;
        overflow: hidden;
        background: #f8fafc;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .bitc-student-photo {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .bitc-qr-wrapper {
        width: 82px;
        height: 82px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 4px;
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 4px;
      }

      .bitc-qr-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .bitc-qr-fallback {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        color: #64748b;
      }

      .bitc-right-col {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        height: 100%;
        position: relative;
        padding-top: 2px;
      }

      .bitc-red-pill-outer {
        margin-right: -12px; /* make pill bleed to edge */
        margin-bottom: 8px;
        display: flex;
        justify-content: flex-end;
      }

      .bitc-red-pill {
        background-color: #ee1c24;
        color: #000c40; /* High status premium heavy blue text */
        font-size: 15.5px;
        font-weight: 950;
        letter-spacing: 0.2px;
        padding: 5px 24px 5px 36px;
        border-top-left-radius: 999px;
        border-bottom-left-radius: 999px;
        text-transform: uppercase;
        text-align: right;
        display: inline-block;
        font-family: 'Inter', sans-serif;
      }

      .bitc-details-grid {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        gap: 6px;
        padding-left: 2px;
        padding-top: 4px;
      }

      .bitc-grid-row {
        display: flex;
        flex-direction: row;
        align-items: baseline;
        font-size: 13.5px;
      }

      .bitc-key {
        width: 115px;
        font-weight: 800;
        color: #0b1654;
        font-size: 12.5px;
        font-family: 'Inter', sans-serif;
        letter-spacing: 0.3px;
      }

      .bitc-colon {
        width: 14px;
        font-weight: bold;
        color: #0b1654;
        text-align: center;
      }

      .bitc-val {
        flex: 1;
        font-weight: 950;
        color: #000c40;
        font-size: 14.5px;
        text-transform: uppercase;
        letter-spacing: 0.1px;
        font-family: 'Inter', sans-serif;
        text-align: left;
      }

      .bitc-val.text-valid-until {
        color: #000c40 !important;
      }

      .font-black-caps {
        text-transform: uppercase;
        font-weight: 900 !important;
      }

      .bitc-footer-stripe {
        background-color: #0d1b94;
        height: 11px;
        width: 100%;
      }

      .flex { display: flex; }
      .flex-col { flex-direction: column; }
      .flex-1 { flex: 1; }
      .row { flex-direction: row; }
      .justify-between { justify-content: space-between; }
      .items-center { align-items: center; }
      .content-center { justify-content: center; }
      .bg-slate-50 { background-color: #f8fafc; }
      .border-l { border-left: 1px solid #e2e8f0; }
      .ml-4 { margin-left: 16px; }
      .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      /* Vertical Badge Design */
      .card-side {
        width: 100%;
        height: 100%;
        position: relative;
        background: #ffffff;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      /* When printing, display side-by-side or stack them nicely */
      .card-side.back {
        background: #ffffff;
        border-top: 1px dashed #e2e8f0;
      }

      /* Portrait Front components */
      .card-header {
        padding: 14px 12px;
        text-align: center;
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom: 3px solid rgba(0,0,0,0.15);
      }

      .school-logo-container {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        padding: 2px;
      }

      .school-logo-img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .logo-fallback {
        font-size: 18px;
        font-weight: bold;
      }

      .school-header-text {
        text-align: left;
        flex: 1;
        min-width: 0;
      }

      .school-name {
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.3px;
        text-transform: uppercase;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .school-motto {
        font-size: 6px;
        font-weight: 700;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        opacity: 0.85;
        margin-top: 2px;
      }

      .id-badge-tag {
        font-size: 9px;
        font-weight: 950;
        letter-spacing: 1px;
        text-align: center;
        padding: 4px 12px;
        margin: 8px auto 0;
        border-radius: 20px;
        text-transform: uppercase;
        width: 130px;
      }

      .profile-row {
        display: flex;
        justify-content: center;
        margin-top: 10px;
      }

      .photo-wrapper {
        width: 96px;
        height: 96px;
        border-radius: 50%;
        border: 3px solid;
        overflow: hidden;
        background: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.06);
      }

      .student-photo {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .student-details {
        padding: 0 20px;
        text-align: center;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        margin: 10px 0;
      }

      .student-name {
        font-size: 15px;
        font-weight: 850;
        color: #0f172a;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .meta-item {
        font-size: 9px;
        margin: 3px 0;
        color: #475569;
        justify-content: center;
        gap: 6px;
      }

      .meta-item .label {
        font-weight: 700;
        color: #94a3b8;
      }

      .meta-item .value {
        font-weight: 600;
        color: #1e293b;
      }

      .meta-item .value.val-bold {
        font-weight: 800;
      }

      .card-footer-row {
        padding: 10px 16px;
        border-top: 1px solid #f1f5f9;
        height: 85px;
      }

      .qr-box {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .qr-img {
        width: 48px;
        height: 48px;
        object-fit: contain;
      }

      .qr-caption {
        font-size: 6px;
        font-weight: 800;
        letter-spacing: 0.5px;
        margin-top: 4px;
        text-transform: uppercase;
      }

      .signature-box {
        text-align: center;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-left: 20px;
      }

      .signature-line {
        width: 110px;
        height: 1px;
        border-top: 1.5px solid #64748b;
        margin-top: 25px;
      }

      .signature-caption {
        font-size: 6px;
        font-weight: 700;
        color: #64748b;
        letter-spacing: 0.5px;
        margin-top: 5px;
        text-transform: uppercase;
      }

      /* Portrait Back components */
      .back-accent {
        height: 8px;
        width: 100%;
      }

      .back-header {
        padding: 15px 15px 5px 15px;
        text-align: center;
      }

      .school-title-back {
        font-size: 11px;
        font-weight: 800;
        color: #1e293b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .school-subtitle-back {
        font-size: 7px;
        font-weight: 700;
        color: #64748b;
        margin-top: 3px;
        letter-spacing: 0.8px;
        text-transform: uppercase;
      }

      .bullet-rules {
        padding: 0 16px;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .rule-title {
        font-size: 8px;
        font-weight: 800;
        color: #475569;
        margin-bottom: 6px;
        letter-spacing: 0.5px;
      }

      .bullet-rules ul {
        margin: 0;
        padding-left: 12px;
        font-size: 7.5px;
        color: #64748b;
        line-height: 1.4;
      }

      .bullet-rules li {
        margin-bottom: 4px;
      }

      .emergency-contact-box {
        padding: 8px 16px;
        font-size: 7.5px;
        color: #475569;
        line-height: 1.3;
      }

      .info-line span {
        font-weight: 700;
        color: #64748b;
      }

      .back-footer {
        padding: 6px 16px;
        font-size: 7px;
        font-weight: 800;
        letter-spacing: 0.3px;
      }

      /* Landscape Front components */
      .landscape-left {
        width: 140px;
        padding: 15px 10px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        text-align: center;
      }

      .school-logo-landscape-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }

      .school-logo-landscape {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        background: #ffffff;
        padding: 2px;
        object-fit: contain;
      }

      .logo-fallback-landscape {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #ffffff;
        color: #333;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
      }

      .school-name-landscape {
        font-size: 8px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.2px;
        line-height: 1.2;
        margin-top: 4px;
      }

      .landscape-badge-tag {
        font-size: 8px;
        font-weight: 900;
        letter-spacing: 0.5px;
        padding: 3px 10px;
        border-radius: 20px;
        text-transform: uppercase;
        width: 100%;
        text-align: center;
      }

      .landscape-right {
        flex: 1;
        padding: 15px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .landscape-top-row {
        align-items: center;
      }

      .landscape-photo-wrapper {
        width: 72px;
        height: 72px;
        border-radius: 10px;
        border: 2px solid #e2e8f0;
        overflow: hidden;
        background: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .student-photo-landscape {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .landscape-meta-details .landscape-student-name {
        font-size: 13px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 5px;
        text-transform: uppercase;
        letter-spacing: 0.2px;
      }

      .landscape-meta-details .meta-item {
        font-size: 8.5px;
        margin: 2px 0;
        text-align: left;
        justify-content: flex-start;
      }

      .landscape-bottom-row {
        border-top: 1px solid #f1f5f9;
        padding-top: 8px;
      }

      .qr-box-landscape {
        gap: 6px;
      }

      .qr-img-landscape {
        width: 38px;
        height: 38px;
        object-fit: contain;
      }

      .qr-side-caption {
        font-size: 6px;
        color: #64748b;
        letter-spacing: 0.3px;
        line-height: 1.2;
      }

      .signature-box-landscape {
        text-align: right;
      }

      .signature-line-landscape {
        width: 90px;
        height: 1px;
        border-top: 1.5px solid #64748b;
        margin-top: 15px;
      }

      /* Landscape Back components */
      .back-header-landscape {
        padding: 8px 12px;
        font-size: 8px;
        font-weight: bold;
      }

      .school-title-back-landscape {
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: 0.3px;
      }

      .landscape-back-grid {
        align-items: stretch;
      }

      .landscape-rules-left {
        padding: 12px;
      }

      .rule-title-landscape {
        font-size: 8px;
        font-weight: bold;
        color: #475569;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .rule-p {
        font-size: 7.5px;
        color: #64748b;
        line-height: 1.3;
        margin: 0;
      }

      .landscape-emergency-right {
        padding: 12px;
        width: 180px;
      }

      @media print {
        body {
          background: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
          display: block !important;
        }

        .card-container {
          box-shadow: none !important;
          border: 1.5px solid #333333 !important;
          margin: 10mm 5mm !important;
          page-break-inside: avoid !important;
          float: left !important;
        }

        .card-side.back {
          border-top: 1px dashed #333333 !important;
        }

        html, body {
          height: 99%;
        }
      }
    `;

    const html = `
      <html>
        <head>
          <title>${studentsToPrint.length === 1 ? `ID Card - ${studentsToPrint[0].name}` : 'Bulk ID Cards Collection'}</title>
          <style>
            ${layoutCss}
          </style>
        </head>
        <body>
          ${cardsHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
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

  const executeHtml2CanvasWithPatch = async (element: HTMLElement) => {
    // Save original cssText descriptor so we can restore it down the line
    const originalDescriptor = Object.getOwnPropertyDescriptor(CSSRule.prototype, 'cssText');
    
    const memoizedColors: Record<string, string> = {};
    const resolveOklchColor = (oklchStr: string): string => {
      if (memoizedColors[oklchStr]) return memoizedColors[oklchStr];
      try {
        const tempSpan = document.createElement('span');
        tempSpan.style.color = oklchStr;
        tempSpan.style.display = 'none';
        document.body.appendChild(tempSpan);
        const resolved = window.getComputedStyle(tempSpan).color;
        document.body.removeChild(tempSpan);
        
        if (!resolved || resolved.includes('oklch')) {
          memoizedColors[oklchStr] = 'rgb(0, 0, 0)';
        } else {
          memoizedColors[oklchStr] = resolved;
        }
      } catch (err) {
        memoizedColors[oklchStr] = 'rgb(0, 0, 0)';
      }
      return memoizedColors[oklchStr];
    };

    // Override cssText getter temporarily
    Object.defineProperty(CSSRule.prototype, 'cssText', {
      get: function() {
        const rawText = originalDescriptor?.get ? originalDescriptor.get.call(this) : '';
        if (rawText && rawText.includes('oklch(')) {
          try {
            return rawText.replace(/oklch\([^)]+\)/g, (match) => {
              return resolveOklchColor(match);
            });
          } catch (err) {
            console.error("Error processing oklch color in CSS rule:", err);
            return rawText;
          }
        }
        return rawText;
      },
      configurable: true
    });

    try {
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false
      });
      return canvas;
    } finally {
      // Restore the original cssText descriptor
      if (originalDescriptor) {
        Object.defineProperty(CSSRule.prototype, 'cssText', originalDescriptor);
      } else {
        delete (CSSRule.prototype as any).cssText;
      }
    }
  };

  const handleSaveAsPNG = async (student: User) => {
    const cardEl = document.getElementById('id-card-preview-element');
    if (!cardEl) {
      addToast("ID Card preview element not found.", "error");
      return;
    }
    setIsSavingPng(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      const canvas = await executeHtml2CanvasWithPatch(cardEl);
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${student.name.trim().replace(/\s+/g, '_')}_ID_Card.png`;
      link.href = dataUrl;
      link.click();
      addToast("ID Card saved as PNG!", "success");
    } catch (error) {
      console.error("Error generating PNG: ", error);
      addToast("Failed to save as PNG.", "error");
    } finally {
      setIsSavingPng(false);
    }
  };

  const handleSaveAsPDF = async (student: User) => {
    const cardEl = document.getElementById('id-card-preview-element');
    if (!cardEl) {
      addToast("ID Card preview element not found.", "error");
      return;
    }
    setIsSavingPdf(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      const canvas = await executeHtml2CanvasWithPatch(cardEl);
      const dataUrl = canvas.toDataURL('image/png');
      
      const isPortrait = idCardOrientation === 'portrait';
      const width = isPortrait ? 54 : 86;
      const height = isPortrait ? 86 : 54;

      const pdf = new jsPDF({
        orientation: isPortrait ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [width, height]
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
      pdf.save(`${student.name.trim().replace(/\s+/g, '_')}_ID_Card.pdf`);
      addToast("ID Card saved as PDF!", "success");
    } catch (error) {
      console.error("Error generating PDF: ", error);
      addToast("Failed to save as PDF.", "error");
    } finally {
      setIsSavingPdf(false);
    }
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

  const getValidUntil = (student: User) => {
    if (student.validUntil) return student.validUntil;
    if (student.admissionNumber) {
      const parts = student.admissionNumber.split('/');
      const lastPart = parts[parts.length - 1];
      if (lastPart && /^\d+$/.test(lastPart.trim())) {
        const year = parseInt(lastPart.trim());
        if (year > 2000 && year < 2100) {
          return `JANUARY ${year + 1}`;
        }
      }
    }
    return 'JANUARY 2027';
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
            <>
              <button
                onClick={openBulkMessage}
                className="flex items-center gap-2 bg-success text-white px-4 py-2 rounded-lg hover:bg-success-hover transition-colors shadow-lg shadow-success/20 font-bold flex-1 md:flex-none justify-center"
              >
                <Send size={18} />
                Message ({selectedStudentIds.size})
              </button>
              <button
                onClick={() => setShowBulkIdCards(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo/20 font-bold flex-1 md:flex-none justify-center"
              >
                <QrCode size={18} />
                Print ID Cards ({selectedStudentIds.size})
              </button>
            </>
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
                  <button
                    onClick={() => setSelectedIdCardStudent(student)}
                    className="text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Generate QR ID Card"
                  >
                    <QrCode size={20} />
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
                <button
                  onClick={() => {
                    setSelectedIdCardStudent(viewingStudent);
                    setViewingStudent(null);
                  }}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center gap-2"
                >
                  <QrCode size={18} />
                  Print ID Card
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

        {/* Student ID Card Preview Modal */}
        {(selectedIdCardStudent || showBulkIdCards) && (() => {
          const studentsToPrint = selectedIdCardStudent 
            ? [selectedIdCardStudent] 
            : students.filter(s => selectedStudentIds.has(s.uid));

          const previewStudent = studentsToPrint[0];
          if (!previewStudent) return null;

          const activeScheme = idCardThemeColor;
          const classLabel = getClassNames(previewStudent.classIds) || 'Unassigned';
          const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(previewStudent.name)}&backgroundColor=cbd5e1`;

          const colorsList = [
            { id: 'indigo', name: 'Indigo Blue', color: 'bg-indigo-600' },
            { id: 'blue', name: 'Royal Blue', color: 'bg-blue-600' },
            { id: 'emerald', name: 'Emerald Green', color: 'bg-emerald-600' },
            { id: 'rose', name: 'Crimson Rose', color: 'bg-rose-600' },
            { id: 'amber', name: 'Amber Gold', color: 'bg-amber-600' },
            { id: 'slate', name: 'Midnight Slate', color: 'bg-slate-800' }
          ];

          return (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-50 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[550px]"
              >
                {/* Left customization panel */}
                <div className="lg:col-span-12 xl:col-span-5 bg-white p-8 border-r border-gray-100 flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-100 p-2.5 rounded-2xl text-indigo-600 animate-pulse">
                        <CreditCard size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">ID Card Designer</h2>
                        <p className="text-xs text-gray-500">Configure layout & print ready physical badges</p>
                      </div>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* Theme colors */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Choose Color Theme</label>
                      <div className="grid grid-cols-3 gap-2">
                        {colorsList.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setIdCardThemeColor(c.id as any)}
                            className={`flex items-center gap-2 p-2 rounded-xl text-xs font-semibold border transition-all ${
                              activeScheme === c.id 
                                ? 'border-gray-900 bg-gray-50 text-gray-900 shadow-sm' 
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full ${c.color} shrink-0`} />
                            <span className="truncate">{c.id.charAt(0).toUpperCase() + c.id.slice(1)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Orientation selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Orientation Format</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setIdCardOrientation('portrait')}
                          className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all text-center uppercase tracking-wider ${
                            idCardOrientation === 'portrait'
                              ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-extrabold shadow-sm'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Vertical Badge
                        </button>
                        <button
                          type="button"
                          onClick={() => setIdCardOrientation('landscape')}
                          className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all text-center uppercase tracking-wider ${
                            idCardOrientation === 'landscape'
                              ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-extrabold shadow-sm'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Horizontal Card
                        </button>
                      </div>
                    </div>

                    {/* Role Banner text */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Category label</label>
                      <input
                        type="text"
                        maxLength={18}
                        value={idCardCustomRole}
                        onChange={(e) => setIdCardCustomRole(e.target.value.toUpperCase())}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                        placeholder="e.g. STUDENT, FACULTY, VISITOR"
                      />
                    </div>

                    {/* Toggles */}
                    <div className="space-y-4 pt-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-gray-700 block">Preview Side</span>
                          <span className="text-[10px] text-gray-400">Toggle front and back card sides</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIdCardShowBack(!idCardShowBack)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-widest border transition-all ${
                            idCardShowBack 
                              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' 
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {idCardShowBack ? 'Back Side' : 'Front Side'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100 flex flex-wrap gap-2.5 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIdCardStudent(null);
                        setShowBulkIdCards(false);
                      }}
                      className="px-4 py-3 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      Close
                    </button>
                    
                    <button
                      type="button"
                      disabled={isSavingPdf || isSavingPng}
                      onClick={() => handleSaveAsPDF(previewStudent)}
                      className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Download size={14} className={isSavingPdf ? 'animate-bounce' : ''} />
                      {isSavingPdf ? 'Saving...' : 'Save PDF'}
                    </button>

                    <button
                      type="button"
                      disabled={isSavingPdf || isSavingPng}
                      onClick={() => handleSaveAsPNG(previewStudent)}
                      className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <ImageIcon size={14} className={isSavingPng ? 'animate-bounce' : ''} />
                      {isSavingPng ? 'Saving...' : 'Save PNG'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handlePrintIdCards(studentsToPrint)}
                      className="px-3.5 py-3 border border-indigo-200 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center"
                      title="Print Original Badges"
                    >
                      <Printer size={15} />
                    </button>
                  </div>
                </div>

                {/* Right beautiful mock-up display card panel */}
                <div className="lg:col-span-12 xl:col-span-7 bg-slate-950 border-l border-slate-800 p-8 flex flex-col items-center justify-center relative min-h-[480px]">
                  <div className="absolute top-4 left-4 text-xs font-extrabold tracking-widest uppercase text-slate-500">
                    Live HTML Print Preview ({studentsToPrint.length} Card{studentsToPrint.length > 1 ? 's' : ''})
                  </div>

                  {/* Hidden QR Draw Area */}
                  <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '256px', height: '256px', opacity: 0, overflow: 'hidden' }}>
                    {studentsToPrint.map(student => (
                      <QRCodeCanvas
                        key={student.uid}
                        id={`qr-canvas-${student.uid}`}
                        value={student.uid}
                        size={128}
                        level="H"
                        includeMargin={false}
                      />
                    ))}
                  </div>

                  {/* Canvas mockup wrapper */}
                  <div className="w-full h-full flex flex-col justify-center items-center gap-4 py-8">
                    {idCardOrientation === 'portrait' ? (
                      /* PORTRAIT BADGE PREVIEW */
                      <div id="id-card-preview-element" className="relative animate-fade-in w-[310px] h-[480px] bg-white rounded-2xl shadow-2xl border-2 border-slate-150 flex flex-col justify-between overflow-hidden text-slate-800">
                        {idCardShowBack ? (
                          /* PORTRAIT BACK */
                          <div className="w-full h-full flex flex-col justify-between p-4 bg-white relative">
                            {/* Accent indicator */}
                            <div className={`absolute top-0 left-0 w-full h-2 ${
                              activeScheme === 'blue' ? 'bg-blue-600' :
                              activeScheme === 'emerald' ? 'bg-emerald-600' :
                              activeScheme === 'rose' ? 'bg-rose-600' :
                              activeScheme === 'amber' ? 'bg-amber-600' :
                              activeScheme === 'slate' ? 'bg-slate-800' : 'bg-indigo-600'
                            }`} />
                            
                            <div className="text-center pt-4">
                              <span className="text-[10px] font-black text-slate-800 block uppercase tracking-wider">
                                {settings?.schoolName || 'BREAKTHROUGH INT COLLEGE'}
                              </span>
                              <span className="text-[7px] text-slate-400 font-extrabold uppercase block tracking-widest mt-1">
                                Identification Badge System
                              </span>
                            </div>

                            <div className="space-y-3 px-2 flex-1 justify-center flex flex-col">
                              <p className="text-[8px] font-bold uppercase text-slate-500 tracking-wider mb-2">Rules & Disciplinary Rules</p>
                              <ul className="list-disc text-[7px] leading-relaxed text-slate-400 space-y-1.5 pl-3 font-semibold text-left">
                                <li>The badge is non-transferable and remains physical property of the institution.</li>
                                <li>Visibly display your ID card inside the class or campus gates.</li>
                                <li>Present barcode or QR ID for lecture check-in & school gate entry.</li>
                                <li>Lost cards must be reported to the Registrar Office immediately.</li>
                              </ul>
                            </div>

                            <div className="p-2 border-t border-dashed bg-slate-50 border-slate-250">
                              <div className="text-[7px] text-slate-500 text-left font-bold space-y-0.5">
                                <p><span className="text-slate-400">Email:</span> {settings?.publicEmail || 'info@bitc.ac.ke'}</p>
                                <p><span className="text-slate-400">Tel:</span> {settings?.publicPhone || '+254 7XX XXX'}</p>
                                <p><span className="text-slate-400">Addr:</span> {settings?.publicAddress || 'Thika, Kenya'}</p>
                              </div>
                            </div>

                            <div className={`-mx-4 -mb-4 px-4 py-2 flex items-center justify-between text-white text-[7px] font-extrabold uppercase mt-2 ${
                              activeScheme === 'blue' ? 'bg-blue-600' :
                              activeScheme === 'emerald' ? 'bg-emerald-600' :
                              activeScheme === 'rose' ? 'bg-rose-600' :
                              activeScheme === 'amber' ? 'bg-amber-600' :
                              activeScheme === 'slate' ? 'bg-slate-800' : 'bg-indigo-600'
                            }`}>
                              <span>EXCEL & GROW ALWAYS</span>
                              <span>ID: {previewStudent.uid.slice(0, 8).toUpperCase()}</span>
                            </div>
                          </div>
                        ) : (
                          /* PORTRAIT FRONT */
                          <div className="w-full h-full flex flex-col justify-between relative bg-white">
                            <div className={`p-3.5 flex items-center gap-2 border-b-2 border-black/10 text-white ${
                              activeScheme === 'blue' ? 'bg-blue-600' :
                              activeScheme === 'emerald' ? 'bg-emerald-600' :
                              activeScheme === 'rose' ? 'bg-rose-600' :
                              activeScheme === 'amber' ? 'bg-amber-600' :
                              activeScheme === 'slate' ? 'bg-slate-800' : 'bg-indigo-600'
                            }`}>
                              <div className="w-8 h-8 rounded-lg bg-white shrink-0 flex items-center justify-center p-1 overflow-hidden font-bold text-slate-800 text-xs">
                                {settings?.logoUrl ? <img src={settings.logoUrl} className="max-h-full max-w-full object-contain" /> : '★'}
                              </div>
                              <div className="text-left min-w-0">
                                <h4 className="text-[9px] font-black uppercase tracking-wide leading-tight truncate">
                                  {settings?.schoolName || 'BREAKTHROUGH COLLEGE'}
                                </h4>
                                <p className="text-[6px] font-bold text-white/80 uppercase tracking-widest mt-0.5">EXCELLENCE & CREATIVITY</p>
                              </div>
                            </div>

                            <div className={`text-[8px] font-black uppercase tracking-widest block mx-auto py-1 px-4 rounded-full mt-2 border ${
                              activeScheme === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              activeScheme === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              activeScheme === 'rose' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                              activeScheme === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                              activeScheme === 'slate' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                              'bg-indigo-50 text-indigo-700 border-indigo-100'
                            }`}>
                              {idCardCustomRole.toUpperCase() || 'STUDENT'}
                            </div>

                            {/* Avatar Display */}
                            <div className="flex justify-center mt-2.5">
                              <div className={`w-20 h-20 rounded-full border-2 overflow-hidden bg-slate-50 flex items-center justify-center text-slate-800 ${
                                activeScheme === 'blue' ? 'border-blue-600' :
                                activeScheme === 'emerald' ? 'border-emerald-600' :
                                activeScheme === 'rose' ? 'border-rose-600' :
                                activeScheme === 'amber' ? 'border-amber-600' :
                                activeScheme === 'slate' ? 'border-slate-800' : 'border-indigo-600'
                              }`}>
                                {previewStudent.photoUrl ? (
                                  <img src={previewStudent.photoUrl} className="w-full h-full object-cover" />
                                ) : (
                                  <img src={defaultAvatar} className="w-full h-full object-cover" />
                                )}
                              </div>
                            </div>

                            {/* Info */}
                            <div className="px-5 text-center flex-1 flex flex-col justify-center mt-2 space-y-1">
                              <h3 className="text-sm font-black text-slate-900 uppercase truncate leading-snug">{previewStudent.name}</h3>
                              
                              <div className="flex justify-between text-[8px] border-b border-gray-150 py-0.5 text-slate-400 font-bold">
                                <span>ADM NO:</span>
                                <span className="text-slate-800 uppercase font-black">{previewStudent.admissionNumber || 'PENDING'}</span>
                              </div>
                              <div className="flex justify-between text-[8px] border-b border-gray-150 py-0.5 text-slate-400 font-bold">
                                <span>COURSE:</span>
                                <span className="text-slate-800 truncate font-black w-40 text-right">{previewStudent.course || 'NOT SPECIFIED'}</span>
                              </div>
                              <div className="flex justify-between text-[8px] py-0.5 text-slate-400 font-bold">
                                <span>CLASS:</span>
                                <span className="text-slate-800 truncate font-black w-40 text-right">{classLabel}</span>
                              </div>
                            </div>

                            {/* QR Footer display */}
                            <div className="border-t bg-slate-50 p-2.5 flex justify-between items-center h-20">
                              <div className="flex flex-col items-center ml-2">
                                <QRCodeCanvas
                                  value={previewStudent.uid}
                                  size={44}
                                  level="H"
                                />
                                <span className={`text-[5px] font-extrabold uppercase mt-1 ${
                                  activeScheme === 'blue' ? 'text-blue-600' :
                                  activeScheme === 'emerald' ? 'text-emerald-600' :
                                  activeScheme === 'rose' ? 'text-rose-600' :
                                  activeScheme === 'amber' ? 'text-amber-600' :
                                  activeScheme === 'slate' ? 'text-slate-800' : 'text-indigo-600'
                                }`}>QR ID SCAN</span>
                              </div>
                              <div className="flex-1 flex flex-col items-center justify-center px-4">
                                <div className="w-24 border-t border-slate-350" />
                                <span className="text-[5px] text-slate-400 font-semibold uppercase mt-1">AUTHORIZED SIGNATURE</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* LANDSCAPE BADGE PREVIEW */
                      <div id="id-card-preview-element" className="relative animate-fade-in w-[480px] h-[300px] bg-white rounded-2xl shadow-2xl border-2 border-slate-150 flex flex-col justify-between overflow-hidden text-slate-800">
                        {idCardShowBack ? (
                          /* LANDSCAPE BACK */
                          <div className="w-full h-full flex flex-col justify-between p-4 bg-white relative">
                            <div className={`p-2 flex justify-between items-center text-white -mx-4 -mt-4 px-4 ${
                              activeScheme === 'blue' ? 'bg-blue-600' :
                              activeScheme === 'emerald' ? 'bg-emerald-600' :
                              activeScheme === 'rose' ? 'bg-rose-600' :
                              activeScheme === 'amber' ? 'bg-amber-600' :
                              activeScheme === 'slate' ? 'bg-slate-800' : 'bg-indigo-600'
                            }`}>
                              <span className="text-[8px] font-black uppercase tracking-wide">
                                {settings?.schoolName || 'BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE'}
                              </span>
                              <span className="text-[7px] text-white/80 font-bold font-mono">ID: {previewStudent.uid.slice(0, 8).toUpperCase()}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 flex-1 items-center mt-3">
                              <div className="text-left space-y-1">
                                <p className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">TERMS & POLICY</p>
                                <p className="text-[7px] text-slate-400 font-semibold leading-relaxed">
                                  This badge identifies the verified holder. Please keep visual at all school events. If lost, file report directly to Administration.
                                </p>
                              </div>
                              <div className="text-right space-y-0.5 border-l pl-4 border-slate-200">
                                <p className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">SUPPORT</p>
                                <p className="text-[7px] font-bold text-slate-600 truncate">Email: {settings?.publicEmail || 'info@bitc.ac.ke'}</p>
                                <p className="text-[7px] font-bold text-slate-600 truncate">Phone: {settings?.publicPhone || '+2547000'}</p>
                                <p className="text-[7px] font-bold text-slate-600 truncate">Region: {settings?.publicAddress || 'Thika, Kenya'}</p>
                              </div>
                            </div>

                            <div className={`text-center py-1.5 -mx-4 -mb-4 text-[7px] font-extrabold uppercase mt-2 ${
                              activeScheme === 'blue' ? 'bg-blue-50 text-blue-700 border-t border-blue-100' :
                              activeScheme === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-t border-emerald-100' :
                              activeScheme === 'rose' ? 'bg-rose-50 text-rose-700 border-t border-rose-100' :
                              activeScheme === 'amber' ? 'bg-amber-50 text-amber-700 border-t border-amber-100' :
                              activeScheme === 'slate' ? 'bg-slate-100 text-slate-700 border-t border-slate-200' :
                              'bg-indigo-50 text-indigo-700 border-t border-indigo-100'
                            }`}>
                              FOUND THIS BADGE? PLEASE RETURN IT IMMEDIATELY TO THE REGISTRAR'S OFFICE
                            </div>
                          </div>
                        ) : (
                          /* LANDSCAPE FRONT - BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE STYLE */
                          <div className="w-full h-full flex flex-col bg-[#FFFDF6] select-none text-slate-800">
                            {/* Top Header Banner */}
                            <div className="bg-[#0d1b94] text-white py-1 pr-3.5 pl-[68px] flex items-center justify-center h-[58px] relative">
                              <div className="absolute left-[14px] top-1/2 -translate-y-1/2 w-[44px] h-[44px] rounded bg-white flex items-center justify-center p-0.5 shrink-0 shadow-sm">
                                {settings?.logoUrl ? (
                                  <img src={settings.logoUrl} className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                                ) : (
                                  <svg className="w-full h-full" viewBox="0 0 100 100">
                                    <polygon points="50,5 90,25 90,75 50,95 10,75 10,25" fill="#facc15" stroke="#ffffff" stroke-width="3"/>
                                    <polygon points="50,12 82,28 82,72 50,88 18,72 18,28" fill="#0d1b94"/>
                                    <path d="M50,22 L65,37 M50,22 L35,37 M50,22 L50,78" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
                                    <circle cx="50" cy="50" r="12" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
                                  </svg>
                                )}
                              </div>
                              <div className="text-center w-full flex flex-col justify-center items-center">
                                <h4 className="text-[18px] font-black uppercase leading-tight text-white tracking-tight whitespace-nowrap">Breakthrough International Training</h4>
                                <h5 className="text-[17.5px] font-black uppercase leading-none text-white tracking-wide mt-0.5 whitespace-nowrap">College</h5>
                              </div>
                            </div>

                            {/* Main Body */}
                            <div className="flex-1 flex p-3 justify-between">
                              {/* Left Column: Photo & Big QR Code */}
                              <div className="w-[105px] flex flex-col items-center justify-between h-[195px] shrink-0">
                                <div className="w-[90px] h-[95px] rounded border border-indigo-100 overflow-hidden bg-slate-50 flex items-center justify-center shrink-0 shadow-sm">
                                  {previewStudent.photoUrl ? (
                                    <img src={previewStudent.photoUrl} className="w-full h-full object-cover" />
                                  ) : (
                                    <img src={defaultAvatar} className="w-full h-full object-cover" />
                                  )}
                                </div>
                                <div className="w-[78px] h-[78px] bg-white border border-gray-200 rounded p-1 flex items-center justify-center shadow-sm">
                                  <QRCodeCanvas
                                    value={previewStudent.uid}
                                    size={70}
                                    level="H"
                                    includeMargin={false}
                                  />
                                </div>
                              </div>

                              {/* Right Column: Category pill & details info */}
                              <div className="flex-1 pl-4 flex flex-col justify-start relative">
                                {/* Red Category pill tag - extends to right boundary */}
                                <div className="flex justify-end -mr-3 mb-2.5">
                                  <div className="bg-[#ee1c24] text-white text-[13.5px] font-black uppercase px-6 py-1 tracking-widest rounded-l-full shadow-sm text-right min-w-[200px]">
                                    Student ID Card
                                  </div>
                                </div>

                                {/* Information Records */}
                                <div className="flex-1 flex flex-col justify-center space-y-2 pl-1">
                                  <div className="flex items-baseline text-[13px]">
                                    <span className="w-[88px] font-black text-[#0b1654] uppercase tracking-wide text-left text-[12px]">Name</span>
                                    <span className="w-3 font-bold text-[#0b1654] text-center">:</span>
                                    <span className="flex-1 font-black text-[#000c40] uppercase truncate text-left text-[14.5px]">{previewStudent.name}</span>
                                  </div>
                                  <div className="flex items-baseline text-[13px]">
                                    <span className="w-[88px] font-black text-[#0b1654] uppercase tracking-wide text-left text-[12px]">Adm No</span>
                                    <span className="w-3 font-bold text-[#0b1654] text-center">:</span>
                                    <span className="flex-1 font-black text-[#000c40] uppercase text-left text-[14.5px]">{previewStudent.admissionNumber || 'PENDING'}</span>
                                  </div>
                                  <div className="flex items-baseline text-[13px]">
                                    <span className="w-[88px] font-black text-[#0b1654] uppercase tracking-wide text-left text-[12px]">Course</span>
                                    <span className="w-3 font-bold text-[#0b1654] text-center">:</span>
                                    <span className="flex-1 font-black text-[#000c40] uppercase truncate text-left text-[14.5px]">{previewStudent.course || 'COSMETOLOGY'}</span>
                                  </div>
                                  <div className="flex items-baseline text-[13px]">
                                    <span className="w-[88px] font-black text-[#0b1654] uppercase tracking-wide text-left text-[12px]">Valid Until</span>
                                    <span className="w-3 font-bold text-[#0b1654] text-center">:</span>
                                    <span className="flex-1 font-black text-[#000c40] uppercase text-left text-[14.5px]">{getValidUntil(previewStudent)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Accent bottom border strip */}
                            <div className="h-2 bg-[#0d1b94] w-full shrink-0" />
                          </div>
                        )}
                      </div>
                    )}

                    {studentsToPrint.length > 1 && (
                      <p className="text-slate-400 text-[10px] font-bold mt-2 bg-slate-800/50 py-1.5 px-3 rounded-full border border-slate-700/30">
                        Showing Preview for {previewStudent.name}. All {studentsToPrint.length} cards will be fully rendered with their matching QR codes upon printing.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
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
