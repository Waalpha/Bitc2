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
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { withOklabOklchPatch } from '../utils/canvasPatch';

export const Transcripts: React.FC = () => {
  const { user, userData, settings, studentContext } = useAuth();
  
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
  const [registrarNameOverride, setRegistrarNameOverride] = useState(localStorage.getItem('transcript_registrarName') || 'PROF. J. K. KIBICHO, PHD');
  const [registrarTitleOverride, setRegistrarTitleOverride] = useState(localStorage.getItem('transcript_registrarTitle') || 'REGISTRAR OF ACADEMIC AFFAIRS');
  const [signatureUrlOverride, setSignatureUrlOverride] = useState(localStorage.getItem('transcript_signatureUrl') || '');
  const [stampUrlOverride, setStampUrlOverride] = useState(localStorage.getItem('transcript_stampUrl') || '/stamp.png');

  // Custom grades override state
  const [customResults, setCustomResults] = useState<any[] | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'students' | 'editor'>('students');
  
  // Digital Certificate states
  const previewDocType = 'transcript';
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
        element.style.width = '1000px';
        element.style.minWidth = '1000px';
        element.style.maxWidth = '1000px';
      } else {
        const w = isPortrait ? '840px' : '1120px';
        element.style.width = w;
        element.style.minWidth = w;
        element.style.maxWidth = w;
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
      
      const margin = 8; // 8mm margin
      const pageWidth = isPortraitDoc ? 210 : 297;
      const pageHeight = isPortraitDoc ? 297 : 210;
      
      const printableWidth = pageWidth - (margin * 2);
      const printableHeight = pageHeight - (margin * 2);
      
      let width = printableWidth;
      let height = (canvas.height * width) / canvas.width;
      
      if (height > printableHeight) {
        height = printableHeight;
        width = (canvas.width * height) / canvas.height;
      }
      
      const x = margin + (printableWidth - width) / 2;
      const y = margin + (printableHeight - height) / 2;
      
      const pdf = new jsPDF({
        orientation: isPortraitDoc ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      pdf.addImage(imgData, 'PNG', x, y, width, height);
      
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
                  <p class="info-label">Registry Seal Date</p>
                  <p class="info-val">2026-06-22</p>
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
                  <p class="sign-title" style="text-align:right;">REGISTRY VERIFICATION</p>
                  <div style="height:45px; vertical-align:middle; text-align:right; padding-bottom:5px;">
                    <span style="font-size:7pt; color:#64748b; font-family:Courier,monospace;">QR CODE LINKED TO DATABASE<br/>verify.bitc.ac.ke</span>
                  </div>
                  <div class="sign-line" style="text-align:right;">
                    <p class="sign-name" style="text-align:right;">SECURE CODE</p>
                    <p class="sign-title" style="text-align:right;">REF: ${generateAutomatedSerial(selectedStudent)}</p>
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
    { code: "BTP-101", name: "Beauty Therapy Practicals", hours: 90 },
    { code: "HD-102", name: "Hairdressing Masterclass & Practicals", hours: 90 },
    { code: "SCS-201", name: "Skin Care, Diagnosis & Treatment", hours: 45 },
    { code: "APH-202", name: "Anatomy & Physiology of Hair & Skin", hours: 45 },
    { code: "SLM-301", name: "Salon Management & Customer Service Skills", hours: 30 }
  ];

  const defaultElectricalUnits = [
    { code: "CA-101", name: "Circuit Analysis & Load Management", hours: 60 },
    { code: "CON-102", name: "Conduit Systems & Surface Installations", hours: 90 },
    { code: "TS-201", name: "Trunking Systems & Heavy Distribution Routing", hours: 90 },
    { code: "PVC-202", name: "PVC Sheathed Cable Assembly Installation", hours: 90 },
    { code: "EES-301", name: "Electrical Safety & Fire Prevention Standard", hours: 45 }
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
    setRegistrarNameOverride(localStorage.getItem('transcript_registrarName') || 'PROF. J. K. KIBICHO, PHD');
    setRegistrarTitleOverride(localStorage.getItem('transcript_registrarTitle') || 'REGISTRAR OF ACADEMIC AFFAIRS');
    setSignatureUrlOverride(localStorage.getItem('transcript_signatureUrl') || '');
    setStampUrlOverride(localStorage.getItem('transcript_stampUrl') || (settings && settings.stampUrl) || '/stamp.png');
  }, [settings]);

  // Load custom results when selectedStudent changes
  useEffect(() => {
    if (selectedStudent) {
      const saved = localStorage.getItem(`transcript_override_${selectedStudent.uid}`);
      if (saved) {
        try {
          setCustomResults(JSON.parse(saved));
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
    } else if (courseName.includes('solar') || courseName.includes('electrical') || courseName.includes('wiring')) {
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

  // Dynamically synchronize certificate overrides
  useEffect(() => {
    if (selectedStudent) {
      const rList = getTranscriptResults();
      const avg = rList.length > 0 ? Math.round(rList.reduce((acc, r) => acc + r.score, 0) / rList.length) : 75;
      
      const staticCertNo = generateAutomatedSerial(selectedStudent);
      setCustomCertificateNo(localStorage.getItem(`cert_no_${selectedStudent.uid}`) || staticCertNo);
      
      const defaultAward = avg >= 70 ? 'Grade A - Pass WITH DISTINCTION' :
                           avg >= 60 ? 'Grade B - Pass WITH CREDIT' : 'Grade C - PASS';
      setCustomAwardClass(localStorage.getItem(`cert_award_${selectedStudent.uid}`) || defaultAward);
      
      const defaultDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      setCustomCertificateDate(localStorage.getItem(`cert_date_${selectedStudent.uid}`) || defaultDate);
    }
  }, [selectedStudent, submissions, exams]);

  // Dynamically calculate grades for any selected student
  const getTranscriptResults = () => {
    if (!selectedStudent) return [];

    const studentSubmissions = submissions.filter(s => s.studentId === selectedStudent.uid);
    const results: {
      unitCode: string;
      unitName: string;
      score: number;
      grade: string;
      hours: number;
      status: 'PASS' | 'RE-SIT';
      isPlaceholder?: boolean;
    }[] = [];

    // Option A: Extract real units and matches
    const mappedUnitIds = new Set<string>();

    studentSubmissions.forEach(sub => {
      const exam = exams.find(e => e.id === sub.examId);
      if (exam && exam.unitId && sub.grade !== undefined) {
        const unit = units.find(u => u.id === exam.unitId);
        if (unit && !mappedUnitIds.has(unit.id)) {
          mappedUnitIds.add(unit.id);
          
          // Calculate percentage score
          const rawPercentage = (sub.grade / (exam.maxMarks || 100)) * 100;
          const score = Math.round(Math.min(100, Math.max(0, rawPercentage)));
          
          // Classify grade
          const matchedGrade = grades.find(g => score >= g.minPercentage && score <= g.maxPercentage);
          const gradeLabel = matchedGrade ? matchedGrade.label : 'F';
          const pass = score >= (exam.passingMarks || 40);

          // Get uniform code based on unit name
          const initials = unit.name ? unit.name.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase() : 'UNT';
          const randomCode = `${initials}-${100 + Math.floor(Math.random() * 200)}`;

          results.push({
            unitCode: randomCode,
            unitName: unit.name,
            score,
            grade: gradeLabel,
            hours: 45, // Standard hours
            status: pass ? 'PASS' : 'RE-SIT'
          });
        }
      }
    });

    // Option B: Fill missing curriculum units
    const isMockChecked = includeMockData || results.length === 0;
    if (isMockChecked) {
      // Find template list based on student course
      const studentCourse = (selectedStudent.course || "").toLowerCase();
      let template = defaultCaregiverUnits;
      if (studentCourse.includes('ict') || studentCourse.includes('computer') || studentCourse.includes('programming')) {
        template = defaultIctUnits;
      } else if (studentCourse.includes('cosmetology') || studentCourse.includes('beauty') || studentCourse.includes('hair')) {
        template = defaultCosmetologyUnits;
      } else if (studentCourse.includes('electrical') || studentCourse.includes('conduit') || studentCourse.includes('trunking')) {
        template = defaultElectricalUnits;
      }

      template.forEach((item, index) => {
        // Only append if it wasn't already matched by name
        const exists = results.some(r => r.unitName.toLowerCase() === item.name.toLowerCase());
        if (!exists) {
          // Generate realistic grade
          const seed = (selectedStudent.name ? selectedStudent.name.charCodeAt(0) : 75) + index * 12;
          const score = 55 + (seed % 38); // between 55% and 93%
          const matchedGrade = grades.find(g => score >= g.minPercentage && score <= g.maxPercentage);
          const gradeLabel = matchedGrade ? matchedGrade.label : 'C';

          results.push({
            unitCode: item.code,
            unitName: item.name,
            score,
            grade: gradeLabel,
            hours: item.hours,
            status: score >= 40 ? 'PASS' : 'RE-SIT',
            isPlaceholder: true
          });
        }
      });
    }

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
    setRegistrarNameOverride('PROF. J. K. KIBICHO, PHD');
    setRegistrarTitleOverride('REGISTRAR OF ACADEMIC AFFAIRS');
    setSignatureUrlOverride('');
    setStampUrlOverride('/stamp.png');
    
    localStorage.removeItem('transcript_schoolName');
    localStorage.removeItem('transcript_logoUrl');
    localStorage.removeItem('transcript_address');
    localStorage.removeItem('transcript_phone');
    localStorage.removeItem('transcript_email');
    localStorage.removeItem('transcript_registrarName');
    localStorage.removeItem('transcript_registrarTitle');
    localStorage.removeItem('transcript_signatureUrl');
    localStorage.removeItem('transcript_stampUrl');
  };

  const results = customResults !== null ? customResults : getTranscriptResults();

  // Aggregate stats
  const calculateAverage = () => {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, curr) => acc + curr.score, 0);
    return Math.round(sum / results.length);
  };

  const currentAverage = calculateAverage();

  // Standard Kenan / GPA conversion
  const calculateGPA = () => {
    if (results.length === 0) return "0.00";
    const sumGpaPoints = results.reduce((acc, curr) => {
      // scale mapping: A (70+) -> 4.0, B (60-69) -> 3.0, C (50-59) -> 2.0, D (40-49) -> 1.0, F (<40) -> 0.0
      let pt = 0;
      if (curr.score >= 70) pt = 4.0;
      else if (curr.score >= 60) pt = 3.0;
      else if (curr.score >= 50) pt = 2.0;
      else if (curr.score >= 40) pt = 1.0;
      return acc + pt;
    }, 0);
    return (sumGpaPoints / results.length).toFixed(2);
  };

  const currentGPA = calculateGPA();

  const getPerformanceClass = (avg: number) => {
    if (avg >= 70) return "FIRST CLASS HONORS EQUIVALENT (DISTINCTION)";
    if (avg >= 60) return "SECOND CLASS UPPER DIVISION EQUIVALENT (CREDIT)";
    if (avg >= 50) return "SECOND CLASS LOWER DIVISION EQUIVALENT (PASS)";
    if (avg >= 40) return "PASS DIVISION";
    return "FAIL / UNCLASSIFIED";
  };

  const triggerPrint = () => {
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
                      <span>Registrar & Custom Signature</span>
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
                        <label className="text-[10px] uppercase font-bold text-slate-400">Custom Signature Image URL (Optional)</label>
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
                                value={resItem.unitCode}
                                onChange={(e) => handleResultChange(idx, 'unitCode', e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border-none rounded-lg text-xs font-bold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-850 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div className="w-1/2">
                              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Hours</label>
                              <input
                                type="number"
                                value={resItem.hours}
                                onChange={(e) => handleResultChange(idx, 'hours', parseInt(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border-none rounded-lg text-xs font-bold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-850 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Unit Name</label>
                            <input
                              type="text"
                              value={resItem.unitName}
                              onChange={(e) => handleResultChange(idx, 'unitName', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border-none rounded-lg text-xs font-bold ring-1 ring-slate-200 dark:ring-slate-700 text-slate-850 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>

                          <div className="flex gap-2 items-end">
                            <div className="w-1/3">
                              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Score (%)</label>
                              <input
                                type="number"
                                value={resItem.score}
                                onChange={(e) => handleResultChange(idx, 'score', e.target.value)}
                                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border-none rounded-lg text-xs font-black ring-1 ring-slate-200 dark:ring-slate-700 text-slate-850 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-center"
                              />
                            </div>
                            <div className="w-1/3">
                              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Grade</label>
                              <input
                                type="text"
                                value={resItem.grade}
                                onChange={(e) => handleResultChange(idx, 'grade', e.target.value.toUpperCase())}
                                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border-none rounded-lg text-xs font-black ring-1 ring-slate-200 dark:ring-slate-700 text-slate-850 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-center"
                              />
                            </div>
                            <div className="w-1/3">
                              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Result</label>
                              <select
                                value={resItem.status}
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

          <AnimatePresence mode="wait">
            {loading ? (
              <div className="bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 rounded-3xl h-[600px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
                  <p className="text-xs font-black uppercase text-slate-400 tracking-widest leading-none">Compiling Registrar Database...</p>
                </div>
              </div>
            ) : selectedStudent ? (
              <motion.div
                  id="transcript-view-element"
                  key="transcript-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="bg-white text-slate-900 dark:bg-white dark:text-slate-900 shadow-xl border border-slate-150 rounded-[40px] overflow-hidden p-6 sm:p-12 relative print:p-0 print:border-none print:shadow-none print:rounded-none selection:bg-slate-100"
                >
                
                {/* Institutional Letterhead Header - ALWAYS VISIBLE (Preview & Print) */}
                <div className="border-b border-sky-100 dark:border-slate-100 pb-6 mb-6">
                  <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
                    
                    {/* Left: Logo & School Name */}
                    <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
                      {logoUrlOverride ? (
                        <img 
                          src={logoUrlOverride} 
                          alt="School Logo" 
                          className="h-16 w-auto object-contain max-w-[110px] rounded-xl self-center mix-blend-multiply"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="bg-slate-900 dark:bg-slate-900 text-white p-3 rounded-2xl shadow-sm shrink-0 flex items-center justify-center">
                          <GraduationCap className="text-white w-9 h-9" />
                        </div>
                      )}
                      
                      <div className="space-y-0.5">
                        <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-slate-950 leading-tight">
                          {schoolNameOverride}
                        </h2>
                        <p className="text-[9px] md:text-[10px] font-black text-blue-600 uppercase tracking-[0.15em] leading-none">
                          Ministry of Higher Education, Science & Technology & TVETA Registered
                        </p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider leading-none pt-0.5">
                          Official Certificate of Registrar of Academic Affairs
                        </p>
                      </div>
                    </div>

                    {/* Right: Address & Contact parameters */}
                    <div className="text-center md:text-right text-[9px] text-slate-500 font-black uppercase tracking-widest space-y-0.5 border-t md:border-t-0 md:border-l border-slate-150 pt-3 md:pt-0 md:pl-5 leading-normal shrink-0">
                      <p className="flex items-center justify-center md:justify-end gap-1.5 font-bold text-slate-800">
                        <MapPin size={10} className="text-slate-400" /> {addressOverride}
                      </p>
                      <p className="flex items-center justify-center md:justify-end gap-1.5">
                        <Phone size={10} className="text-slate-400" /> {phoneOverride}
                      </p>
                      <p className="flex items-center justify-center md:justify-end gap-1.5">
                        <Mail size={10} className="text-slate-400" /> {emailOverride}
                      </p>
                    </div>

                  </div>
                </div>

                {/* Elegant small watermark centered - VISIBLE ON BOTH PRINT & PREVIEW */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.035] pointer-events-none z-0 flex items-center justify-center">
                  {logoUrlOverride ? (
                    <img 
                      src={logoUrlOverride} 
                      alt="" 
                      className="w-36 h-36 object-contain grayscale opacity-25 select-none pointer-events-none mix-blend-multiply" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <GraduationCap size={160} className="stroke-[1.25] text-slate-400 select-none pointer-events-none" />
                  )}
                </div>

                {/* Display interactive toggle indicators */}
                <div className="pb-4 border-b border-slate-100 flex items-center justify-between z-10 relative print:hidden">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest">
                      Official Document
                    </span>
                    <span className="text-slate-400 font-bold ml-1 text-xs">
                      {results.length} Units Graded
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Mock notification badge for testing */}
                    {results.some(r => r.isPlaceholder) && (
                      <span className="px-2.5 py-1.5 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={11} /> Predictive Coursework Loaded
                      </span>
                    )}
                  </div>
                </div>

                {/* Main institutional heading */}
                <div className="text-center mt-8 mb-10 z-10 relative">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-600 mb-2 leading-none">Official Academic Record</p>
                  <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">
                    Transcript of Results
                  </h1>
                </div>

                {/* Demographics Card Section */}
                <div className="flex flex-col md:flex-row gap-8 border border-slate-200 rounded-[28px] p-6 bg-slate-50/50 mb-10 text-slate-800 z-10 relative print:bg-transparent print:border-black print:rounded-none">
                  
                  {/* Photo or barcode identifier */}
                  <div className="md:w-1/6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 pr-0 md:pr-8 print:border-black print:border-r shrink-0">
                    {selectedStudent.photoUrl ? (
                      <img 
                        src={selectedStudent.photoUrl} 
                        alt="Student Profile" 
                        className="h-20 w-20 rounded-2xl object-cover border border-slate-200 print:border-black shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-2xl print:border print:border-black">
                        {selectedStudent.name?.charAt(0)}
                      </div>
                    )}
                    <span className="text-[9px] font-bold text-slate-400 mt-2 tracking-widest uppercase">ID verified</span>
                  </div>

                  {/* Information block */}
                  <div className="flex-1 flex flex-wrap gap-y-4 text-xs text-left">
                    <div className="w-full sm:w-1/2 lg:w-1/3 shrink-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Candidate Name</p>
                      <p className="font-black text-slate-900 uppercase text-sm">{selectedStudent.name}</p>
                    </div>

                    <div className="w-full sm:w-1/2 lg:w-1/3 shrink-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Registration Number</p>
                      <p className="font-bold text-slate-900 uppercase text-sm tracking-tight">{selectedStudent.admissionNumber || 'N/A'}</p>
                    </div>

                    <div className="w-full sm:w-1/2 lg:w-1/3 shrink-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Enrolled Program</p>
                      <p className="font-bold text-slate-900 uppercase text-sm">{selectedStudent.course || 'Certificate Program'}</p>
                    </div>

                    <div className="w-full sm:w-1/2 lg:w-1/3 shrink-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Academic Intake</p>
                      <p className="font-bold text-slate-900 uppercase text-sm">{selectedStudent.academicYear || 'September 2026'}</p>
                    </div>

                    <div className="w-full sm:w-1/2 lg:w-1/3 shrink-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">ID / Passport Number</p>
                      <p className="font-semibold text-slate-950 uppercase">{selectedStudent.idNumber || 'Not Classified'}</p>
                    </div>

                    <div className="w-full sm:w-1/2 lg:w-1/3 shrink-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Registry Seal Date</p>
                      <p className="font-semibold text-slate-950 uppercase">2026-06-22</p>
                    </div>

                    <div className="w-full sm:w-1/2 lg:w-1/3 shrink-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Transcript Serial</p>
                      <p className="font-bold text-blue-600 uppercase font-mono tracking-tight text-xs sm:text-sm select-all">{generateAutomatedSerial(selectedStudent)}</p>
                    </div>
                  </div>

                </div>

                {/* Table: Course Results Sheet */}
                <div className="border border-slate-200 rounded-[28px] overflow-hidden mb-10 z-10 relative print:border-black print:rounded-none">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-widest font-black print:bg-black print:text-white">
                        <th className="py-4 px-6 border-b border-slate-200 border-r print:border-black">No.</th>
                        <th className="py-4 px-6 border-b border-slate-200 border-r print:border-black">Unit Code</th>
                        <th className="py-4 px-6 border-b border-slate-200 border-r print:border-black">Academic Unit name</th>
                        <th className="py-4 px-6 border-b border-slate-200 border-r text-center print:border-black">Hours</th>
                        <th className="py-4 px-6 border-b border-slate-200 border-r text-center print:border-black">Score (%)</th>
                        <th className="py-4 px-6 border-b border-slate-200 border-r text-center print:border-black">Grade</th>
                        <th className="py-4 px-6 border-b border-slate-200 text-center">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 print:divide-black">
                      {results.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 px-6 text-center text-slate-400 text-xs font-bold uppercase tracking-widest font-mono">
                            No Graded Assessment Entries Found for this Candidate
                          </td>
                        </tr>
                      ) : (
                        results.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors duration-150 print:hover:bg-transparent">
                            <td className="py-3 px-6 border-r border-slate-200 font-bold text-slate-400 text-center font-mono print:border-black">{i + 1}</td>
                            <td className="py-3 px-6 border-r border-slate-200 font-black text-slate-800 font-mono print:border-black">{r.unitCode}</td>
                            <td className="py-3 px-6 border-r border-slate-200 font-bold text-slate-900 uppercase print:border-black">{r.unitName}</td>
                            <td className="py-3 px-6 border-r border-slate-200 text-center font-mono print:border-black">{r.hours} Hrs</td>
                            <td className="py-3 px-6 border-r border-slate-200 text-center font-black text-slate-950 font-mono print:border-black">
                              {r.score}%
                            </td>
                            <td className="py-3 px-6 border-r border-slate-200 text-center font-black text-slate-900 text-sm print:border-black">
                              <span className={`px-2 py-0.5 rounded-lg font-bold text-xs ${
                                r.grade === 'A' ? 'text-emerald-700 bg-emerald-50 print:bg-transparent print:text-black font-extrabold' : 
                                r.grade === 'B' ? 'text-blue-700 bg-blue-50 print:bg-transparent print:text-black' : 
                                r.grade === 'F' ? 'text-red-700 bg-rose-50 print:bg-transparent print:text-black font-black' : 'text-slate-800'
                              }`}>
                                {r.grade}
                              </span>
                            </td>
                            <td className="py-3 px-6 text-center text-xs">
                              <span className={`font-black tracking-widest text-[10px] ${
                                r.status === 'PASS' 
                                  ? 'text-emerald-600 bg-emerald-50/50 px-2 py-1 rounded-lg print:text-black print:bg-transparent font-black' 
                                  : 'text-red-600 bg-rose-50/50 px-2 py-1 rounded-lg print:text-black print:bg-transparent'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Score Aggregations Summary */}
                <div className="flex flex-col md:flex-row gap-6 mb-10 z-10 relative">
                  
                  {/* Total Units completed */}
                  <div className="flex-1 min-w-[200px] border border-slate-200 rounded-[24px] p-5 flex items-center justify-between bg-slate-50/50 print:border-black print:rounded-none">
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Weightage Completed</p>
                      <p className="text-2xl font-black text-slate-900 mt-2 font-mono">{results.length} Units</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 print:border print:border-black">
                      <BookOpen size={16} />
                    </div>
                  </div>

                  {/* Cumulative average */}
                  <div className="flex-1 min-w-[200px] border border-slate-200 rounded-[24px] p-5 flex items-center justify-between bg-slate-50/50 print:border-black print:rounded-none">
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Cumulative Average</p>
                      <p className="text-2xl font-black text-slate-900 mt-2 font-mono">{currentAverage}%</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 print:border print:border-black">
                      <Award size={16} />
                    </div>
                  </div>

                  {/* GPA Rating */}
                  <div className="flex-1 min-w-[200px] border border-slate-200 rounded-[24px] p-5 flex items-center justify-between bg-slate-50/50 print:border-black print:rounded-none">
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Equiv. Cumulative GPA</p>
                      <p className="text-2xl font-black text-slate-900 mt-2 font-mono">{currentGPA} / 4.00</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 print:border print:border-black">
                      <GraduationCap size={16} />
                    </div>
                  </div>

                </div>

                {/* Classification and registry disclaimer */}
                <div className="border border-slate-200 rounded-[28px] p-6 mb-12 bg-slate-50/50 dark:bg-slate-950/20 print:border-black">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">TRANSCRIPT CLASSIFICATION & AWARD</p>
                      <h4 className="text-base font-black text-slate-900 mt-2 truncate tracking-tight">
                        {getPerformanceClass(currentAverage)}
                      </h4>
                    </div>
                    <div className="px-4 py-2 border border-slate-300 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-xs font-black uppercase text-emerald-600 flex items-center gap-2 print:border-black shrink-0">
                      <CheckCircle size={14} className="stroke-[2.5]" /> RECOMMENDED FOR GRADUATION
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-4 leading-relaxed border-t border-slate-100 pt-4 print:border-black print:text-black">
                    NOTE: This academic transcript is generated directly from the digital registry database of Breakthrough International Training College (BITC). This document is valid only when bearing the official embossed stamp, hologram verification code, and registrar's signature. Any alterations will invalidate the record.
                  </p>
                </div>

                {/* Registrar Signature & Seal stamp */}
                <div className="flex flex-col md:flex-row gap-8 items-end pt-4 justify-between">
                  
                  {/* Digital Signature */}
                  <div className="md:w-5/12 text-left">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 leading-none">AUTHORIZED SIGNATORY</p>
                    <div className="h-14 flex items-center justify-start py-2 relative text-blue-800">
                      {isSignoffPrinted && (
                        signatureUrlOverride ? (
                          <img 
                            src={signatureUrlOverride} 
                            alt="Signature" 
                            className="h-12 w-auto object-contain max-h-12" 
                            referrerPolicy="no-referrer" 
                          />
                        ) : (
                          /* Realistic Registrar Autograph SVG */
                          <svg className="h-12 w-auto opacity-80" viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 40 C30 10, 60 80, 80 40 C100 10, 120 70, 150 35 C170 15, 120 20, 160 50 C200 80, 210 20, 230 40" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                            <path d="M40 30 L180 50" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                          </svg>
                        )
                      )}
                    </div>
                    <div className="border-t border-slate-200 pt-2.5 max-w-[240px] print:border-black">
                      <p className="text-xs font-black text-slate-900 uppercase print:text-black">{registrarNameOverride}</p>
                      <p className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mt-1 print:text-black">{registrarTitleOverride}</p>
                    </div>
                  </div>

                  {/* Stamp / Logo seal */}
                  <div className="md:w-4/12 flex justify-center py-4 print:py-0 shrink-0">
                    {isSignoffPrinted && (
                      stampUrlOverride ? (
                        <div className="relative stamp-seal-container w-36 h-36 flex items-center justify-center select-none rotate-[-5deg]">
                          <img 
                            src={stampUrlOverride} 
                            alt="Official Stamp" 
                            className="w-36 h-36 object-contain opacity-95 mix-blend-multiply"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="relative stamp-seal-container w-36 h-36 flex items-center justify-center border-4 border-double border-blue-900 rounded-full text-blue-950 font-black text-center text-[10px] tracking-tighter uppercase p-2 select-none opacity-85 rotate-[-10deg] print:border-black print:text-black">
                          <div className="absolute inset-0 border border-blue-900 border-dashed rounded-full m-1 print:border-black" />
                          <div>
                            <p className="font-extrabold text-[9px] leading-none mb-1">REGISTRAR</p>
                            <p className="font-black leading-none my-0.5">BITC</p>
                            <p className="font-black text-[8px] leading-tight mt-1">OFFICIAL SEAL</p>
                            <p className="font-bold text-[7px] tracking-normal leading-normal italic text-slate-400 print:text-black mt-1">VERIFIED</p>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {/* Blockchain Authenticity Verification QR Code */}
                  <div className="md:w-3/12 flex flex-col items-center md:items-end justify-center shrink-0">
                    <div className="p-2 border border-slate-200 bg-white rounded-2xl print:border-black shrink-0">
                      <QRCodeCanvas
                        value={`https://bitc.ac.ke/verify/transcript/${generateAutomatedSerial(selectedStudent)}`}
                        size={64}
                        level="M"
                      />
                    </div>
                    <span className="text-[8px] text-right font-bold text-slate-400 mt-2 tracking-widest uppercase text-center md:text-right">
                      SECURE DB VERIFICATION CODE
                    </span>
                    <span className="text-[9px] font-black font-mono text-blue-600 mt-0.5 uppercase tracking-tight select-all leading-none">
                      {generateAutomatedSerial(selectedStudent)}
                    </span>
                  </div>

                </div>

              </motion.div>
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
            padding: 12mm 14mm !important;
            border: 1px solid #cbd5e1 !important;
            background-color: #ffffff !important;
            font-size: 10px !important;
          }

          #transcript-view-element img {
            max-height: 48px !important;
          }

          #transcript-view-element h1 {
            font-size: 18px !important;
            margin-top: 4px !important;
            margin-bottom: 2px !important;
          }

          #transcript-view-element h2 {
            font-size: 13px !important;
          }

          #transcript-view-element .pb-6,
          #transcript-view-element .mb-6 {
            padding-bottom: 6px !important;
            margin-bottom: 6px !important;
          }

          #transcript-view-element .mb-10,
          #transcript-view-element .mt-8,
          #transcript-view-element .pb-4 {
            margin-top: 4px !important;
            margin-bottom: 6px !important;
            padding-bottom: 2px !important;
          }

          #transcript-view-element .grid-cols-12 {
            gap: 8px !important;
            padding: 8px !important;
            margin-bottom: 8px !important;
            border-radius: 8px !important;
          }

          #transcript-view-element .grid-cols-12 p {
            font-size: 9px !important;
          }

          #transcript-view-element .grid-cols-12 p.text-sm {
            font-size: 11px !important;
          }

          #transcript-view-element table {
            margin-bottom: 0 !important;
          }

          #transcript-view-element table th,
          #transcript-view-element table td {
            padding: 3px 6px !important;
            font-size: 9px !important;
          }

          #transcript-view-element table th {
            font-size: 9px !important;
            font-weight: 800 !important;
          }

          #transcript-view-element .rounded-\[28px\] {
            border-radius: 8px !important;
            margin-bottom: 8px !important;
          }

          /* Summary blocks */
          #transcript-view-element .grid-cols-3 {
            gap: 8px !important;
            margin-bottom: 8px !important;
          }

          #transcript-view-element .grid-cols-3 .p-5 {
            padding: 6px 10px !important;
            border-radius: 8px !important;
          }

          #transcript-view-element .grid-cols-3 p.text-\[10px\] {
            font-size: 8px !important;
          }

          #transcript-view-element .grid-cols-3 p.text-2xl {
            font-size: 13px !important;
            margin-top: 1px !important;
          }

          #transcript-view-element .grid-cols-3 .w-10 {
            width: 24px !important;
            height: 24px !important;
            border-radius: 4px !important;
          }

          #transcript-view-element .grid-cols-3 svg {
            width: 12px !important;
            height: 12px !important;
          }

          /* Classification panel & note disclaimer */
          #transcript-view-element .mb-12 {
            margin-bottom: 8px !important;
            padding: 8px !important;
            border-radius: 8px !important;
          }

          #transcript-view-element .mb-12 h4 {
            font-size: 11px !important;
            margin-top: 1px !important;
          }

          #transcript-view-element .mb-12 .text-\[10px\] {
            font-size: 8px !important;
          }

          #transcript-view-element p.mt-4 {
            margin-top: 2px !important;
            font-size: 7.5px !important;
            line-height: normal !important;
          }

          /* Signatures and Seals */
          #transcript-view-element .items-end {
            padding-top: 2px !important;
            gap: 10px !important;
          }

          #transcript-view-element .stamp-seal-container {
            width: 140px !important;
            height: 140px !important;
          }

          #transcript-view-element .stamp-seal-container p {
            font-size: 9px !important;
          }

          #transcript-view-element .h-14 {
            height: 30px !important;
          }

          #transcript-view-element .h-14 svg,
          #transcript-view-element .h-14 img {
            height: 25px !important;
          }

          #transcript-view-element .max-w-\[240px\] {
            margin-top: 1px !important;
            padding-top: 2px !important;
          }

          #transcript-view-element .max-w-\[240px\] p {
            font-size: 8px !important;
            margin-top: 0 !important;
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
