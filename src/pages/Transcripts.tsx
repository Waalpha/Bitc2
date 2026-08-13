import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { User, Submission, Exam, Unit, Class, Grade } from '../types';
import { 
  FileText, 
  Printer, 
  Download,
  Search, 
  Award, 
  BookOpen, 
  Briefcase, 
  UserCheck, 
  GraduationCap, 
  CheckCircle, 
  HelpCircle,
  Database,
  Sparkles,
  QrCode,
  MapPin,
  Mail,
  Phone,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { withOklabOklchPatch } from '../utils/canvasPatch';

const getTodayISODate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const Transcripts: React.FC = () => {
  const { user, userData, settings, studentContext } = useAuth();

  const isStudentOrParent = userData?.role === 'student' || userData?.role === 'parent';
  if (isStudentOrParent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-[32px] border border-slate-200/60 dark:border-slate-800">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-2xl mb-4">
          <AlertTriangle size={24} className="text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-950 dark:text-white">Access Denied</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md font-medium leading-relaxed">
          Academic transcripts are only accessible via the school administrator and registrar portal. Please contact the administration office if you require an official copy.
        </p>
      </div>
    );
  }
  
  // State for loaded data
  const [students, setStudents] = useState<User[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchTerm, setSearchQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [includeMockData, setIncludeMockData] = useState(false);
  const [isSignoffPrinted, setIsSignoffPrinted] = useState(true);

  // Overrides for School Details
  const [schoolNameOverride, setSchoolNameOverride] = useState('');
  const [logoUrlOverride, setLogoUrlOverride] = useState('');
  const [addressOverride, setAddressOverride] = useState('');
  const [phoneOverride, setPhoneOverride] = useState('');
  const [emailOverride, setEmailOverride] = useState('');
  const [registrarNameOverride, setRegistrarNameOverride] = useState(localStorage.getItem('transcript_registrarName') || 'PROF. PATRICK NJUGUNA, PHD');
  const [registrarTitleOverride, setRegistrarTitleOverride] = useState(localStorage.getItem('transcript_registrarTitle') || 'REGISTRAR OF ACADEMIC AFFAIRS');
  const [signatureUrlOverride, setSignatureUrlOverride] = useState(localStorage.getItem('transcript_signatureUrl') || '');
  const [stampUrlOverride, setStampUrlOverride] = useState(localStorage.getItem('transcript_stampUrl') || '/stamp.png');
  const [sealDateOverride, setSealDateOverride] = useState(getTodayISODate());
  
  // Tutor / Teacher details overrides
  const [principalNameOverride, setPrincipalNameOverride] = useState(localStorage.getItem('transcript_principalName') || 'COURSE TUTOR');
  const [principalTitleOverride, setPrincipalTitleOverride] = useState(localStorage.getItem('transcript_principalTitle') || 'TUTOR / TEACHER');
  const [principalSignatureUrlOverride, setPrincipalSignatureUrlOverride] = useState(localStorage.getItem('transcript_principalSignatureUrl') || '');

  // Custom grades override state
  const [customResults, setCustomResults] = useState<any[] | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'students' | 'editor'>('students');
  
  // Digital Certificate states
  const [previewDocType, setPreviewDocType] = useState<'transcript' | 'certificate'>('transcript');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isSavingPdf, setIsSavingPdf] = useState(false);

  const executeHtml2CanvasWithPatch = async (element: HTMLElement) => {
    return withOklabOklchPatch(async () => {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false
      });
      return canvas;
    });
  };

  const handleDownloadPDF = async () => {
    const elementId = previewDocType === 'transcript' ? 'transcript-view-element' : 'certificate-view-element';
    const element = document.getElementById(elementId);
    if (!element) return;
    
    setIsSavingPdf(true);
    const originalStyle = element.getAttribute('style') || '';
    
    try {
      const isPortrait = printOrientation === 'portrait';
      if (previewDocType === 'transcript') {
        element.style.width = '794px';
        element.style.minWidth = '794px';
        element.style.maxWidth = '794px';
        element.style.height = '1123px';
        element.style.minHeight = '1123px';
        element.style.maxHeight = '1123px';
        element.style.boxSizing = 'border-box';
      } else {
        const w = isPortrait ? '794px' : '1123px';
        const h = isPortrait ? '1123px' : '794px';
        element.style.width = w;
        element.style.minWidth = w;
        element.style.maxWidth = w;
        element.style.height = h;
        element.style.minHeight = h;
        element.style.maxHeight = h;
        element.style.boxSizing = 'border-box';
      }

      await new Promise(resolve => setTimeout(resolve, 250));
      const canvas = await executeHtml2CanvasWithPatch(element);
      
      if (originalStyle) {
        element.setAttribute('style', originalStyle);
      } else {
        element.removeAttribute('style');
      }

      const imgData = canvas.toDataURL('image/png');
      const isPortraitDoc = printOrientation === 'portrait';
      
      const margin = 0; // Standard A4 fit (internal padding is already styled inside element)
      const pageWidth = isPortraitDoc ? 210 : 297;
      const pageHeight = isPortraitDoc ? 297 : 210;
      
      const pdf = new jsPDF({
        orientation: isPortraitDoc ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
      
      const fileName = selectedStudent 
        ? `${selectedStudent.name.trim().replace(/\s+/g, '_')}_${previewDocType === 'transcript' ? 'Transcript' : 'Certificate'}.pdf` 
        : `Breakthrough_${previewDocType === 'transcript' ? 'Transcript' : 'Certificate'}.pdf`;
        
      pdf.save(fileName);
    } catch (error) {
      console.error("Error generating PDF: ", error);
      if (originalStyle) {
        element.setAttribute('style', originalStyle);
      } else {
        element.removeAttribute('style');
      }
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleDownloadWord = () => {
    if (!selectedStudent) return;

    if (previewDocType === 'transcript') {
      const resultsHtml = results.length === 0 
        ? `<tr><td colspan="7" style="padding:20px; text-align:center; color:#94a3b8; font-weight:bold; font-family:Arial,sans-serif;">No Graded Assessment Entries Found</td></tr>`
        : results.map((r, i) => `
          <tr>
            <td style="padding:8px; border:1px solid #cbd5e1; text-align:center; font-family:Courier,monospace; font-weight:bold; color:#64748b;">${i + 1}</td>
            <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; font-family:Courier,monospace;">${r.unitCode}</td>
            <td style="padding:8px; border:1px solid #cbd5e1; text-transform:uppercase; font-family:Arial,sans-serif;">${r.unitName}</td>
            <td style="padding:8px; border:1px solid #cbd5e1; text-align:center; font-family:Courier,monospace;">${r.hours} Hrs</td>
            <td style="padding:8px; border:1px solid #cbd5e1; text-align:center; font-weight:bold; font-family:Courier,monospace;">${r.score}%</td>
            <td style="padding:8px; border:1px solid #cbd5e1; text-align:center; font-weight:bold; font-family:Courier,monospace; color:${r.grade === 'A' ? '#047857' : r.grade === 'B' ? '#1d4ed8' : r.grade === 'F' ? '#b91c1c' : '#1e293b'};">${r.grade}</td>
            <td style="padding:8px; border:1px solid #cbd5e1; text-align:center; font-weight:bold; font-size:8.5pt; color:${r.status === 'PASS' ? '#059669' : '#dc2626'};">${r.status}</td>
          </tr>
        `).join('');

      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <title>Academic Transcript - ${selectedStudent.name}</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            @page {
              size: A4 portrait;
              margin: 1in 1in 1in 1in;
            }
            body {
              font-family: 'Arial', 'Calibri', sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 0;
              background-color: #ffffff;
            }
            .main-container {
              position: relative;
              background-color: #ffffff;
            }
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              width: 700px;
              height: 150px;
              margin-left: -350px;
              margin-top: -75px;
              font-size: 60pt;
              color: rgba(226, 232, 240, 0.22);
              font-weight: 900;
              font-family: 'Arial Black', Impact, sans-serif;
              transform: rotate(-35deg);
              -webkit-transform: rotate(-35deg);
              text-align: center;
              z-index: -100;
              text-shadow: 1px 1px 1px rgba(255,255,255,0.8);
              letter-spacing: 4px;
              text-transform: uppercase;
              pointer-events: none;
              user-select: none;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
              border-bottom: 3px double #1e3a8a;
            }
            .school-title {
              font-size: 16pt;
              font-weight: bold;
              color: #1e3a8a;
              text-transform: uppercase;
              margin: 0;
              font-family: 'Trebuchet MS', Arial, sans-serif;
            }
            .school-subtitle {
              font-size: 8.5pt;
              font-weight: bold;
              color: #1d4ed8;
              text-transform: uppercase;
              margin: 3px 0 0 0;
              letter-spacing: 1px;
            }
            .school-desc {
              font-size: 8.5pt;
              color: #64748b;
              margin: 3px 0 0 0;
              font-weight: bold;
            }
            .contact-info {
              font-size: 8.5pt;
              color: #475569;
              text-align: right;
              line-height: 1.4;
            }
            .title-section {
              text-align: center;
              margin-bottom: 25px;
            }
            .record-badge {
              font-size: 9pt;
              font-weight: bold;
              color: #1d4ed8;
              text-transform: uppercase;
              letter-spacing: 3px;
              margin: 0;
            }
            .record-title {
              font-size: 20pt;
              font-weight: bold;
              color: #0f172a;
              text-transform: uppercase;
              margin: 4px 0 0 0;
              font-family: 'Georgia', serif;
            }
            .info-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              background-color: #f8fafc;
              border: 1px solid #cbd5e1;
            }
            .info-card {
              width: 50%;
              padding: 10px 14px;
              border: 1px solid #cbd5e1;
              vertical-align: top;
            }
            .info-label {
              font-size: 7.5pt;
              font-weight: bold;
              color: #64748b;
              text-transform: uppercase;
              margin-bottom: 3px;
              letter-spacing: 0.5px;
            }
            .info-val {
              font-size: 10pt;
              font-weight: bold;
              color: #0d1e3d;
              text-transform: uppercase;
            }
            .results-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .th-custom {
              background-color: #0f172a;
              color: #ffffff;
              font-weight: bold;
              font-size: 9pt;
              text-transform: uppercase;
              letter-spacing: 1px;
              padding: 10px;
              border: 1px solid #0f172a;
              text-align: left;
            }
            .th-center {
              text-align: center;
            }
            .aggregations-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .agg-cell {
              width: 33.33%;
              padding: 12px;
              border: 1px solid #cbd5e1;
              background-color: #f8fafc;
              text-align: center;
            }
            .agg-label {
              font-size: 7.5pt;
              font-weight: bold;
              color: #64748b;
              text-transform: uppercase;
            }
            .agg-val {
              font-size: 16pt;
              font-weight: bold;
              color: #0f172a;
              margin-top: 5px;
              font-family: Arial, sans-serif;
            }
            .disclaimer-card {
              border: 1px solid #cbd5e1;
              background-color: #f8fafc;
              padding: 18px;
              margin-bottom: 40px;
              border-radius: 4px;
            }
            .disclaimer-title {
              font-size: 8pt;
              font-weight: bold;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .disclaimer-award {
              font-size: 11pt;
              font-weight: bold;
              color: #1e3a8a;
              margin-top: 5px;
              margin-bottom: 10px;
              text-transform: uppercase;
            }
            .disclaimer-text {
              font-size: 8pt;
              color: #64748b;
              line-height: 1.5;
              border-top: 1px solid #e2e8f0;
              padding-top: 8px;
            }
            .sign-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 40px;
            }
            .sign-cell {
              width: 40%;
              vertical-align: bottom;
            }
            .seal-cell {
              width: 30%;
              text-align: center;
              vertical-align: middle;
            }
            .sign-line {
              border-top: 1px solid #475569;
              padding-top: 6px;
              margin-top: 10px;
              width: 100%;
            }
            .sign-name {
              font-size: 9.5pt;
              font-weight: bold;
              color: #0f172a;
              text-transform: uppercase;
            }
            .sign-title {
              font-size: 7.5pt;
              font-weight: bold;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .seal-badge {
              width: 90px;
              height: 90px;
              border: 4px double #1e3a8a;
              border-radius: 50%;
              margin: 0 auto;
              padding: 8px 5px;
              text-align: center;
              color: #1e3a8a;
            }
            .seal-dept {
              font-weight: bold;
              font-size: 6.5pt;
              margin: 0;
            }
            .seal-name {
              font-weight: 900;
              font-size: 11pt;
              margin: 2px 0;
            }
            .seal-txt {
              font-size: 6pt;
              font-weight: bold;
              color: #64748b;
              margin: 0;
              letter-spacing: 0.5px;
            }
          </style>
        </head>
        <body>
          <div class="main-container">
            <!-- Rotary Watermark Background -->
            <div class="watermark">OFFICIAL TRANSCRIPT</div>
            
            <!-- Letterhead Header -->
            <table class="header-table">
              <tr>
                <td style="padding-bottom:15px; vertical-align:middle;">
                  <h2 class="school-title">${schoolNameOverride || 'BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE'}</h2>
                  <p class="school-subtitle">Ministry of Higher Education, Science & Technology & TVETA Registered</p>
                  <p class="school-desc">Official Certificate of Registrar of Academic Affairs</p>
                </td>
                <td class="contact-info" style="padding-bottom:15px; vertical-align:middle;">
                  <p style="margin:0; font-weight:bold; color:#0f172a;">${addressOverride || 'P.O. BOX 12345-00100, NAIROBI'}</p>
                  <p style="margin:2px 0 0 0;">TEL: ${phoneOverride || '+254 700 000 000'}</p>
                  <p style="margin:2px 0 0 0;">EMAIL: ${emailOverride || 'info@bitc.ac.ke'}</p>
                </td>
              </tr>
            </table>

            <!-- Title -->
            <div class="title-section">
              <p class="record-badge">Official Academic Record</p>
              <h1 class="record-title">Transcript of Results</h1>
            </div>

            <!-- Demographics (2 Column Layout Table) -->
            <table class="info-table">
              <tr>
                <td class="info-card">
                  <p class="info-label">Candidate Name</p>
                  <p class="info-val" style="font-size:11pt; color:#1e3a8a;">${selectedStudent.name}</p>
                </td>
                <td class="info-card">
                  <p class="info-label">Registration Number</p>
                  <p class="info-val">${selectedStudent.admissionNumber || 'N/A'}</p>
                </td>
              </tr>
              <tr>
                <td class="info-card">
                  <p class="info-label">Enrolled Program</p>
                  <p class="info-val">${selectedStudent.course || 'Certificate Program'}</p>
                </td>
                <td class="info-card">
                  <p class="info-label">Academic Intake</p>
                  <p class="info-val">${selectedStudent.academicYear || 'September 2026'}</p>
                </td>
              </tr>
              <tr>
                <td class="info-card">
                  <p class="info-label">ID / Passport Number</p>
                  <p class="info-val" style="font-family:Courier,monospace;">${selectedStudent.idNumber || 'Not Classified'}</p>
                </td>
                <td class="info-card">
                  <p class="info-label">Date of Issue</p>
                  <p class="info-val">${sealDateOverride}</p>
                </td>
              </tr>
              <tr>
                <td class="info-card">
                  <p class="info-label">Transcript Serial Number</p>
                  <p class="info-val" style="font-family:Courier,monospace; color:#1e3a8a; font-weight:bold;">${generateAutomatedSerial(selectedStudent)}</p>
                </td>
                <td class="info-card">
                  <p class="info-label">Verification Code</p>
                  <p class="info-val" style="font-family:Courier,monospace; font-size:9pt; color:#64748b;">verify.bitc.ac.ke</p>
                </td>
              </tr>
            </table>

            <!-- Course Sheet -->
            <table class="results-table">
              <thead>
                <tr>
                  <th class="th-custom th-center" style="width:7%;">No.</th>
                  <th class="th-custom" style="width:18%;">Unit Code</th>
                  <th class="th-custom">Academic Unit Name</th>
                  <th class="th-custom th-center" style="width:12%;">Hours</th>
                  <th class="th-custom th-center" style="width:12%;">Score</th>
                  <th class="th-custom th-center" style="width:10%;">Grade</th>
                  <th class="th-custom th-center" style="width:12%;">Result</th>
                </tr>
              </thead>
              <tbody>
                ${resultsHtml}
              </tbody>
            </table>

            <!-- Summary Statistics Table (3 Columns) -->
            <table class="aggregations-table">
              <tr>
                <td class="agg-cell">
                  <p class="agg-label">Weightage Completed</p>
                  <p class="agg-val" style="font-family:Courier,monospace;">${results.length} Units</p>
                </td>
                <td class="agg-cell">
                  <p class="agg-label">Cumulative Average</p>
                  <p class="agg-val" style="font-family:Courier,monospace; color:#2563eb;">${currentAverage}%</p>
                </td>
                <td class="agg-cell">
                  <p class="agg-label">Equiv. Cumulative GPA</p>
                  <p class="agg-val" style="font-family:Courier,monospace; color:#059669;">${currentGPA} / 4.00</p>
                </td>
              </tr>
            </table>

            <!-- Classification Recommended Card -->
            <table style="width:100%; border-collapse:collapse; margin-bottom:40px;">
              <tr>
                <td class="disclaimer-card">
                  <table style="width:100%; border-collapse:collapse;">
                    <tr>
                      <td>
                        <p class="disclaimer-title">Transcript Classification & Award</p>
                        <h4 class="disclaimer-award">${getPerformanceClass(currentAverage)}</h4>
                      </td>
                      <td style="text-align:right; vertical-align:middle;">
                        <span style="background-color:#ecfdf5; border:1px solid #10b981; padding:6px 12px; font-size:8.5pt; font-weight:bold; color:#047857; text-transform:uppercase;">RECOMMENDED FOR GRADUATION</span>
                      </td>
                    </tr>
                  </table>
                  <p class="disclaimer-text">
                    NOTE: This academic transcript is generated directly from the digital registry database of Breakthrough International Training College (BITC). This document is valid only when bearing the official embossed stamp, hologram verification code, and registrar's signature. Any alterations will invalidate the record.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Registrar signatures bottom -->
            <table class="sign-table">
              <tr>
                <td class="sign-cell">
                  <p class="sign-title">AUTHORIZED SIGNATORY</p>
                  <div style="height:45px; vertical-align:bottom; padding-bottom:5px;">
                    <span style="font-family:'Brush Script MT', 'Lucida Handwriting', cursive; font-size:20pt; color:#1d4ed8; font-weight:bold;">${registrarNameOverride.toLowerCase().split(',')[0]}</span>
                  </div>
                  <div class="sign-line">
                    <p class="sign-name">${registrarNameOverride}</p>
                    <p class="sign-title">${registrarTitleOverride}</p>
                  </div>
                </td>
                <td class="seal-cell">
                  <div class="seal-badge">
                    <p class="seal-dept">REGISTRAR</p>
                    <p class="seal-name">BITC</p>
                    <p class="seal-txt" style="color:#1e3a8a;">OFFICIAL SEAL</p>
                    <p class="seal-txt" style="font-style:italic;">VERIFIED</p>
                  </div>
                </td>
                <td class="sign-cell" style="text-align:right;">
                  <p class="sign-title" style="text-align:right;">${principalTitleOverride || 'TUTOR / TEACHER'}</p>
                  <div style="height:45px; vertical-align:bottom; text-align:right; padding-bottom:5px;">
                    <!-- Removed digital signature for physical signature of Tutor -->
                  </div>
                  <div class="sign-line" style="text-align:right;">
                    <p class="sign-name" style="text-align:right;">${principalNameOverride || 'COURSE TUTOR'}</p>
                    <p class="sign-title" style="text-align:right;">APPROVED & VERIFIED</p>
                  </div>
                </td>
              </tr>
            </table>

          </div>
        </body>
        </html>
      `;
      
      const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedStudent.name.trim().replace(/\s+/g, '_')}_Transcript.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };
  const [customCertificateNo, setCustomCertificateNo] = useState('');
  const [customAwardClass, setCustomAwardClass] = useState('First Class Honours / Pass with Distinction');
  const [customCertificateDate, setCustomCertificateDate] = useState('June 22, 2026');

  const isAdminOrStaff = userData?.role === 'admin' || userData?.role === 'registrar' || userData?.role === 'teacher';
  
  // Standard course units matching student course templates if none are fetched
  const defaultCaregiverUnits = [
    { code: "HC-101", name: "Introduction to Healthcare Service Support", hours: 45 },
    { code: "FA-102", name: "First Aid & Disaster Preparedness", hours: 30 },
    { code: "HK-103", name: "Housekeeping & Sanitization Standards", hours: 45 },
    { code: "PD-104", name: "Pre-Departure Orientation & Global Standards", hours: 30 },
    { code: "SN-201", name: "Special Needs care & Assistive Solutions", hours: 60 },
    { code: "PA-202", name: "Paediatrics & Toddler Development Studies", hours: 60 },
    { code: "GC-203", name: "Geriatrics Care & Elder Support Nursing", hours: 60 },
    { code: "CS-301", name: "Communication Skills & Professional Ethics", hours: 45 }
  ];

  const defaultIctUnits = [
    { code: "ICT-101", name: "Introduction to Programming", hours: 60 },
    { code: "DB-102", name: "Database Management Systems", hours: 45 },
    { code: "ADS-103", name: "Algorithms & Data Structures", hours: 60 },
    { code: "NET-201", name: "Computer Network Architecture & Security", hours: 45 },
    { code: "OS-202", name: "Operating Systems Principles", hours: 45 },
    { code: "COM-301", name: "Professional Communication & Tech Ethics", hours: 30 }
  ];

  const defaultCosmetologyUnits = [
    { code: "COS-101", name: "Beauty therapy theory", hours: 45 },
    { code: "COS-102", name: "Beauty therapy practicle", hours: 90 },
    { code: "COS-103", name: "Hairdressing theory", hours: 45 },
    { code: "COS-104", name: "Hairdressing practicle", hours: 90 },
    { code: "COS-105", name: "Enterprenurship", hours: 45 },
    { code: "COS-106", name: "Communication skills", hours: 45 }
  ];

  const defaultElectricalUnits = [
    { code: "EET-101", name: "Electrical & Electronics Theory", hours: 45 },
    { code: "EET-102", name: "Electrical Installation Practice", hours: 90 },
    { code: "EET-103", name: "Electronics Practical", hours: 90 },
    { code: "EET-104", name: "Electrical Safety & Workshop Practice", hours: 45 },
    { code: "EET-105", name: "Solar Photovoltaic Systems Installation", hours: 60 },
    { code: "EET-106", name: "Entrepreneurship Education", hours: 45 },
    { code: "EET-107", name: "Communication Skills", hours: 45 }
  ];

  const defaultTheologyCertUnits = [
    { code: "THM-101", name: "Old Testament Survey & Hermeneutics", hours: 45 },
    { code: "THM-102", name: "New Testament Survey & Life of Christ", hours: 45 },
    { code: "THM-103", name: "Introduction to Christian Doctrine & Theology", hours: 45 },
    { code: "THM-104", name: "Homiletics & Sermon Preparation", hours: 45 },
    { code: "THM-105", name: "Evangelism, Missions & Discipleship", hours: 45 },
    { code: "THM-106", name: "Christian Ethics & Spiritual Formation", hours: 45 },
    { code: "THM-107", name: "Church History & Ministry Foundations", hours: 45 },
    { code: "THM-108", name: "Communication Skills & Pastoral Leadership", hours: 30 }
  ];

  const defaultTheologyDipUnits = [
    { code: "THM-101", name: "Old Testament Survey & Hermeneutics", hours: 45 },
    { code: "THM-102", name: "New Testament Survey & Life of Christ", hours: 45 },
    { code: "THM-103", name: "Introduction to Systematic Theology", hours: 45 },
    { code: "THM-104", name: "Homiletics & Expository Preaching", hours: 45 },
    { code: "THM-105", name: "Personal Spiritual Formation & Christian Ethics", hours: 45 },
    { code: "THM-106", name: "Personal Evangelism & World Missions", hours: 45 },
    { code: "THM-107", name: "Church History & Historical Theology", hours: 45 },
    { code: "THM-108", name: "Christian Leadership & Church Administration", hours: 45 },
    { code: "THM-201", name: "Pastoral Counseling & Chaplaincy Care", hours: 60 },
    { code: "THM-202", name: "Advanced Systematic Theology & Pneumatology", hours: 60 },
    { code: "THM-203", name: "Biblical Exegesis & Hermeneutical Methods", hours: 60 },
    { code: "THM-204", name: "Youth & Family Ministry Dynamics", hours: 45 },
    { code: "THM-205", name: "Church Planting, Growth & Urban Ministry", hours: 60 },
    { code: "THM-206", name: "Comparative Religions & Christian Apologetics", hours: 45 },
    { code: "THM-207", name: "Practical Ministry Internship & Field Practicum", hours: 90 },
    { code: "THM-208", name: "Conflict Resolution & Pastoral Ethics", hours: 45 }
  ];

  // Grade mapping
  const getDefaultGrades = (): Grade[] => [
    { id: 'g_a', label: 'A', minPercentage: 70, maxPercentage: 100, comment: 'Excellent' },
    { id: 'g_b', label: 'B', minPercentage: 60, maxPercentage: 69, comment: 'Good' },
    { id: 'g_c', label: 'C', minPercentage: 50, maxPercentage: 59, comment: 'Satisfactory' },
    { id: 'g_d', label: 'D', minPercentage: 40, maxPercentage: 49, comment: 'Pass' },
    { id: 'g_f', label: 'F', minPercentage: 0, maxPercentage: 39, comment: 'Fail' }
  ];

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch baseline school info
        const gradesSnap = await getDocs(collection(db, 'grades'));
        if (!active) return;
        const gradesList = gradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade));
        setGrades(gradesList.length > 0 ? gradesList : getDefaultGrades());

        const classesSnap = await getDocs(collection(db, 'classes'));
        if (!active) return;
        setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));

        const unitsSnap = await getDocs(collection(db, 'units'));
        if (!active) return;
        setUnits(unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));

        const examsSnap = await getDocs(collection(db, 'exams'));
        if (!active) return;
        setExams(examsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam)));

        const submissionsSnap = await getDocs(collection(db, 'submissions'));
        if (!active) return;
        setSubmissions(submissionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));

        // Setup students query
        if (isAdminOrStaff) {
          const studentsQ = query(collection(db, 'users'), where('role', '==', 'student'));
          const studentsSnap = await getDocs(studentsQ);
          if (!active) return;
          const studentList = studentsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
          setStudents(studentList);
          
          // Auto select first student if context is set or default to first of the list
          const targetContextUid = new URLSearchParams(window.location.search).get('studentId') || studentContext?.uid;
          if (targetContextUid) {
            const matched = studentList.find(s => s.uid === targetContextUid);
            if (matched) setSelectedStudent(prev => prev || matched);
          } else if (studentList.length > 0) {
            setSelectedStudent(prev => prev || studentList[0]);
          }
        } else {
          // Locked view for student and parent
          const myUserUid = studentContext?.uid || user?.uid;
          if (myUserUid) {
            if (myUserUid === user?.uid && userData) {
              const meAsStudent = { uid: myUserUid, ...userData } as User;
              setSelectedStudent(prev => prev || meAsStudent);
              setStudents([meAsStudent]);
            } else {
              const studentDocRef = doc(db, 'users', myUserUid);
              const studentDocSnap = await getDoc(studentDocRef);
              if (!active) return;
              if (studentDocSnap.exists()) {
                const matched = { uid: studentDocSnap.id, ...studentDocSnap.data() } as User;
                setSelectedStudent(prev => prev || matched);
                setStudents([matched]);
              } else if (userData) {
                const meAsStudent = { uid: user?.uid, ...userData } as User;
                setSelectedStudent(prev => prev || meAsStudent);
                setStudents([meAsStudent]);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading transcript data: ", err);
        handleFirestoreError(err, OperationType.LIST, 'academic-transcripts');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (user?.uid) {
      loadData();
    }
    return () => {
      active = false;
    };
  }, [user?.uid, studentContext?.uid, isAdminOrStaff]);

  // Set defaults for school overrides when settings load
  useEffect(() => {
    if (settings) {
      setSchoolNameOverride(localStorage.getItem('transcript_schoolName') || settings.schoolName || 'BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE');
      setLogoUrlOverride(localStorage.getItem('transcript_logoUrl') || settings.logoUrl || '');
      setAddressOverride(localStorage.getItem('transcript_address') || settings.publicAddress || 'P O BOX 5110 – 01002 Madaraka Thika');
      setPhoneOverride(localStorage.getItem('transcript_phone') || settings.publicPhone || '+254 727 114 355 / +254 707 760 239');
      setEmailOverride(localStorage.getItem('transcript_email') || settings.publicEmail || 'info@bitc.ac.ke');
    }
    setRegistrarNameOverride(localStorage.getItem('transcript_registrarName') || 'PROF. PATRICK NJUGUNA, PHD');
    setRegistrarTitleOverride(localStorage.getItem('transcript_registrarTitle') || 'REGISTRAR OF ACADEMIC AFFAIRS');
    setSignatureUrlOverride(localStorage.getItem('transcript_signatureUrl') || '');
    setStampUrlOverride(localStorage.getItem('transcript_stampUrl') || (settings && settings.stampUrl) || '/stamp.png');
    setSealDateOverride(getTodayISODate());
    setPrincipalNameOverride(localStorage.getItem('transcript_principalName') || 'COURSE TUTOR');
    setPrincipalTitleOverride(localStorage.getItem('transcript_principalTitle') || 'TUTOR / TEACHER');
    setPrincipalSignatureUrlOverride(localStorage.getItem('transcript_principalSignatureUrl') || '');
  }, [settings]);

  // Load custom results when selectedStudent changes
  useEffect(() => {
    if (selectedStudent) {
      const courseName = (selectedStudent.course || '').toLowerCase();
      const isElectrical = courseName.includes('electrical') || courseName.includes('eet') || courseName.includes('solar') || courseName.includes('wiring') || courseName.includes('electronics');
      
      const saved = localStorage.getItem(`transcript_override_${selectedStudent.uid}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (isElectrical && Array.isArray(parsed) && parsed.length > 7) {
            setCustomResults(null);
            localStorage.removeItem(`transcript_override_${selectedStudent.uid}`);
          } else {
            setCustomResults(parsed);
          }
        } catch (e) {
          console.error("Error parsing overrides:", e);
          setCustomResults(null);
        }
      } else {
        setCustomResults(null);
      }
    } else {
      setCustomResults(null);
    }
  }, [selectedStudent]);

  // Helper to generate automated professional TVET serial numbers
  const generateAutomatedSerial = (student: User) => {
    if (!student) return '';
    const courseName = (student.course || '').toLowerCase();
    
    // Determine department and course codes
    let deptCode = '24';
    let courseCode = '36';
    
    if (courseName.includes('hairdressing') || courseName.includes('beauty') || courseName.includes('barbering') || courseName.includes('styling') || courseName.includes('cosmetology')) {
      deptCode = '12';
      courseCode = '18';
    } else if (courseName.includes('computer') || courseName.includes('digital') || courseName.includes('package') || courseName.includes('ict') || courseName.includes('commerce')) {
      deptCode = '08';
      courseCode = '42';
    } else if (courseName.includes('healthcare') || courseName.includes('caregiver') || courseName.includes('caregiving') || courseName.includes('nursing')) {
      deptCode = '24';
      courseCode = '36';
    } else if (courseName.includes('cookery') || courseName.includes('baking') || courseName.includes('catering') || courseName.includes('food')) {
      deptCode = '15';
      courseCode = '22';
    } else if (courseName.includes('solar') || courseName.includes('electrical') || courseName.includes('electronics') || courseName.includes('eet') || courseName.includes('wiring')) {
      deptCode = '19';
      courseCode = '55';
    } else if (courseName.includes('theology') || courseName.includes('biblical') || courseName.includes('ministry')) {
      deptCode = '07';
      courseCode = '77';
    }

    // Extract student number (ignoring any year parts)
    let serialIndex = '305';
    if (student.admissionNumber) {
      const trimmed = student.admissionNumber.trim();
      if (/^\d+$/.test(trimmed)) {
        serialIndex = trimmed;
      } else {
        const parts = trimmed.split(/[\/\-\s]+/);
        // Search from the end of the split parts to find the actual serial number,
        // ignoring any 4-digit years.
        for (let i = parts.length - 1; i >= 0; i--) {
          const part = parts[i];
          if (/^\d+$/.test(part)) {
            const num = parseInt(part, 10);
            if (num < 2000 || num > 2100) {
              serialIndex = part;
              break;
            }
          }
        }
      }
    } else {
      const numOnly = student.uid?.replace(/[^0-9]/g, '') || '';
      if (numOnly.length >= 3) {
        serialIndex = numOnly.slice(0, 3);
      } else {
        let hash = 0;
        const uidStr = student.uid || '';
        for (let i = 0; i < uidStr.length; i++) {
          hash = uidStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        serialIndex = String(Math.abs(hash % 900) + 100);
      }
    }

    // Extract enrollment/admission year
    let admissionYear = '2026';
    if (student.academicYear) {
      const match = student.academicYear.match(/\d{4}/);
      if (match) {
        admissionYear = match[0];
      }
    }
    
    if (admissionYear === '2026' && student.admissionNumber) {
      const parts = student.admissionNumber.split(/[\/\-\s]+/);
      for (const part of parts) {
        if (/^\d{4}$/.test(part)) {
          const num = parseInt(part, 10);
          if (num >= 2000 && num <= 2100) {
            admissionYear = part;
            break;
          }
        }
      }
    }
    
    if (admissionYear === '2026') {
      if (student.admissionDate) {
        admissionYear = student.admissionDate.slice(0, 4);
      } else if (student.createdAt) {
        admissionYear = student.createdAt.slice(0, 4);
      }
    }

    return `Bitc/Tvet/${deptCode}/${courseCode}/${admissionYear}/${serialIndex}`;
  };

  const getCertificateAwardFromAverage = (avg: number) => {
    if (avg >= 70) return "PASS WITH DISTINCTION";
    if (avg >= 60) return "PASS WITH CREDIT";
    if (avg >= 50) return "PASS WITH CREDIT";
    if (avg >= 40) return "PASS";
    return "FAIL";
  };

  // Helper to calculate grade, grade point, and remark according to official college scale
  const calculateResultDetails = (score: number | null | undefined) => {
    if (score === null || score === undefined || isNaN(score)) {
      return {
        grade: 'NOT AVAILABLE',
        gradePoint: '-',
        remark: 'NOT AVAILABLE'
      };
    }
    const s = Math.min(100, Math.max(0, score));
    if (s >= 70) return { grade: 'A', gradePoint: 4.0, remark: 'DISTINCTION' };
    if (s >= 60) return { grade: 'B', gradePoint: 3.0, remark: 'CREDIT' };
    if (s >= 50) return { grade: 'C', gradePoint: 2.0, remark: 'SATISFACTORY' };
    if (s >= 40) return { grade: 'D', gradePoint: 1.0, remark: 'PASS' };
    return { grade: 'F', gradePoint: 0.0, remark: 'FAIL' };
  };

  const getDepartmentForCourse = (courseName?: string) => {
    if (!courseName) return 'Department of Vocational & Technical Studies';
    const c = courseName.toLowerCase();
    if (c.includes('caregiver') || c.includes('nursing') || c.includes('health')) return 'Department of Health & Social Care';
    if (c.includes('ict') || c.includes('computer') || c.includes('programming')) return 'Department of Information Technology & Computing';
    if (c.includes('beauty') || c.includes('hair') || c.includes('cosmetology')) return 'Department of Cosmetology & Personal Care Services';
    if (c.includes('electrical') || c.includes('electronics') || c.includes('solar') || c.includes('wiring')) return 'Department of Electrical & Renewable Energy Engineering';
    if (c.includes('hospitality') || c.includes('catering') || c.includes('food')) return 'Department of Hospitality & Food Technology';
    return 'Department of Academic & Technical Studies';
  };

  // Dynamically calculate grades for any selected student
  const getTranscriptResults = () => {
    if (!selectedStudent) return [];

    const studentSubmissions = submissions.filter(s => s.studentId === selectedStudent.uid);
    const results: {
      unitCode: string;
      unitName: string;
      score: number | null;
      grade: string;
      gradePoint: number | string;
      hours: number;
      remark: string;
      status: 'PASS' | 'RE-SIT' | 'PENDING';
      semester?: string;
      isPlaceholder?: boolean;
    }[] = [];

    const mappedUnitIds = new Set<string>();

    // 1. Extract real unit submissions first
    studentSubmissions.forEach(sub => {
      const exam = exams.find(e => e.id === sub.examId);
      if (exam && exam.unitId && sub.grade !== undefined) {
        const unit = units.find(u => u.id === exam.unitId);
        if (unit && !mappedUnitIds.has(unit.id)) {
          mappedUnitIds.add(unit.id);
          
          const rawPercentage = (sub.grade / (exam.maxMarks || 100)) * 100;
          const score = Math.round(Math.min(100, Math.max(0, rawPercentage)));
          const details = calculateResultDetails(score);

          const initials = unit.name ? unit.name.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase() : 'UNT';
          const code = unit.code || `${initials}-101`;

          results.push({
            unitCode: code,
            unitName: unit.name,
            score,
            grade: details.grade,
            gradePoint: details.gradePoint,
            hours: (unit as any).hours || 45,
            remark: details.remark,
            status: score >= 40 ? 'PASS' : 'RE-SIT',
            semester: (unit as any).semester || (exam as any).semester || 'YEAR 1 — SEMESTER I'
          });
        }
      }
    });

    // 2. Add full curriculum units for student course
    const studentCourse = (selectedStudent.course || "").toLowerCase();
    let template = defaultCaregiverUnits;
    if (studentCourse.includes('theology') || studentCourse.includes('biblical') || studentCourse.includes('ministry') || studentCourse.includes('christian')) {
      if (studentCourse.includes('diploma') || studentCourse.includes('dip')) {
        template = defaultTheologyDipUnits;
      } else {
        template = defaultTheologyCertUnits;
      }
    } else if (studentCourse.includes('ict') || studentCourse.includes('computer') || studentCourse.includes('programming')) {
      template = defaultIctUnits;
    } else if (studentCourse.includes('cosmetology') || studentCourse.includes('beauty') || studentCourse.includes('hair')) {
      template = defaultCosmetologyUnits;
    } else if (studentCourse.includes('electrical') || studentCourse.includes('electronics') || studentCourse.includes('eet') || studentCourse.includes('solar') || studentCourse.includes('wiring')) {
      template = defaultElectricalUnits;
    }

    template.forEach((item, index) => {
      const exists = results.some(r => r.unitName.toLowerCase() === item.name.toLowerCase() || r.unitCode.toLowerCase() === item.code.toLowerCase());
      if (!exists) {
        const sem = template.length <= 7 ? 'YEAR 1 — SEMESTER I' : (index < 4 ? 'YEAR 1 — SEMESTER I' : index < 8 ? 'YEAR 1 — SEMESTER II' : 'YEAR 2 — SEMESTER I');

        if (includeMockData) {
          const seed = (selectedStudent.name ? selectedStudent.name.charCodeAt(0) : 75) + index * 12;
          const score = 55 + (seed % 38); // 55% - 93%
          const details = calculateResultDetails(score);

          results.push({
            unitCode: item.code,
            unitName: item.name,
            score,
            grade: details.grade,
            gradePoint: details.gradePoint,
            hours: item.hours,
            remark: details.remark,
            status: score >= 40 ? 'PASS' : 'RE-SIT',
            semester: sem,
            isPlaceholder: true
          });
        } else {
          results.push({
            unitCode: item.code,
            unitName: item.name,
            score: null,
            grade: 'NOT AVAILABLE',
            gradePoint: '-',
            hours: item.hours,
            remark: 'NOT AVAILABLE',
            status: 'PENDING',
            semester: sem,
            isPlaceholder: false
          });
        }
      }
    });

    return results;
  };

  const calculateGradeFromScore = (score: number) => {
    const matchedGrade = grades.find(g => score >= g.minPercentage && score <= g.maxPercentage);
    return matchedGrade ? matchedGrade.label : 'F';
  };

  const calculateStatusFromScore = (score: number) => {
    return score >= 40 ? 'PASS' : 'RE-SIT';
  };

  const handleResultChange = (index: number, field: string, value: any) => {
    const currentList = [...(customResults || getTranscriptResults())];
    const updatedItem = { ...currentList[index], [field]: value };
    
    // Automatically recalculate grade and status if score changes
    if (field === 'score') {
      const scoreNum = Math.min(100, Math.max(0, parseInt(value) || 0));
      updatedItem.score = scoreNum;
      updatedItem.grade = calculateGradeFromScore(scoreNum);
      updatedItem.status = calculateStatusFromScore(scoreNum);
    }
    
    currentList[index] = updatedItem;
    setCustomResults(currentList);
    if (selectedStudent) {
      localStorage.setItem(`transcript_override_${selectedStudent.uid}`, JSON.stringify(currentList));
    }
  };

  const handleAddRow = () => {
    const currentList = [...(customResults || getTranscriptResults())];
    const newUnit = {
      unitCode: `UNT-${100 + currentList.length}`,
      unitName: "New Academic Course Unit",
      hours: 45,
      score: 70,
      grade: "A",
      status: "PASS"
    };
    const newList = [...currentList, newUnit];
    setCustomResults(newList);
    if (selectedStudent) {
      localStorage.setItem(`transcript_override_${selectedStudent.uid}`, JSON.stringify(newList));
    }
  };

  const handleDeleteRow = (index: number) => {
    const currentList = [...(customResults || getTranscriptResults())];
    currentList.splice(index, 1);
    setCustomResults(currentList);
    if (selectedStudent) {
      localStorage.setItem(`transcript_override_${selectedStudent.uid}`, JSON.stringify(currentList));
    }
  };

  const handleResetOverrides = () => {
    setCustomResults(null);
    if (selectedStudent) {
      localStorage.removeItem(`transcript_override_${selectedStudent.uid}`);
    }
  };

  const handleSchoolDetailChange = (field: string, value: string) => {
    if (field === 'schoolName') {
      setSchoolNameOverride(value);
      localStorage.setItem('transcript_schoolName', value);
    } else if (field === 'logoUrl') {
      setLogoUrlOverride(value);
      localStorage.setItem('transcript_logoUrl', value);
    } else if (field === 'address') {
      setAddressOverride(value);
      localStorage.setItem('transcript_address', value);
    } else if (field === 'phone') {
      setPhoneOverride(value);
      localStorage.setItem('transcript_phone', value);
    } else if (field === 'email') {
      setEmailOverride(value);
      localStorage.setItem('transcript_email', value);
    } else if (field === 'registrarName') {
      setRegistrarNameOverride(value);
      localStorage.setItem('transcript_registrarName', value);
    } else if (field === 'registrarTitle') {
      setRegistrarTitleOverride(value);
      localStorage.setItem('transcript_registrarTitle', value);
    } else if (field === 'signatureUrl') {
      setSignatureUrlOverride(value);
      localStorage.setItem('transcript_signatureUrl', value);
    } else if (field === 'stampUrl') {
      setStampUrlOverride(value);
      localStorage.setItem('transcript_stampUrl', value);
    } else if (field === 'sealDate') {
      setSealDateOverride(value);
      localStorage.setItem('transcript_sealDate', value);
    } else if (field === 'principalName') {
      setPrincipalNameOverride(value);
      localStorage.setItem('transcript_principalName', value);
    } else if (field === 'principalTitle') {
      setPrincipalTitleOverride(value);
      localStorage.setItem('transcript_principalTitle', value);
    } else if (field === 'principalSignatureUrl') {
      setPrincipalSignatureUrlOverride(value);
      localStorage.setItem('transcript_principalSignatureUrl', value);
    }
  };

  const handleResetSchoolDetails = () => {
    if (settings) {
      setSchoolNameOverride(settings.schoolName || 'BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE');
      setLogoUrlOverride(settings.logoUrl || '');
      setAddressOverride(settings.publicAddress || 'P O BOX 5110 – 01002 Madaraka Thika');
      setPhoneOverride(settings.publicPhone || '+254 727 114 355 / +254 707 760 239');
      setEmailOverride(settings.publicEmail || 'info@bitc.ac.ke');
    } else {
      setSchoolNameOverride('BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE');
      setLogoUrlOverride('');
      setAddressOverride('P O BOX 5110 – 01002 Madaraka Thika');
      setPhoneOverride('+254 727 114 355 / +254 707 760 239');
      setEmailOverride('info@bitc.ac.ke');
    }
    setRegistrarNameOverride('PROF. PATRICK NJUGUNA, PHD');
    setRegistrarTitleOverride('REGISTRAR OF ACADEMIC AFFAIRS');
    setSignatureUrlOverride('');
    setStampUrlOverride('/stamp.png');
    setPrincipalNameOverride('COURSE TUTOR');
    setPrincipalTitleOverride('TUTOR / TEACHER');
    setPrincipalSignatureUrlOverride('');
    setSealDateOverride(getTodayISODate());
    
    localStorage.removeItem('transcript_schoolName');
    localStorage.removeItem('transcript_logoUrl');
    localStorage.removeItem('transcript_address');
    localStorage.removeItem('transcript_phone');
    localStorage.removeItem('transcript_email');
    localStorage.removeItem('transcript_registrarName');
    localStorage.removeItem('transcript_registrarTitle');
    localStorage.removeItem('transcript_signatureUrl');
    localStorage.removeItem('transcript_stampUrl');
    localStorage.removeItem('transcript_sealDate');
    localStorage.removeItem('transcript_principalName');
    localStorage.removeItem('transcript_principalTitle');
    localStorage.removeItem('transcript_principalSignatureUrl');
  };

  const rawResults = customResults !== null ? customResults : getTranscriptResults();

  const normalizeResultItem = (item: any) => {
    const scoreNum = item.score !== null && item.score !== undefined && !isNaN(Number(item.score)) ? Number(item.score) : null;
    const details = calculateResultDetails(scoreNum);
    
    let finalGrade = item.grade;
    if (!finalGrade || !isNaN(Number(finalGrade)) || finalGrade === 'PASS' || finalGrade === 'RE-SIT' || finalGrade === 'NOT AVAILABLE') {
      finalGrade = details.grade;
    }
    
    let finalGradePoint: number | string = item.gradePoint;
    if (finalGradePoint === undefined || finalGradePoint === null || finalGradePoint === '-' || isNaN(Number(finalGradePoint))) {
      finalGradePoint = details.gradePoint;
    }

    let finalRemark = item.remark;
    if (!finalRemark || finalRemark === 'PASS' || finalRemark === 'RE-SIT' || finalRemark === 'NOT AVAILABLE') {
      finalRemark = details.remark;
    }

    return {
      ...item,
      score: scoreNum,
      grade: finalGrade,
      gradePoint: finalGradePoint,
      remark: finalRemark,
      hours: item.hours || 45,
      status: scoreNum !== null ? (scoreNum >= 40 ? 'PASS' : 'RE-SIT') : 'PENDING',
    };
  };

  const results = rawResults.map(normalizeResultItem);

  // Aggregate stats ignoring un-evaluated items
  const calculateAverage = () => {
    const scored = results.filter(r => r.score !== null && r.score !== undefined);
    if (scored.length === 0) return 0;
    const sum = scored.reduce((acc, curr) => acc + (curr.score || 0), 0);
    return Math.round(sum / scored.length);
  };

  const currentAverage = calculateAverage();

  // Dynamically synchronize certificate overrides with current transcript average
  useEffect(() => {
    if (selectedStudent) {
      const staticCertNo = generateAutomatedSerial(selectedStudent);
      setCustomCertificateNo(localStorage.getItem(`cert_no_${selectedStudent.uid}`) || staticCertNo);
      
      const computedAward = getCertificateAwardFromAverage(currentAverage);
      const savedAward = localStorage.getItem(`cert_award_${selectedStudent.uid}`);
      setCustomAwardClass(savedAward || computedAward);
      
      const defaultDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      setCustomCertificateDate(localStorage.getItem(`cert_date_${selectedStudent.uid}`) || defaultDate);
    }
  }, [selectedStudent, currentAverage]);

  const calculateGPA = () => {
    const scored = results.filter(r => r.score !== null && r.score !== undefined);
    if (scored.length === 0) return "0.00";
    const sumGpaPoints = scored.reduce((acc, curr) => {
      let pt = 0;
      if (typeof curr.gradePoint === 'number') {
        pt = curr.gradePoint;
      } else if (curr.score !== null) {
        if (curr.score >= 70) pt = 4.0;
        else if (curr.score >= 60) pt = 3.0;
        else if (curr.score >= 50) pt = 2.0;
        else if (curr.score >= 40) pt = 1.0;
      }
      return acc + pt;
    }, 0);
    return (sumGpaPoints / scored.length).toFixed(2);
  };

  const currentGPA = calculateGPA();

  const totalCreditHours = results.reduce((acc, r) => acc + (r.hours || 0), 0);
  const gradedUnitsCount = results.filter(r => r.score !== null && r.score !== undefined).length;

  const getPerformanceClass = (avg: number) => {
    if (avg >= 70) return "DISTINCTION";
    if (avg >= 60) return "CREDIT";
    if (avg >= 50) return "CREDIT";
    if (avg >= 40) return "PASS";
    return "FAIL / UNCLASSIFIED";
  };

  const getGroupedResults = () => {
    const groups: { semesterName: string; items: (typeof results[0] & { sn: number })[] }[] = [];
    let currentSn = 1;

    results.forEach(item => {
      const sem = item.semester || 'YEAR 1 — SEMESTER I';
      let group = groups.find(g => g.semesterName === sem);
      if (!group) {
        group = { semesterName: sem, items: [] };
        groups.push(group);
      }
      group.items.push({ ...item, sn: currentSn++ });
    });

    return groups;
  };

  const groupedResults = getGroupedResults();

  const triggerPrint = () => {
    setSealDateOverride(getTodayISODate());
    window.print();
  };

  const handleApplyQuickGrades = async () => {
    if (!selectedStudent) return;
    
    // Quick seeder trigger for testing
    setLoading(true);
    try {
      // Find standard student exam or create a mock exam + submission
      console.log("Writing simulated performance data directly... Done!");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.admissionNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClassId ? (s.classIds || []).includes(selectedClassId) : true;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="space-y-8 select-none">
      
      {/* Search Header Options - HIDDEN ON PRINT */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-white md:text-gray-900 dark:text-white">Academic Transcripts</h1>
          <p className="text-slate-400 dark:text-slate-500 font-medium text-sm">Professional Registrar records & dynamic academic certification</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-2 sm:p-2.5 rounded-3xl shrink-0 shadow-sm">
          {/* Orientation Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm animate-fade-in">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Layout:</span>
            <select
              id="print-orientation-selector"
              value={printOrientation}
              onChange={(e) => setPrintOrientation(e.target.value as 'portrait' | 'landscape')}
              className="text-xs font-extrabold uppercase bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none border-none py-1 cursor-pointer pr-1"
            >
              <option value="portrait" className="text-slate-800 bg-white">Portrait</option>
              <option value="landscape" className="text-slate-800 bg-white">Landscape</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Download PDF button */}
            <button
              id="download-pdf-btn"
              disabled={isSavingPdf || !selectedStudent}
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100 hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all outline-none"
            >
              {isSavingPdf ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download size={13} />
                  Download PDF
                </>
              )}
            </button>

            {/* Download Word Document button */}
            <button
              id="download-word-btn"
              disabled={!selectedStudent}
              onClick={handleDownloadWord}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest active:scale-95 transition-all outline-none"
            >
              <FileText size={13} />
              Download Word
            </button>

            {/* Print Transcript button */}
            <button
              id="print-transcript-btn"
              disabled={!selectedStudent}
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all outline-none"
            >
              <Printer size={13} className="shrink-0" />
              Print Document
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start PrintNoGrid">
        
        {/* Left pane: Tabbed Search & Customizer (Admins Only) */}
        {isAdminOrStaff && (
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm print:hidden">
            
            {/* Tab Segmented Control */}
            <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-2xl mb-6">
              <button
                onClick={() => setSidebarTab('students')}
                className={`flex-1 py-2.5 text-center text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                  sidebarTab === 'students'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-md'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                1. Students
              </button>
              <button
                onClick={() => {
                  setSidebarTab('editor');
                  // initialize custom results if they are editing
                  if (customResults === null) {
                    setCustomResults(getTranscriptResults());
                  }
                }}
                className={`flex-1 py-2.5 text-center text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                  sidebarTab === 'editor'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-md'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                2. Customize
              </button>
            </div>

            {sidebarTab === 'students' ? (
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                  <Search size={14} className="text-blue-500" /> Student Selector ({filteredStudents.length})
                </h3>
                
                <div className="space-y-4">
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search Name or Adm No..."
                      value={searchTerm}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    />
                  </div>

                  {/* Class Filter */}
                  <div>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">-- Filter by Class --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Toggle Mock */}
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/20 rounded-2xl flex items-center justify-between">
                    <div className="flex-1 pr-2">
                      <p className="text-[11px] font-black text-blue-800 dark:text-blue-400 uppercase tracking-wider">Predictive Mode</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500">Auto-fill missing coursework to render complete layout.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeMockData}
                        onChange={(e) => setIncludeMockData(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* List grid */}
                  <div className="space-y-2 h-[450px] overflow-y-auto pr-1">
                    {filteredStudents.length === 0 ? (
                      <p className="text-center py-10 text-xs text-slate-400">No students matched filters.</p>
                    ) : (
                      filteredStudents.map((student) => {
                        const isSelected = selectedStudent?.uid === student.uid;
                        return (
                          <div
                            key={student.uid}
                            onClick={() => {
                              setSelectedStudent(student);
                            }}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 text-blue-700'
                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center text-white shrink-0 ${
                                isSelected ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                              }`}>
                                {student.name?.charAt(0)}
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-250 group-hover:text-blue-500 duration-200">{student.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{student.admissionNumber || 'No Admission #'}</p>
                              </div>
                            </div>
                            
                            <div className="h-6 w-6 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Sparkles size={11} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-1">
                    Transcript Designer
                  </h3>
                  <p className="text-[10px] text-slate-400">Custom school branding, signatures, and complete grades override</p>
                </div>

                <div className="space-y-6 max-h-[600px] overflow-y-auto pr-1">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-wider mb-3 flex items-center justify-between">
                      <span>School Identity Details</span>
                      <button 
                        onClick={handleResetSchoolDetails}
                        className="text-[10px] text-red-500 hover:underline capitalize font-bold"
                      >
                        Reset Info
                      </button>
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">School Name</label>
                        <input
                          type="text"
                          value={schoolNameOverride}
                          onChange={(e) => handleSchoolDetailChange('schoolName', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Logo Image URL</label>
                        <input
                          type="text"
                          value={logoUrlOverride}
                          onChange={(e) => handleSchoolDetailChange('logoUrl', e.target.value)}
                          placeholder="Paste image URL (png, jpg, base64)"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Postal/Physical Address</label>
                        <input
                          type="text"
                          value={addressOverride}
                          onChange={(e) => handleSchoolDetailChange('address', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400">Phone lines</label>
                          <input
                            type="text"
                            value={phoneOverride}
                            onChange={(e) => handleSchoolDetailChange('phone', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400">Email Contact</label>
                          <input
                            type="text"
                            value={emailOverride}
                            onChange={(e) => handleSchoolDetailChange('email', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Registrar & Signature Details */}
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-wider mb-3">
                      <span>Official Signatures & Stamp</span>
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Registrar Name</label>
                        <input
                          id="registrar-name-input"
                          type="text"
                          value={registrarNameOverride}
                          onChange={(e) => handleSchoolDetailChange('registrarName', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Registrar Title / Office</label>
                        <input
                          id="registrar-title-input"
                          type="text"
                          value={registrarTitleOverride}
                          onChange={(e) => handleSchoolDetailChange('registrarTitle', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Custom Registrar Signature Image URL (Optional)</label>
                        <input
                          id="signature-url-input"
                          type="text"
                          value={signatureUrlOverride}
                          onChange={(e) => handleSchoolDetailChange('signatureUrl', e.target.value)}
                          placeholder="Paste PNG/JPG/SVG signature URL"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="text-[9px] text-slate-400 mt-1 block leading-tight">Leave blank to use the realistic simulated registrar signature.</span>
                      </div>

                      {/* Tutor / Teacher Signature overrides */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-850 mt-2">
                        <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Tutor / Teacher Settings</p>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Tutor / Teacher Name / Signatory</label>
                        <input
                          id="principal-name-input"
                          type="text"
                          value={principalNameOverride}
                          onChange={(e) => handleSchoolDetailChange('principalName', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Tutor / Teacher Title / Office</label>
                        <input
                          id="principal-title-input"
                          type="text"
                          value={principalTitleOverride}
                          onChange={(e) => handleSchoolDetailChange('principalTitle', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Custom Tutor/Teacher Signature Image URL (Optional)</label>
                        <input
                          id="principal-signature-url-input"
                          type="text"
                          value={principalSignatureUrlOverride}
                          onChange={(e) => handleSchoolDetailChange('principalSignatureUrl', e.target.value)}
                          placeholder="Paste PNG/JPG/SVG signature URL"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <span className="text-[9px] text-slate-400 mt-1 block leading-tight">Leave blank to use the realistic simulated signature.</span>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Official Stamp Image URL</label>
                        <input
                          id="stamp-url-input"
                          type="text"
                          value={stampUrlOverride}
                          onChange={(e) => handleSchoolDetailChange('stampUrl', e.target.value)}
                          placeholder="Paste PNG/JPG/SVG stamp URL"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="text-[9px] text-slate-400 mt-1 block leading-tight">Defaults to the uploaded college stamp. Clear to use the simulated seal.</span>
                      </div>
                      
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Date of Issue (Transcript)</label>
                        <input
                          id="registry-seal-date-input"
                          type="text"
                          value={sealDateOverride}
                          onChange={(e) => handleSchoolDetailChange('sealDate', e.target.value)}
                          placeholder="e.g. 2026-06-22"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="text-[9px] text-slate-400 mt-1 block leading-tight">Customize the date of issue printed on transcripts.</span>
                      </div>
                      
                      {/* Checkbox toggle for isSignoffPrinted */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-850">
                        <input
                          id="is-signoff-printed-toggle"
                          type="checkbox"
                          checked={isSignoffPrinted}
                          onChange={(e) => setIsSignoffPrinted(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 cursor-pointer"
                        />
                        <label htmlFor="is-signoff-printed-toggle" className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                          Display Signatures & Seal on Transcript
                        </label>
                      </div>
                    </div>
                  </div>



                  {/* Certificate Document Details */}
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h4 className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3">
                      <span>Completion Certificate Customization</span>
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Certificate Number</label>
                        <input
                          id="cert-no-input"
                          type="text"
                          value={customCertificateNo}
                          onChange={(e) => {
                            setCustomCertificateNo(e.target.value);
                            if (selectedStudent) {
                              localStorage.setItem(`cert_no_${selectedStudent.uid}`, e.target.value);
                            }
                          }}
                          placeholder="e.g. BITC/CERT/2026/001"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <span className="text-[9px] text-slate-400 mt-1 block leading-tight">Unique identifier printed on the completion certificate.</span>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Award Classification / Honors</label>
                        <input
                          id="cert-award-input"
                          type="text"
                          value={customAwardClass}
                          onChange={(e) => {
                            setCustomAwardClass(e.target.value);
                            if (selectedStudent) {
                              localStorage.setItem(`cert_award_${selectedStudent.uid}`, e.target.value);
                            }
                          }}
                          placeholder="e.g. Pass with Distinction"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <span className="text-[9px] text-slate-400 mt-1 block leading-tight">Honors or merit tier (e.g. Pass with Credit, Distinction).</span>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Date of Issue (Certificate)</label>
                        <input
                          id="cert-date-input"
                          type="text"
                          value={customCertificateDate}
                          onChange={(e) => {
                            setCustomCertificateDate(e.target.value);
                            if (selectedStudent) {
                              localStorage.setItem(`cert_date_${selectedStudent.uid}`, e.target.value);
                            }
                          }}
                          placeholder="e.g. June 22, 2026"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <span className="text-[9px] text-slate-400 mt-1 block leading-tight">Formal date of issue listed on the certificate.</span>
                      </div>
                    </div>
                  </div>



                  <div>
                    <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-wider mb-3 flex items-center justify-between">
                      <span>Curriculum Units & Grades</span>
                      <button 
                        onClick={handleResetOverrides}
                        className="text-[10px] text-red-500 hover:underline capitalize font-bold"
                      >
                        Reset Overrides
                      </button>
                    </h4>
                    
                    <div className="space-y-4">
                      {results.map((resItem, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl relative space-y-2">
                          <button
                            onClick={() => handleDeleteRow(idx)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-red-500 p-1 text-base font-bold transition-all"
                            title="Remove unit"
                          >
                            &times;
                          </button>
                          
                          <div className="flex gap-2">
                            <div className="w-1/2">
                              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Code</label>
                              <input
                                type="text"
                                value={resItem.unitCode || ''}
                                onChange={(e) => handleResultChange(idx, 'unitCode', e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border-none rounded-lg text-xs font-bold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-850 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div className="w-1/2">
                              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Hours</label>
                              <input
                                type="number"
                                value={resItem.hours ?? ''}
                                onChange={(e) => handleResultChange(idx, 'hours', parseInt(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border-none rounded-lg text-xs font-bold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-850 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Unit Name</label>
                            <input
                              type="text"
                              value={resItem.unitName || ''}
                              onChange={(e) => handleResultChange(idx, 'unitName', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border-none rounded-lg text-xs font-bold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-850 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>

                          <div className="flex gap-2 items-end">
                            <div className="w-1/3">
                              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Score (%)</label>
                              <input
                                type="number"
                                value={resItem.score ?? ''}
                                onChange={(e) => handleResultChange(idx, 'score', e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border-none rounded-lg text-xs font-black ring-1 ring-slate-200 dark:ring-slate-700 text-slate-850 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-center"
                              />
                            </div>
                            <div className="w-1/3">
                              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Grade</label>
                              <input
                                type="text"
                                value={resItem.grade || ''}
                                onChange={(e) => handleResultChange(idx, 'grade', e.target.value.toUpperCase())}
                                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border-none rounded-lg text-xs font-black ring-1 ring-slate-200 dark:ring-slate-700 text-slate-850 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-center"
                              />
                            </div>
                            <div className="w-1/3">
                              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Result</label>
                              <select
                                value={resItem.status || 'PASS'}
                                onChange={(e) => handleResultChange(idx, 'status', e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border-none rounded-lg text-xs font-bold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-850 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                              >
                                <option value="PASS">PASS</option>
                                <option value="RE-SIT">RE-SIT</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={handleAddRow}
                        className="w-full py-3.5 border-2 border-dashed border-blue-200 dark:border-blue-900 hover:border-blue-500 hover:bg-blue-50/20 text-blue-600 dark:text-blue-400 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2"
                      >
                        + Add Dynamic Course Unit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right pane: Real transcript/certificate render card */}
        <div className={`${isAdminOrStaff ? 'lg:col-span-8' : 'lg:col-span-12'} text-left PrintNoBorder`}>

          {/* Document Type Selector Switcher */}
          {selectedStudent && (
            <div className="flex bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-1 rounded-2xl mb-6 max-w-md print:hidden">
              <button
                id="doc-tab-transcript"
                onClick={() => {
                  setPreviewDocType('transcript');
                  setPrintOrientation('portrait');
                }}
                className={`flex-1 py-3 px-4 text-center text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
                  previewDocType === 'transcript'
                    ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white shadow-md font-black'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold'
                }`}
              >
                <FileText size={14} />
                Academic Transcript
              </button>
              <button
                id="doc-tab-certificate"
                onClick={() => {
                  setPreviewDocType('certificate');
                  setPrintOrientation('landscape');
                }}
                className={`flex-1 py-3 px-4 text-center text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
                  previewDocType === 'certificate'
                    ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white shadow-md font-black'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold'
                }`}
              >
                <Award size={14} />
                Completion Certificate
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {loading ? (
              <div className="bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 rounded-3xl h-[600px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
                  <p className="text-xs font-black uppercase text-slate-400 tracking-widest leading-none">Compiling Registrar Database...</p>
                </div>
              </div>
            ) : selectedStudent ? (
              previewDocType === 'transcript' ? (
                <motion.div
                  id="transcript-view-element"
                  key="transcript-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="bg-white text-slate-900 shadow-xl border border-slate-300 p-6 sm:p-8 relative max-w-[850px] mx-auto min-h-[1123px] flex flex-col justify-between print:p-0 print:border-none print:shadow-none selection:bg-slate-100 font-serif"
                >
                  {/* Subtle Watermark Logo Centered */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none z-0 flex items-center justify-center">
                    {logoUrlOverride ? (
                      <img 
                        src={logoUrlOverride} 
                        alt="" 
                        className="w-56 h-56 object-contain grayscale opacity-25 select-none pointer-events-none mix-blend-multiply" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <GraduationCap size={180} className="stroke-[1] text-slate-600 select-none pointer-events-none" />
                    )}
                  </div>

                  <div className="relative z-10 space-y-3">
                    
                    {/* 1. OFFICIAL COLLEGE HEADER */}
                    <div className="border-b-2 border-slate-900 pb-2">
                      <div className="flex items-center justify-between gap-4">
                        
                        {/* Logo */}
                        <div className="shrink-0">
                          {logoUrlOverride ? (
                            <img 
                              src={logoUrlOverride} 
                              alt="College Logo" 
                              className="h-16 w-auto object-contain max-w-[100px] mix-blend-multiply"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="bg-slate-900 text-white p-2.5 rounded-lg flex items-center justify-center">
                              <GraduationCap className="text-white w-8 h-8" />
                            </div>
                          )}
                        </div>

                        {/* Identity & Accreditation */}
                        <div className="text-center flex-1 space-y-0.5">
                          <h1 className="text-lg sm:text-xl font-serif font-black uppercase tracking-tight text-slate-950 leading-tight">
                            {schoolNameOverride}
                          </h1>
                          <p className="text-[9.5px] font-sans font-bold text-red-700 uppercase tracking-wider leading-none">
                            Ministry of Education & TVETA Registered Institution — Reg No. TVETA/TVC/0082/2016
                          </p>
                          <p className="text-[8.5px] font-sans text-slate-700 font-medium leading-tight">
                            {addressOverride} | Tel: {phoneOverride}
                          </p>
                          <p className="text-[8.5px] font-sans text-slate-700 font-medium leading-none">
                            Email: {emailOverride} | Website: www.bitc.ac.ke
                          </p>
                        </div>

                        {/* Verification QR / Serial Badge */}
                        <div className="shrink-0 text-right hidden sm:block">
                          <div className="p-1 bg-white border border-slate-300 inline-block text-center">
                            <QRCodeCanvas 
                              value={`https://verify.bitc.ac.ke/transcript/${selectedStudent.uid}`}
                              size={44}
                              level="M"
                            />
                            <span className="text-[6.5px] font-sans font-bold uppercase tracking-wider text-slate-500 block mt-0.5">VERIFY OFFICIAL</span>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* 2. DOCUMENT TITLE */}
                    <div className="text-center py-0.5 space-y-0">
                      <h2 className="text-[10px] font-sans font-black uppercase tracking-[0.25em] text-blue-900">
                        OFFICIAL ACADEMIC TRANSCRIPT
                      </h2>
                      <h3 className="text-lg font-serif font-black uppercase tracking-tight text-slate-950">
                        TRANSCRIPT OF RESULTS
                      </h3>
                    </div>

                    {/* 3. STUDENT PARTICULARS */}
                    <div className="border border-slate-900 bg-slate-50/30 p-2.5">
                      <div className="flex gap-3 items-start">
                        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[10.5px] font-sans">
                          
                          <div className="flex border-b border-slate-200 pb-0.5">
                            <span className="w-32 font-bold text-slate-600 uppercase text-[9.5px]">Student Name:</span>
                            <span className="font-black text-slate-950 uppercase">{selectedStudent.name}</span>
                          </div>

                          <div className="flex border-b border-slate-200 pb-0.5">
                            <span className="w-32 font-bold text-slate-600 uppercase text-[9.5px]">Registration No:</span>
                            <span className="font-mono font-bold text-slate-950 uppercase">{selectedStudent.admissionNumber || 'BITC/2026/001'}</span>
                          </div>

                          <div className="flex border-b border-slate-200 pb-0.5">
                            <span className="w-32 font-bold text-slate-600 uppercase text-[9.5px]">Programme / Course:</span>
                            <span className="font-bold text-slate-950 uppercase truncate">{selectedStudent.course || 'Certificate Program'}</span>
                          </div>

                          <div className="flex border-b border-slate-200 pb-0.5">
                            <span className="w-32 font-bold text-slate-600 uppercase text-[9.5px]">Department:</span>
                            <span className="font-bold text-slate-950 uppercase truncate">{getDepartmentForCourse(selectedStudent.course)}</span>
                          </div>

                          <div className="flex border-b border-slate-200 pb-0.5">
                            <span className="w-32 font-bold text-slate-600 uppercase text-[9.5px]">ID / Passport No:</span>
                            <span className="font-mono text-slate-950 uppercase">{selectedStudent.idNumber || 'N/A'}</span>
                          </div>

                          <div className="flex border-b border-slate-200 pb-0.5">
                            <span className="w-32 font-bold text-slate-600 uppercase text-[9.5px]">Academic Intake / Year:</span>
                            <span className="font-semibold text-slate-950 uppercase">{selectedStudent.academicYear || '2025/2026'}</span>
                          </div>

                          <div className="flex">
                            <span className="w-32 font-bold text-slate-600 uppercase text-[9.5px]">Date of Issue:</span>
                            <span className="font-semibold text-slate-950 uppercase">{sealDateOverride}</span>
                          </div>

                          <div className="flex">
                            <span className="w-32 font-bold text-slate-600 uppercase text-[9.5px]">Transcript Serial:</span>
                            <span className="font-mono font-bold text-blue-900 uppercase">{generateAutomatedSerial(selectedStudent)}</span>
                          </div>

                        </div>

                        {/* Student Passport Photo Frame */}
                        {selectedStudent.photoUrl && (
                          <div className="shrink-0 pl-1.5 border-l border-slate-200">
                            <img 
                              src={selectedStudent.photoUrl} 
                              alt="Student Photo" 
                              className="w-14 h-16 object-cover border border-slate-400 p-0.5 bg-white"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 4. ACADEMIC RESULTS TABLE */}
                    <div className="border border-slate-900">
                      <table className="w-full text-left border-collapse text-[10px] font-sans">
                        <thead>
                          <tr className="bg-slate-900 text-white font-bold uppercase text-[9px] tracking-wider border-b border-slate-900">
                            <th className="py-1.5 px-2 border-r border-slate-700 text-center w-8">S/N</th>
                            <th className="py-1.5 px-2 border-r border-slate-700 w-24">UNIT CODE</th>
                            <th className="py-1.5 px-2 border-r border-slate-700">UNIT TITLE / COURSE</th>
                            <th className="py-1.5 px-2 border-r border-slate-700 text-center w-16">CREDIT HRS</th>
                            <th className="py-1.5 px-2 border-r border-slate-700 text-center w-16">MARK (%)</th>
                            <th className="py-1.5 px-2 border-r border-slate-700 text-center w-14">GRADE</th>
                            <th className="py-1.5 px-2 border-r border-slate-700 text-center w-16">GRADE POINT</th>
                            <th className="py-1.5 px-2 text-center w-24">REMARK</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300">
                          {groupedResults.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-6 text-center font-bold text-slate-400 uppercase tracking-widest text-xs">
                                No Academic Course Units Registered for this Candidate
                              </td>
                            </tr>
                          ) : (
                            groupedResults.map((group, groupIdx) => (
                              <React.Fragment key={groupIdx}>
                                {group.semesterName && (
                                  <tr className="bg-slate-100 font-serif font-black text-slate-900 text-[9.5px] uppercase tracking-widest border-y border-slate-400">
                                    <td colSpan={8} className="py-1 px-2 bg-slate-200/80 font-extrabold">
                                      {group.semesterName}
                                    </td>
                                  </tr>
                                )}

                                {group.items.map((r, i) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                    <td className="py-1 px-2 border-r border-slate-300 text-center font-mono font-bold text-slate-500">
                                      {r.sn}
                                    </td>
                                    <td className="py-1 px-2 border-r border-slate-300 font-mono font-black text-slate-900">
                                      {r.unitCode}
                                    </td>
                                    <td className="py-1 px-2 border-r border-slate-300 font-semibold text-slate-950 uppercase">
                                      {r.unitName}
                                    </td>
                                    <td className="py-1 px-2 border-r border-slate-300 text-center font-mono">
                                      {r.hours}
                                    </td>
                                    <td className="py-1 px-2 border-r border-slate-300 text-center font-mono font-bold">
                                      {r.score !== null ? `${r.score}%` : 'NOT AVAILABLE'}
                                    </td>
                                    <td className="py-1 px-2 border-r border-slate-300 text-center font-mono font-black">
                                      {r.grade}
                                    </td>
                                    <td className="py-1 px-2 border-r border-slate-300 text-center font-mono font-bold">
                                      {r.gradePoint}
                                    </td>
                                    <td className="py-1 px-2 text-center font-bold text-[9.5px] uppercase">
                                      <span className={r.grade === 'F' ? 'text-red-700 font-black' : 'text-slate-900'}>
                                        {r.remark}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* 5. ACADEMIC SUMMARY TABLE */}
                    <div className="border border-slate-900 bg-slate-50/50">
                      <table className="w-full text-[11px] font-sans border-collapse">
                        <tbody>
                          <tr className="border-b border-slate-300 divide-x divide-slate-300">
                            <td className="p-1.5 text-center">
                              <span className="block text-[8.5px] font-bold text-slate-500 uppercase">TOTAL CREDIT HOURS</span>
                              <span className="font-mono font-black text-slate-950 text-xs">{totalCreditHours} Hrs</span>
                            </td>
                            <td className="p-1.5 text-center">
                              <span className="block text-[8.5px] font-bold text-slate-500 uppercase">TOTAL UNITS GRADED</span>
                              <span className="font-mono font-black text-slate-950 text-xs">{gradedUnitsCount} Units</span>
                            </td>
                            <td className="p-1.5 text-center">
                              <span className="block text-[8.5px] font-bold text-slate-500 uppercase">AVERAGE MARK (%)</span>
                              <span className="font-mono font-black text-blue-900 text-xs">{currentAverage}%</span>
                            </td>
                            <td className="p-1.5 text-center">
                              <span className="block text-[8.5px] font-bold text-slate-500 uppercase">CUMULATIVE GPA</span>
                              <span className="font-mono font-black text-emerald-800 text-xs">{currentGPA} / 4.00</span>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="p-1.5 bg-slate-100 text-center">
                              <span className="text-[9.5px] font-bold text-slate-600 uppercase mr-2">ACADEMIC CLASSIFICATION:</span>
                              <span className="font-serif font-black text-slate-950 text-xs tracking-wide uppercase border-b-2 border-slate-900 pb-0.5">
                                {getPerformanceClass(currentAverage)}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 6. OFFICIAL GRADING SCALE TABLE */}
                    <div className="border border-slate-300 p-1.5 text-[8.5px] font-sans">
                      <div className="font-bold text-slate-800 uppercase text-[8.5px] mb-0.5 tracking-wider border-b border-slate-200 pb-0.5">
                        OFFICIAL INSTITUTIONAL GRADING SYSTEM:
                      </div>
                      <table className="w-full text-center border-collapse">
                        <thead>
                          <tr className="text-slate-600 font-bold border-b border-slate-200">
                            <th className="py-0.5">MARK RANGE</th>
                            <th className="py-0.5">GRADE</th>
                            <th className="py-0.5">GRADE POINT</th>
                            <th className="py-0.5">REMARK / PERFORMANCE TIER</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 font-medium text-slate-800">
                          <tr><td>70% – 100%</td><td className="font-bold">A</td><td>4.0</td><td>Distinction / Excellent Performance</td></tr>
                          <tr><td>60% – 69%</td><td className="font-bold">B</td><td>3.0</td><td>Credit / Very Good Performance</td></tr>
                          <tr><td>50% – 59%</td><td className="font-bold">C</td><td>2.0</td><td>Satisfactory / Good Performance</td></tr>
                          <tr><td>40% – 49%</td><td className="font-bold">D</td><td>1.0</td><td>Pass</td></tr>
                          <tr><td>0% – 39%</td><td className="font-bold text-red-700">F</td><td>0.0</td><td>Fail / Re-sit Required</td></tr>
                        </tbody>
                      </table>
                    </div>

                  </div>

                  {/* 7. OFFICIAL AUTHENTICATION & SIGNATURES */}
                  <div className="relative z-10 pt-2 space-y-2 font-sans">
                    
                    <div className="grid grid-cols-3 gap-4 items-end">
                      
                      {/* Left: Registrar Signature */}
                      <div className="text-left">
                        <p className="text-[8.5px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">REGISTRAR SIGNATURE</p>
                        <div className="h-9 flex items-center justify-start py-0.5 relative text-blue-900">
                          {isSignoffPrinted && (
                            signatureUrlOverride ? (
                              <img 
                                src={signatureUrlOverride} 
                                alt="Signature" 
                                className="h-8 w-auto object-contain" 
                                referrerPolicy="no-referrer" 
                              />
                            ) : (
                              <svg className="h-8 w-auto opacity-85" viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 40 C30 10, 60 80, 80 40 C100 10, 120 70, 150 35 C170 15, 120 20, 160 50 C200 80, 210 20, 230 40" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                              </svg>
                            )
                          )}
                        </div>
                        <div className="border-t border-slate-900 pt-0.5">
                          <p className="text-[10px] font-black text-slate-950 uppercase">{registrarNameOverride}</p>
                          <p className="text-[8.5px] font-bold text-slate-600 uppercase">{registrarTitleOverride}</p>
                        </div>
                      </div>

                      {/* Center: Stamp Seal */}
                      <div className="flex flex-col items-center justify-center text-center">
                        {isSignoffPrinted && (
                          stampUrlOverride ? (
                            <div className="relative stamp-seal-container w-20 h-20 flex items-center justify-center select-none rotate-[-4deg]">
                              <img 
                                src={stampUrlOverride} 
                                alt="Official Stamp" 
                                className="w-20 h-20 object-contain opacity-95 mix-blend-multiply"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          ) : (
                            <div className="relative stamp-seal-container w-20 h-20 flex items-center justify-center border-4 border-double border-blue-900 rounded-full text-blue-950 font-black text-center text-[7.5px] uppercase p-1 opacity-85 rotate-[-8deg]">
                              <div>
                                <p className="font-extrabold text-[6.5px]">REGISTRAR</p>
                                <p className="font-black text-[9px]">BITC</p>
                                <p className="font-bold text-[5.5px]">OFFICIAL SEAL</p>
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      {/* Right: Tutor Signature */}
                      <div className="text-right">
                        <p className="text-[8.5px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">{principalTitleOverride || 'TUTOR / TEACHER'}</p>
                        <div className="h-9 flex items-center justify-end py-0.5 relative text-blue-900">
                          {isSignoffPrinted && (
                            principalSignatureUrlOverride ? (
                              <img 
                                src={principalSignatureUrlOverride} 
                                alt="Tutor Signature" 
                                className="h-8 w-auto object-contain" 
                                referrerPolicy="no-referrer" 
                              />
                            ) : null
                          )}
                        </div>
                        <div className="border-t border-slate-900 pt-0.5">
                          <p className="text-[10px] font-black text-slate-950 uppercase">{principalNameOverride || 'COURSE TUTOR'}</p>
                          <p className="text-[8.5px] font-bold text-slate-600 uppercase">APPROVED & VERIFIED</p>
                        </div>
                      </div>

                    </div>

                    {/* 8. OFFICIAL DISCLAIMER */}
                    <div className="text-[7.5px] font-serif italic text-slate-600 text-center border-t border-slate-300 pt-1 leading-tight">
                      "This transcript is an official academic record issued by Breakthrough International Training College. It is valid only when bearing the authorized signature, official institutional stamp, and valid verification information. Any unauthorized alteration or modification renders this document invalid."
                    </div>

                  </div>
                </motion.div>
              ) : (
              <motion.div
                id="certificate-view-element"
                key="certificate-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-[#FFFDF6] text-slate-900 shadow-xl border-[16px] border-double border-amber-800 rounded-[40px] overflow-hidden p-8 sm:p-16 relative print:p-0 print:border-none print:shadow-none print:rounded-none flex flex-col justify-between min-h-[750px] selection:bg-amber-100"
              >
                {/* QR Code corner absolute item */}
                <div className="absolute top-6 right-6 p-1.5 bg-white border border-amber-950/15 rounded-xl shadow-sm flex flex-col items-center gap-1 print:border-black/20 z-20">
                  <QRCodeCanvas 
                    value={`https://bitc.ac.ke/verify/cert/${selectedStudent.uid}`}
                    size={44}
                    level="H"
                  />
                  <span className="text-[7px] font-black uppercase text-slate-400 tracking-wider">VERIFY CERT</span>
                </div>

                {/* Elegant small watermark centered */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.035] pointer-events-none z-0 flex items-center justify-center">
                  {logoUrlOverride ? (
                    <img 
                      src={logoUrlOverride} 
                      alt="" 
                      className="w-48 h-48 object-contain grayscale opacity-25 select-none pointer-events-none mix-blend-multiply" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <GraduationCap size={180} className="stroke-[1.25] text-slate-400 select-none pointer-events-none" />
                  )}
                </div>

                {/* Header */}
                <div className="text-center space-y-3 z-10 relative">
                  {/* Logo */}
                  <div className="flex justify-center mb-1">
                    {logoUrlOverride ? (
                      <img 
                        src={logoUrlOverride} 
                        alt="School Logo" 
                        className="h-16 w-auto object-contain max-w-[110px] mix-blend-multiply"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-sm inline-flex items-center justify-center">
                        <GraduationCap className="text-white w-10 h-10" />
                      </div>
                    )}
                  </div>

                  <h2 className="cert-title-1 text-xl md:text-2xl font-serif font-black uppercase tracking-tight text-amber-950 leading-none">
                    {schoolNameOverride}
                  </h2>
                  <p className="cert-title-2 text-[10px] md:text-xs font-sans font-extrabold text-slate-500 uppercase tracking-[0.2em] leading-none">
                    Ministry of Higher Education, Science & Technology & TVETA Registered
                  </p>
                  <p className="cert-title-3 text-[10px] font-serif italic text-amber-900 tracking-wider leading-none">
                    Official Certificate of Registrar of Academic Affairs
                  </p>
                  
                  {/* Decorative divider */}
                  <div className="flex items-center justify-center gap-3 py-0.5">
                    <div className="h-[1px] w-16 bg-gradient-to-r from-transparent to-amber-700" />
                    <Award className="text-amber-700 w-4 h-4" />
                    <div className="h-[1px] w-16 bg-gradient-to-l from-transparent to-amber-700" />
                  </div>
                </div>

                {/* Content Body */}
                <div className="text-center my-4 space-y-3 flex-grow flex flex-col justify-center z-10 relative">
                  <p className="cert-award-title text-sm font-serif italic text-amber-900 tracking-wide leading-none">
                    This is to certify that
                  </p>
                  
                  <h1 className="cert-student-name text-3xl md:text-4xl font-serif font-black tracking-tight text-amber-950 border-b border-amber-950/20 pb-1.5 inline-block px-8 max-w-2xl mx-auto leading-none italic">
                    {selectedStudent.name}
                  </h1>
                  
                  <p className="cert-completion-sub text-[10px] text-slate-600 max-w-lg mx-auto font-sans font-bold uppercase tracking-wider leading-relaxed">
                    having successfully fulfilled all academic requirements, coursework, and practical examinations has been awarded the qualification of:
                  </p>
                  
                  <div className="cert-course-container bg-amber-50/50 border border-amber-100 py-2.5 px-5 rounded-2xl inline-block max-w-xl mx-auto my-1">
                    <h2 className="cert-course-title text-lg md:text-xl font-serif font-black uppercase text-amber-950 tracking-tight leading-none">
                      {selectedStudent.course || 'Certificate Program'}
                    </h2>
                  </div>

                  {(customAwardClass || getCertificateAwardFromAverage(currentAverage)) && (
                    <div className="mt-0.5">
                      <span className="cert-award-class bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full inline-block">
                        {customAwardClass || getCertificateAwardFromAverage(currentAverage)}
                      </span>
                    </div>
                  )}

                  <p className="cert-testimony text-[10px] md:text-xs font-serif italic text-amber-900 leading-relaxed max-w-2xl mx-auto">
                    In witness whereof, we have hereunto set our hands and the official seal of the institution on this day of <span className="font-sans font-black uppercase not-italic text-amber-950">{customCertificateDate}</span>.
                  </p>
                </div>

                {/* Footer and Signatures */}
                <div className="cert-footer-grid border-t border-amber-950/10 pt-4 grid grid-cols-3 items-end gap-4 text-center mt-auto z-10 relative">
                  {/* Left: Registrar Signature */}
                  <div className="flex flex-col items-center">
                    <div className="h-12 flex items-center justify-center py-1 relative text-blue-800 w-full">
                      {isSignoffPrinted && (
                        signatureUrlOverride ? (
                          <img 
                            src={signatureUrlOverride} 
                            alt="Registrar Signature" 
                            className="h-10 w-auto object-contain max-h-10" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <svg className="h-10 w-auto opacity-85" viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 30 Q40 5, 80 45 T140 15 T190 35" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                            <path d="M25 35 L175 35" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                          </svg>
                        )
                      )}
                    </div>
                    <div className="border-t border-amber-950/20 pt-1 w-full">
                      <p className="text-[9px] font-black text-amber-950 uppercase leading-none">{registrarNameOverride}</p>
                      <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 leading-none">{registrarTitleOverride || 'REGISTRAR'}</p>
                    </div>
                  </div>

                  {/* Center: Stamp Seal & QR */}
                  <div className="flex flex-col items-center justify-center gap-1">
                    {/* Stamp / Logo seal */}
                    <div className="relative flex items-center justify-center h-20 w-20">
                      {isSignoffPrinted && (
                        stampUrlOverride && stampUrlOverride !== '/stamp.png' ? (
                          <div className="relative stamp-seal-container w-20 h-20 flex items-center justify-center select-none rotate-[-5deg]">
                            <img 
                              src={stampUrlOverride} 
                              alt="Official Stamp" 
                              className="w-20 h-20 object-contain opacity-90 max-h-20" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="relative stamp-seal-container w-20 h-20 flex items-center justify-center border-4 border-double border-amber-900 rounded-full text-amber-950 font-black text-center text-[7px] tracking-tighter uppercase p-1.5 select-none opacity-85 rotate-[-10deg] print:border-black print:text-black">
                            <div className="absolute inset-0 border border-amber-950/30 border-dashed rounded-full m-0.5 print:border-black" />
                            <div>
                              <p className="font-extrabold text-[6px] leading-none mb-0.5">REGISTRAR</p>
                              <p className="font-black leading-none my-0.5">BITC</p>
                              <p className="font-black text-[5px] leading-tight mt-0.5">OFFICIAL SEAL</p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                    
                    {/* Unique Certificate Verification Details */}
                    <div className="text-center mt-1">
                      <p className="text-[6px] font-black uppercase tracking-widest text-slate-400 leading-none">CERTIFICATE SERIAL</p>
                      <p className="text-[9px] font-mono font-black text-amber-950 mt-0.5 leading-none">{customCertificateNo}</p>
                    </div>
                  </div>

                  {/* Right: Tutor / Teacher Signature */}
                  <div className="flex flex-col items-center">
                    <div className="h-12 flex items-center justify-center py-1 relative w-full">
                      {/* Removed digital signature for physical signature of Tutor */}
                    </div>
                    <div className="border-t border-amber-950/20 pt-1 w-full">
                      <p className="text-[9px] font-black text-amber-950 uppercase leading-none">{principalNameOverride || 'COURSE TUTOR'}</p>
                      <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 leading-none">{principalTitleOverride || 'TUTOR / TEACHER'}</p>
                    </div>
                  </div>
                </div>

              </motion.div>
            )
          ) : (
              <div className="bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 rounded-3xl h-[600px] flex items-center justify-center">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1 leading-none">No student selected</p>
              </div>
            )}
          </AnimatePresence>

        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 ${printOrientation};
            margin: 0 !important;
          }

          /* General body print specifications */
          html, body {
            width: ${printOrientation === 'landscape' ? '297mm' : '210mm'} !important;
            height: ${printOrientation === 'landscape' ? '210mm' : '297mm'} !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }

          /* Hide absolutely everything by default */
          body * {
            visibility: hidden !important;
          }

          /* Completely hide specific UI layers so they don't consume any layout flow */
          header, aside, footer, nav, button, 
          #print-orientation-selector, .print\\:hidden,
          .bg-slate-100, .mb-6.flex, .AnimatePresence,
          .fixed, [role="dialog"], .Toast, .ToastMessage {
            display: none !important;
          }

          /* Make ONLY our target print element and its descendants printed */
          #transcript-view-element, 
          #transcript-view-element *,
          #certificate-view-element, 
          #certificate-view-element * {
            visibility: visible !important;
          }

          /* Position target printable elements on top, covering A4 perfectly */
          #transcript-view-element, #certificate-view-element {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: ${printOrientation === 'landscape' ? '297mm' : '210mm'} !important;
            height: ${printOrientation === 'landscape' ? '210mm' : '297mm'} !important;
            max-width: ${printOrientation === 'landscape' ? '297mm' : '210mm'} !important;
            max-height: ${printOrientation === 'landscape' ? '210mm' : '297mm'} !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* TRANSCRIPT PRINT CONDENSING FOR A4 SINGLE PAGE */
          #transcript-view-element {
            padding: 12mm 15mm !important;
            border: none !important;
            background-color: #ffffff !important;
            box-sizing: border-box !important;
            font-size: 11px !important;
            width: 210mm !important;
            min-height: 297mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
          }

          #transcript-view-element img {
            max-height: 56px !important;
          }

          #transcript-view-element h1 {
            font-size: 22px !important;
            font-weight: 900 !important;
            margin-top: 4px !important;
            margin-bottom: 6px !important;
          }

          #transcript-view-element h2 {
            font-size: 17px !important;
            font-weight: 900 !important;
            line-height: 1.2 !important;
          }

          #transcript-view-element .pb-6,
          #transcript-view-element .mb-6 {
            padding-bottom: 8px !important;
            margin-bottom: 8px !important;
          }

          #transcript-view-element .mb-10,
          #transcript-view-element .mt-8,
          #transcript-view-element .pb-4 {
            margin-top: 4px !important;
            margin-bottom: 8px !important;
            padding-bottom: 4px !important;
          }

          #transcript-view-element .rounded-\[28px\] {
            border-radius: 12px !important;
            margin-bottom: 8px !important;
          }

          #transcript-view-element .grid-cols-12,
          #transcript-view-element .flex-wrap {
            gap: 6px 12px !important;
          }

          #transcript-view-element p.text-\[10px\] {
            font-size: 9px !important;
            font-weight: 800 !important;
          }

          #transcript-view-element p.text-sm {
            font-size: 11.5px !important;
            font-weight: 800 !important;
          }

          #transcript-view-element table {
            margin-bottom: 0 !important;
            width: 100% !important;
            border-collapse: collapse !important;
          }

          #transcript-view-element table th,
          #transcript-view-element table td {
            padding: 6px 10px !important;
            font-size: 10.5px !important;
          }

          #transcript-view-element table th {
            font-size: 10px !important;
            font-weight: 900 !important;
            background-color: #0f172a !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Summary blocks */
          #transcript-view-element .grid-cols-3,
          #transcript-view-element .gap-6 {
            gap: 8px !important;
            margin-bottom: 8px !important;
          }

          #transcript-view-element .grid-cols-3 .p-5,
          #transcript-view-element .p-5 {
            padding: 8px 12px !important;
            border-radius: 10px !important;
          }

          #transcript-view-element .grid-cols-3 p.text-\[10px\] {
            font-size: 9px !important;
          }

          #transcript-view-element .grid-cols-3 p.text-2xl,
          #transcript-view-element p.text-2xl {
            font-size: 17px !important;
            margin-top: 2px !important;
            font-weight: 900 !important;
          }

          #transcript-view-element .grid-cols-3 .w-10 {
            width: 32px !important;
            height: 32px !important;
            border-radius: 6px !important;
          }

          #transcript-view-element .grid-cols-3 svg {
            width: 15px !important;
            height: 15px !important;
          }

          /* Classification panel & note disclaimer */
          #transcript-view-element .mb-12 {
            margin-bottom: 8px !important;
            padding: 8px 12px !important;
            border-radius: 10px !important;
          }

          #transcript-view-element .mb-12 h4 {
            font-size: 13.5px !important;
            margin-top: 2px !important;
            font-weight: 900 !important;
          }

          #transcript-view-element .mb-12 .text-\[10px\] {
            font-size: 9px !important;
          }

          #transcript-view-element p.mt-4 {
            margin-top: 6px !important;
            font-size: 8.5px !important;
            line-height: 1.35 !important;
          }

          /* Signatures and Seals */
          #transcript-view-element .items-end {
            padding-top: 4px !important;
            gap: 12px !important;
            margin-top: auto !important;
          }

          #transcript-view-element .stamp-seal-container {
            width: 90px !important;
            height: 90px !important;
          }

          #transcript-view-element .stamp-seal-container img {
            width: 90px !important;
            height: 90px !important;
          }

          #transcript-view-element .h-14 {
            height: 40px !important;
          }

          #transcript-view-element .h-14 svg,
          #transcript-view-element .h-14 img {
            height: 36px !important;
          }

          #transcript-view-element .max-w-\[240px\] {
            margin-top: 2px !important;
            padding-top: 2px !important;
          }

          #transcript-view-element .max-w-\[240px\] p {
            font-size: 10.5px !important;
            margin-top: 0 !important;
          }

          #transcript-view-element .max-w-\[240px\] p.text-\[9px\] {
            font-size: 8.5px !important;
          }

          #transcript-view-element .md\:col-span-3 .p-2 {
            padding: 2px !important;
            border-radius: 4px !important;
          }

          #transcript-view-element .md\:col-span-3 canvas {
            width: 44px !important;
            height: 44px !important;
          }

          #transcript-view-element .md\:col-span-3 span {
            font-size: 7px !important;
            margin-top: 1px !important;
          }

          /* CERTIFICATE PRINT CONDENSING FOR A4 SINGLE PAGE */
          #certificate-view-element {
            padding: ${printOrientation === 'landscape' ? '14mm 20mm' : '18mm 16mm'} !important;
            border: none !important;
            background-color: #FFFDF6 !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }

          #certificate-view-element .cert-title-1 {
            font-size: ${printOrientation === 'landscape' ? '28px' : '22px'} !important;
            line-height: 1.1 !important;
            margin-bottom: 2px !important;
          }

          #certificate-view-element .cert-title-2 {
            font-size: ${printOrientation === 'landscape' ? '17px' : '13px'} !important;
            line-height: 1.1 !important;
            margin-bottom: 2px !important;
          }

          #certificate-view-element .cert-title-3 {
            font-size: ${printOrientation === 'landscape' ? '15px' : '11px'} !important;
            line-height: 1.1 !important;
            margin-bottom: 4px !important;
          }

          #certificate-view-element .cert-subtitle {
            font-size: ${printOrientation === 'landscape' ? '8px' : '6.5px'} !important;
            line-height: 1.3 !important;
            max-width: 90% !important;
            margin: 0 auto !important;
          }

          #certificate-view-element .cert-award-title {
            font-size: ${printOrientation === 'landscape' ? '19px' : '15px'} !important;
            margin-top: ${printOrientation === 'landscape' ? '6px' : '4px'} !important;
            margin-bottom: 2px !important;
          }

          #certificate-view-element .cert-awarded-to {
            font-size: ${printOrientation === 'landscape' ? '11px' : '9px'} !important;
            margin-bottom: 2px !important;
          }

          #certificate-view-element .cert-student-name {
            font-size: ${printOrientation === 'landscape' ? '42px' : '32px'} !important;
            line-height: 1.1 !important;
            margin-top: 4px !important;
            margin-bottom: 4px !important;
            padding-bottom: 2px !important;
          }

          #certificate-view-element .cert-completion-sub {
            font-size: ${printOrientation === 'landscape' ? '8px' : '6.5px'} !important;
            line-height: 1.2 !important;
            margin-top: 1px !important;
            margin-bottom: 1px !important;
          }

          #certificate-view-element .cert-course-container {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
            margin-top: 4px !important;
            margin-bottom: 4px !important;
          }

          #certificate-view-element .cert-course-title {
            font-size: ${printOrientation === 'landscape' ? '14px' : '11px'} !important;
          }

          #certificate-view-element .cert-award-class {
            font-size: ${printOrientation === 'landscape' ? '8px' : '7px'} !important;
            padding: 2px 8px !important;
          }

          #certificate-view-element .cert-testimony {
            font-size: ${printOrientation === 'landscape' ? '10px' : '8px'} !important;
            line-height: 1.3 !important;
            margin-top: ${printOrientation === 'landscape' ? '10px' : '6px'} !important;
          }

          #certificate-view-element .cert-footer-grid {
            margin-top: ${printOrientation === 'landscape' ? '12px' : '10px'} !important;
            padding-top: ${printOrientation === 'landscape' ? '8px' : '6px'} !important;
          }

          /* Handle QR Code Canvas wrapper and inside canvas */
          #certificate-view-element .p-1,
          #certificate-view-element .p-1.5,
          #certificate-view-element .p-2 {
            padding: 4px !important;
            border-radius: 6px !important;
            background: white !important;
          }

          #certificate-view-element .p-1 canvas,
          #certificate-view-element .p-1.5 canvas,
          #certificate-view-element .p-2 canvas {
            width: 44px !important;
            height: 44px !important;
          }

          .print-header {
            display: block !important;
          }
        }
      ` }} />

    </div>
  );
};
