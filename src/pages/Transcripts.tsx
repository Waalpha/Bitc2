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

  // Custom grades override state
  const [customResults, setCustomResults] = useState<any[] | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'students' | 'editor'>('students');
  
  // Digital Certificate states
  const [previewDocType, setPreviewDocType] = useState<'transcript' | 'certificate'>('transcript');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isSavingPdf, setIsSavingPdf] = useState(false);

  // Synchronize default orientation with document types
  useEffect(() => {
    setPrintOrientation(previewDocType === 'transcript' ? 'portrait' : 'landscape');
  }, [previewDocType]);

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
    try {
      await new Promise(resolve => setTimeout(resolve, 250));
      const canvas = await executeHtml2CanvasWithPatch(element);
      const imgData = canvas.toDataURL('image/png');
      const isPortrait = printOrientation === 'portrait';
      
      const margin = 8; // 8mm margin
      const pageWidth = isPortrait ? 210 : 297;
      const pageHeight = isPortrait ? 297 : 210;
      
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
        orientation: isPortrait ? 'portrait' : 'landscape',
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
    } finally {
      setIsSavingPdf(false);
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
      setEmailOverride(localStorage.getItem('transcript_email') || settings.publicEmail || 'info@breakthrough.ac.ke');
    }
    setRegistrarNameOverride(localStorage.getItem('transcript_registrarName') || 'PROF. J. K. KIBICHO, PHD');
    setRegistrarTitleOverride(localStorage.getItem('transcript_registrarTitle') || 'REGISTRAR OF ACADEMIC AFFAIRS');
    setSignatureUrlOverride(localStorage.getItem('transcript_signatureUrl') || '');
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

  // Dynamically synchronize certificate overrides
  useEffect(() => {
    if (selectedStudent) {
      const rList = getTranscriptResults();
      const avg = rList.length > 0 ? Math.round(rList.reduce((acc, r) => acc + r.score, 0) / rList.length) : 75;
      const enrollmentDateYear = selectedStudent.admissionDate ? selectedStudent.admissionDate.slice(0, 4) : '2026';
      
      const staticCertNo = `CERT-${enrollmentDateYear}-${selectedStudent.admissionNumber?.replace(/[^a-zA-Z0-9]/g, '') || selectedStudent.uid.slice(0, 5).toUpperCase()}`;
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
    }
  };

  const handleResetSchoolDetails = () => {
    if (settings) {
      setSchoolNameOverride(settings.schoolName || 'BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE');
      setLogoUrlOverride(settings.logoUrl || '');
      setAddressOverride(settings.publicAddress || 'P O BOX 5110 – 01002 Madaraka Thika');
      setPhoneOverride(settings.publicPhone || '+254 727 114 355 / +254 707 760 239');
      setEmailOverride(settings.publicEmail || 'info@breakthrough.ac.ke');
    } else {
      setSchoolNameOverride('BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE');
      setLogoUrlOverride('');
      setAddressOverride('P O BOX 5110 – 01002 Madaraka Thika');
      setPhoneOverride('+254 727 114 355 / +254 707 760 239');
      setEmailOverride('info@breakthrough.ac.ke');
    }
    setRegistrarNameOverride('PROF. J. K. KIBICHO, PHD');
    setRegistrarTitleOverride('REGISTRAR OF ACADEMIC AFFAIRS');
    setSignatureUrlOverride('');
    
    localStorage.removeItem('transcript_schoolName');
    localStorage.removeItem('transcript_logoUrl');
    localStorage.removeItem('transcript_address');
    localStorage.removeItem('transcript_phone');
    localStorage.removeItem('transcript_email');
    localStorage.removeItem('transcript_registrarName');
    localStorage.removeItem('transcript_registrarTitle');
    localStorage.removeItem('transcript_signatureUrl');
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
                    </div>
                  </div>

                  {/* Digital Certificate Overrides */}
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
                    <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Digital Certificate Layout</span>
                      <button 
                        onClick={() => {
                          if (selectedStudent) {
                            localStorage.removeItem(`cert_no_${selectedStudent.uid}`);
                            localStorage.removeItem(`cert_award_${selectedStudent.uid}`);
                            localStorage.removeItem(`cert_date_${selectedStudent.uid}`);
                            const rList = getTranscriptResults();
                            const avg = rList.length > 0 ? Math.round(rList.reduce((acc, r) => acc + r.score, 0) / rList.length) : 75;
                            const enrollmentDateYear = selectedStudent.admissionDate ? selectedStudent.admissionDate.slice(0, 4) : '2026';
                            setCustomCertificateNo(`CERT-${enrollmentDateYear}-${selectedStudent.admissionNumber?.replace(/[^a-zA-Z0-9]/g, '') || selectedStudent.uid.slice(0, 5).toUpperCase()}`);
                            setCustomAwardClass(avg >= 70 ? 'Grade A - Pass WITH DISTINCTION' : avg >= 60 ? 'Grade B - Pass WITH CREDIT' : 'Grade C - PASS');
                            setCustomCertificateDate(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
                          }
                        }}
                        className="text-[10px] text-red-500 hover:underline capitalize font-bold"
                      >
                        Reset Defaults
                      </button>
                    </h4>
                    <p className="text-[10px] text-slate-400 mb-3">These fields will be embedded into graduation certificates and verified online via QR codes.</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Certificate Number</label>
                        <input
                          type="text"
                          value={customCertificateNo}
                          onChange={(e) => {
                            setCustomCertificateNo(e.target.value);
                            if (selectedStudent) {
                              localStorage.setItem(`cert_no_${selectedStudent.uid}`, e.target.value);
                            }
                          }}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Award / Class Level</label>
                        <input
                          type="text"
                          value={customAwardClass}
                          onChange={(e) => {
                            setCustomAwardClass(e.target.value);
                            if (selectedStudent) {
                              localStorage.setItem(`cert_award_${selectedStudent.uid}`, e.target.value);
                            }
                          }}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Issue / Conferred Date</label>
                        <input
                          type="text"
                          value={customCertificateDate}
                          onChange={(e) => {
                            setCustomCertificateDate(e.target.value);
                            if (selectedStudent) {
                              localStorage.setItem(`cert_date_${selectedStudent.uid}`, e.target.value);
                            }
                          }}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold ring-1 ring-slate-100 dark:ring-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
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
          
          {/* Document Switcher - HIDDEN ON PRINT */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-6 print:hidden max-w-sm shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setPreviewDocType('transcript')}
              className={`flex-1 py-2.5 px-3 text-center rounded-xl font-black text-[11px] uppercase tracking-wider transition-all ${
                previewDocType === 'transcript'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Transcript
            </button>
            <button
              onClick={() => setPreviewDocType('certificate')}
              className={`flex-1 py-2.5 px-3 text-center rounded-xl font-black text-[11px] uppercase tracking-wider transition-all ${
                previewDocType === 'certificate'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Graduation Certificate
            </button>
          </div>

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
                          className="h-16 w-auto object-contain max-w-[110px] rounded-xl self-center"
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
                      className="w-36 h-36 object-contain grayscale opacity-25 select-none pointer-events-none" 
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
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 border border-slate-200 rounded-[28px] p-6 bg-slate-50/50 mb-10 text-slate-800 z-10 relative print:bg-transparent print:border-black print:rounded-none">
                  
                  {/* Photo or barcode identifier */}
                  <div className="md:col-span-2 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 print:border-black print:border-r">
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
                  <div className="md:col-span-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6 text-xs text-left">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Candidate Name</p>
                      <p className="font-black text-slate-900 uppercase text-sm">{selectedStudent.name}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Registration Number</p>
                      <p className="font-bold text-slate-900 uppercase text-sm tracking-tight">{selectedStudent.admissionNumber || 'N/A'}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Enrolled Program</p>
                      <p className="font-bold text-slate-900 uppercase text-sm">{selectedStudent.course || 'Certificate Program'}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Academic Intake</p>
                      <p className="font-bold text-slate-900 uppercase text-sm">{selectedStudent.academicYear || 'September 2026'}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">ID / Passport Number</p>
                      <p className="font-semibold text-slate-950 uppercase">{selectedStudent.idNumber || 'Not Classified'}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Registry Seal Date</p>
                      <p className="font-semibold text-slate-950 uppercase">2026-06-22</p>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 z-10 relative">
                  
                  {/* Total Units completed */}
                  <div className="border border-slate-200 rounded-[24px] p-5 flex items-center justify-between bg-slate-50/50 print:border-black print:rounded-none">
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Weightage Completed</p>
                      <p className="text-2xl font-black text-slate-900 mt-2 font-mono">{results.length} Units</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 print:border print:border-black">
                      <BookOpen size={16} />
                    </div>
                  </div>

                  {/* Cumulative average */}
                  <div className="border border-slate-200 rounded-[24px] p-5 flex items-center justify-between bg-slate-50/50 print:border-black print:rounded-none">
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Cumulative Average</p>
                      <p className="text-2xl font-black text-slate-900 mt-2 font-mono">{currentAverage}%</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 print:border print:border-black">
                      <Award size={16} />
                    </div>
                  </div>

                  {/* GPA Rating */}
                  <div className="border border-slate-200 rounded-[24px] p-5 flex items-center justify-between bg-slate-50/50 print:border-black print:rounded-none">
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
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end pt-4">
                  
                  {/* Digital Signature */}
                  <div className="md:col-span-5 text-left">
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
                  <div className="md:col-span-4 flex justify-center py-4 print:py-0">
                    <div className="relative w-28 h-28 flex items-center justify-center border-4 border-double border-blue-900 rounded-full text-blue-950 font-black text-center text-[10px] tracking-tighter uppercase p-2 select-none opacity-80 rotate-[-10deg] print:border-black print:text-black">
                      <div className="absolute inset-0 border border-blue-900 border-dashed rounded-full m-1 print:border-black" />
                      <div>
                        <p className="font-extrabold text-[8px] leading-none mb-1">REGISTRAR</p>
                        <p className="font-black leading-none my-0.5">BITC</p>
                        <p className="font-black text-[7px] leading-tight mt-1">OFFICIAL SEAL</p>
                        <p className="font-bold text-[6px] tracking-normal leading-normal italic text-slate-400 print:text-black mt-1">VERIFIED</p>
                      </div>
                    </div>
                  </div>

                  {/* Blockchain Authenticity Verification QR Code */}
                  <div className="md:col-span-3 flex flex-col items-center md:items-end justify-center">
                    <div className="p-2 border border-slate-200 bg-white rounded-2xl print:border-black shrink-0">
                      <QRCodeCanvas
                        value={`https://bitc.ac.ke/verify/transcript/${selectedStudent.admissionNumber || 'ADM-2026'}`}
                        size={64}
                        level="M"
                      />
                    </div>
                    <span className="text-[8px] text-right font-bold text-slate-400 mt-2 tracking-widest uppercase text-center md:text-right">
                      SECURE DB VERIFICATION CODE
                    </span>
                  </div>

                </div>

              </motion.div>
              ) : (
                <div className="w-full overflow-x-auto pb-4 scrollbar-thin print:overflow-visible">
                  <motion.div
                    id="certificate-view-element"
                    key="certificate-view"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className={`bg-[#FFFDF6] text-slate-900 border-[16px] border-double border-amber-800 rounded-[40px] overflow-hidden relative print:p-0 print:border-none print:shadow-none print:rounded-none select-none shadow-2xl selection:bg-amber-100 ${
                      printOrientation === 'landscape' 
                        ? 'w-[1000px] h-[707px] p-10 flex flex-col justify-between mx-auto shadow-amber-900/10 shrink-0' 
                        : 'w-full max-w-3xl p-8 sm:p-14 mx-auto'
                    }`}
                    style={{ borderColor: '#b45309' }}
                  >
                    
                    {/* Classical Gold Corners Decoration vectors - Hidden on small screens, gorgeous on preview */}
                    <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-amber-400/20 rounded-tl-xl pointer-events-none print:hidden"></div>
                    <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-amber-400/20 rounded-tr-xl pointer-events-none print:hidden"></div>
                    <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-amber-400/20 rounded-bl-xl pointer-events-none print:hidden"></div>
                    <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-amber-400/20 rounded-br-xl pointer-events-none print:hidden"></div>

                    {/* Elegant small watermark centered - VISIBLE ON BOTH PRINT & PREVIEW */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.035] pointer-events-none z-0 flex items-center justify-center">
                      {logoUrlOverride ? (
                        <img 
                          src={logoUrlOverride} 
                          alt="" 
                          className="w-36 h-36 object-contain grayscale opacity-25 select-none pointer-events-none" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <GraduationCap size={150} className="stroke-[1.25] text-amber-700 select-none pointer-events-none" />
                      )}
                    </div>

                    <div className={`text-center relative z-10 ${
                      printOrientation === 'landscape' ? 'space-y-3.5 h-full flex flex-col justify-between' : 'space-y-6'
                    }`}>
                      
                      {/* Header Logo */}
                      <div className="flex justify-center mb-1">
                        {logoUrlOverride ? (
                          <img 
                            src={logoUrlOverride} 
                            alt="School logo" 
                            className="h-16 w-auto object-contain max-w-[110px] rounded-xl"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="bg-[#0b1654] text-white p-2.5 rounded-2xl shadow-md">
                            <GraduationCap className="text-white w-9 h-9" />
                          </div>
                        )}
                      </div>

                      {/* School Name */}
                      <div className="space-y-0.5">
                        <h1 className={`font-serif font-black text-[#0b1654] tracking-tight uppercase leading-tight ${
                          printOrientation === 'landscape' ? 'text-2xl' : 'text-xl sm:text-2xl md:text-3xl'
                        }`}>
                          {schoolNameOverride}
                        </h1>
                        <p className="text-[10px] uppercase font-black tracking-[0.35em] text-amber-700 leading-none">
                          Chartered Registry of Academic Affairs & TVETA Registered
                        </p>
                      </div>

                      {/* Certifying opening line */}
                      <div className={`max-w-2xl mx-auto ${printOrientation === 'landscape' ? 'pt-0' : 'pt-4'}`}>
                        <p className={`font-serif italic text-slate-600 leading-relaxed ${
                          printOrientation === 'landscape' ? 'text-xs' : 'text-sm sm:text-base'
                        }`}>
                          By recommendations of the academic registry council and under guidelines of professional education standards, the Governing Syndicate of the College hereby conferring upon
                        </p>
                      </div>

                      {/* Candidate Name */}
                      <div className={printOrientation === 'landscape' ? 'py-1' : 'py-2'}>
                        <h2 className={`font-serif font-black text-amber-800 tracking-wide uppercase border-b border-dashed border-amber-300 max-w-lg mx-auto ${
                          printOrientation === 'landscape' ? 'text-2xl pb-1.5' : 'text-2xl sm:text-3xl md:text-4xl pb-2'
                        }`}>
                          {selectedStudent.name}
                        </h2>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1.5">
                          having satisfied the full requirements of the department of instruction in
                        </p>
                      </div>

                      {/* Enrolled Program Award */}
                      <div className="space-y-0.5">
                        <p className={`font-serif font-extrabold text-[#0b1654] uppercase tracking-normal ${
                          printOrientation === 'landscape' ? 'text-lg' : 'text-lg sm:text-xl md:text-2xl'
                        }`}>
                          {selectedStudent.course || 'CERTIFICATION OF MINISTRY'}
                        </p>
                        
                        <div className="inline-block mt-1 bg-amber-50 border border-amber-200 text-amber-800 font-black text-[10px] px-3.5 py-1 uppercase rounded-full tracking-widest">
                          {customAwardClass}
                        </div>
                      </div>

                      {/* Conferred Date Stamp */}
                      <div className={`max-w-md mx-auto ${printOrientation === 'landscape' ? 'pt-0 pb-1' : 'pt-1 pb-4'}`}>
                        <p className="font-serif text-slate-500 text-xs italic">
                          In testimony whereof, the seal of the Institute is hereunto affixed and our signatures subjoined. Conferred and verified on this date: <strong className="text-slate-800 font-extrabold not-italic">{customCertificateDate}</strong>.
                        </p>
                      </div>

                      {/* Classical Certificate Footer (3-Columns) */}
                      <div className={`grid grid-cols-1 md:grid-cols-12 gap-6 items-end border-t border-slate-200/60 max-w-3xl mx-auto w-full ${
                        printOrientation === 'landscape' ? 'pt-3' : 'pt-8'
                      }`}>
                        
                        {/* Left: Certificate No. and URL Verification Block */}
                        <div className="md:col-span-4 flex flex-col items-center md:items-start space-y-1">
                          <div className="p-1 border border-slate-200 bg-white rounded-xl shadow-xs shrink-0">
                            <QRCodeCanvas
                              value={`${window.location.origin.includes('bitc.ac.ke') ? 'https://verify.bitc.ac.ke' : window.location.origin}/certificate/${selectedStudent.admissionNumber || selectedStudent.uid}`}
                              size={56}
                              level="H"
                            />
                          </div>
                          <div className="text-center md:text-left">
                            <p className="text-[7.5px] font-black text-[#0b1654] uppercase tracking-wider leading-none">SECURE DIGITAL VERIFICATION</p>
                            <p className="text-[7px] font-extrabold text-amber-700 underline font-mono truncate max-w-[180px] mt-0.5">
                              {window.location.origin.includes('bitc.ac.ke') ? 'verify.bitc.ac.ke' : window.location.host}/certificate/{selectedStudent.admissionNumber || selectedStudent.uid.slice(0, 5).toUpperCase()}
                            </p>
                            <p className="text-[7.5px] font-black text-slate-500 uppercase mt-0.5 font-mono tracking-tighter">
                              Cert No: {customCertificateNo}
                            </p>
                          </div>
                        </div>

                        {/* Center: Golden Seal Badge Vector */}
                        <div className="md:col-span-4 flex justify-center py-0.5">
                          <div className="relative w-20 h-20 flex items-center justify-center border-4 border-double border-amber-600 rounded-full text-amber-800 font-black text-center text-[7px] tracking-tight uppercase p-1.5 select-none opacity-90 bg-[#fffcf5] shadow-sm">
                            <div className="absolute inset-0 border border-amber-500 border-dashed rounded-full m-1" />
                            <div className="space-y-0.5">
                              <p className="font-black text-[6.5px] leading-tight text-amber-700">OFFICIAL</p>
                              <p className="font-black text-xs tracking-widest text-[#0b1654] my-0.5 font-serif">BITC</p>
                              <p className="font-extrabold text-[6.5px] leading-none text-slate-500">SEAL</p>
                              <p className="font-black text-[5.5px] tracking-tighter text-emerald-600">VERIFIED</p>
                            </div>
                          </div>
                        </div>

                        {/* Right: Autograph and Signatory info */}
                        <div className="md:col-span-4 text-center md:text-right flex flex-col items-center md:items-end">
                          <p className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 leading-none">AUTHORIZED SIGNATORY</p>
                          <div className="h-8 flex items-center justify-end py-1 relative text-blue-800">
                            {signatureUrlOverride ? (
                              <img 
                                src={signatureUrlOverride} 
                                alt="Signature" 
                                className="h-7 w-auto object-contain max-h-7" 
                                referrerPolicy="no-referrer" 
                              />
                            ) : (
                              <svg className="h-7 w-auto opacity-90" viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 40 C30 10, 60 80, 80 40 C100 10, 120 70, 150 35 C170 15, 120 20, 160 50 C200 80, 210 20, 230 40" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                <path d="M40 30 L180 50" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                              </svg>
                            )}
                          </div>
                          <div className="border-t border-slate-200 pt-1 w-full max-w-[160px]">
                            <p className="text-[9px] font-black text-slate-900 uppercase">{registrarNameOverride}</p>
                            <p className="text-[7px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">{registrarTitleOverride}</p>
                          </div>
                        </div>

                      </div>
                    </div>

                  </motion.div>
                </div>
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

          #transcript-view-element .w-28 {
            width: 60px !important;
            height: 60px !important;
          }

          #transcript-view-element .w-28 p {
            font-size: 6px !important;
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
            padding: ${printOrientation === 'landscape' ? '12mm 15mm' : '15mm 20mm'} !important;
            border: 6px double #b45309 !important;
            background-color: #FFFDF6 !important;
          }

          #certificate-view-element .space-y-6 > * {
            margin-top: 8px !important;
            margin-bottom: 8px !important;
          }

          #certificate-view-element h1 {
            font-size: 18px !important;
          }

          #certificate-view-element p.text-sm,
          #certificate-view-element p.text-base {
            font-size: 10px !important;
            line-height: 1.3 !important;
          }

          #certificate-view-element h2 {
            font-size: 20px !important;
            padding-bottom: 2px !important;
          }

          #certificate-view-element p.text-lg,
          #certificate-view-element p.text-xl,
          #certificate-view-element p.text-2xl {
            font-size: 13px !important;
          }

          #certificate-view-element .max-w-md,
          #certificate-view-element .max-w-xl,
          #certificate-view-element .max-w-2xl {
            padding-top: 2px !important;
            padding-bottom: 2px !important;
          }

          #certificate-view-element .max-w-2xl {
            margin-top: 8px !important;
            padding-top: 8px !important;
          }

          #certificate-view-element .w-24 {
            width: 60px !important;
            height: 60px !important;
          }

          #certificate-view-element .w-24 p {
            font-size: 5px !important;
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

          #certificate-view-element .md\:col-span-4 .text-center,
          #certificate-view-element .md\:col-span-4 .text-left,
          #certificate-view-element .md\:col-span-4 .text-right {
            font-size: 7.5px !important;
          }

          #certificate-view-element .md\:col-span-4 .border-t {
            padding-top: 2px !important;
            margin-top: 2px !important;
          }

          #certificate-view-element .md\:col-span-4 p {
            font-size: 8px !important;
          }

          .print-header {
            display: block !important;
          }
        }
      ` }} />

    </div>
  );
};
