import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, limit, addDoc, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Class, Unit, Exam, AttendanceRecord, AppNotification, FeeBalance, Submission, Expense, TimetableEntry, DayOfWeek } from '../types';
import { Users, BookOpen, FileText, ClipboardCheck, ArrowRight, Bell, Share2, Copy, Check, Megaphone, Send, XCircle, Wallet, Paperclip, File as FileIcon, Image as ImageIcon, Loader2, PieChart as PieIcon, Plus, ChevronDown, ChevronRight, GraduationCap, TrendingUp, TrendingDown, Lock, Download, Calendar, Fingerprint, QrCode, Award, Clock, Sparkles, Video, MapPin, MessageSquare, CreditCard } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isWeekend } from 'date-fns';
import { Toast, ToastMessage } from '../components/Toast';
import { motion, AnimatePresence } from 'motion/react';
import { NotificationBell } from '../components/NotificationBell';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from 'recharts';
import html2canvas from 'html2canvas';
import { withOklabOklchPatch } from '../utils/canvasPatch';
import { jsPDF } from 'jspdf';

import { uploadFile } from '../services/uploadService';

export const Dashboard: React.FC = () => {
  const { user, userData, settings, hasPermission, studentContext } = useAuth();
  const [stats, setStats] = useState({
    classes: 0,
    units: 0,
    exams: 0,
    attendance: 0,
    students: 0,
    teachers: 0,
    parents: 0,
    staff: 0,
    totalUsers: 0
  });
  const [todayLessons, setTodayLessons] = useState<TimetableEntry[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [recentExams, setRecentExams] = useState<Exam[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<Exam[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [feeBalance, setFeeBalance] = useState<FeeBalance | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [viewingNotif, setViewingNotif] = useState<AppNotification | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', message: '', classId: '', broadcast: false });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sentAnnouncements, setSentAnnouncements] = useState<AppNotification[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [myAttendance, setMyAttendance] = useState<AttendanceRecord[]>([]);
  const [nextLesson, setNextLesson] = useState<TimetableEntry | null>(null);
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [myUnits, setMyUnits] = useState<Unit[]>([]);
  const [allFeeBalances, setAllFeeBalances] = useState<FeeBalance[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Student ID Card Custom States for Student Portal
  const [showStudentIDModal, setShowStudentIDModal] = useState(false);
  const [idCardThemeColor, setIdCardThemeColor] = useState<'indigo' | 'blue' | 'emerald' | 'rose' | 'amber' | 'slate'>('indigo');
  const [idCardOrientation, setIdCardOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [idCardCustomRole, setIdCardCustomRole] = useState('STUDENT');
  const [idCardShowBack, setIdCardShowBack] = useState(false);
  const [isSavingPng, setIsSavingPng] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);

  const ShareAppCard = () => {
    const shareUrl = window.location.origin;
    
    const handleShare = async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: settings?.appTitle || 'BITC Smart LMS',
            text: 'Access the Smart Learning Management Portal here:',
            url: shareUrl,
          });
        } catch (error) {
          console.log('Error sharing', error);
        }
      } else {
        handleCopyLink();
      }
    };

    return (
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Share2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Share App</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Invite others to the portal</p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 flex items-center justify-between gap-4">
            <code className="text-xs font-mono text-blue-600 truncate flex-1">{shareUrl}</code>
            <button 
              onClick={handleCopyLink}
              className="p-2 hover:bg-slate-200/60 rounded-lg transition-colors text-slate-500 hover:text-slate-800"
            >
              {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={handleShare}
              className="bg-blue-600 text-white font-bold py-3.5 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm hover:bg-blue-700 transition-all active:scale-95"
            >
              <Send size={16} /> Share Link
            </button>
            <button 
              onClick={() => setShowQR(true)}
              className="bg-slate-100 text-slate-800 font-bold py-3.5 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-200 transition-all active:scale-95"
            >
              <QrCode size={16} /> View QR
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-start gap-3">
              <div className="bg-amber-50 p-2 rounded-lg text-amber-600 shrink-0">
                <Download size={14} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">How to Install</p>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                  Open this link in your mobile browser, tap <b>Share</b> or <b>Menu</b>, and select <b>"Add to Home Screen"</b> to install as an app.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* QR Modal */}
        <AnimatePresence>
          {showQR && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setShowQR(false)}
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white p-10 rounded-[40px] shadow-2xl flex flex-col items-center text-center max-w-sm w-full"
              >
                <div className="mb-6 p-4 bg-slate-50 rounded-3xl ring-8 ring-slate-50/50">
                  <QRCodeCanvas 
                    value={shareUrl} 
                    size={200}
                    level="H"
                    includeMargin={false}
                    imageSettings={{
                      src: settings?.logoUrl || "/logo.png",
                      x: undefined,
                      y: undefined,
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Scan to Access</h3>
                <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed px-4">
                  Point your camera at this code to quickly open the portal on another device.
                </p>
                <button 
                  onClick={() => setShowQR(false)}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-transform"
                >
                  Close
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const addToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    addToast("Portal link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const executeHtml2CanvasWithPatch = async (element: HTMLElement) => {
    return withOklabOklchPatch(async () => {
      const isPortrait = idCardOrientation === 'portrait';
      const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        width: isPortrait ? 310 : 480,
        height: isPortrait ? 480 : 300
      });
      return canvas;
    });
  };

  const handleSaveAsPNG = async (student: any) => {
    const cardEl = document.getElementById('id-card-preview-element-student');
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

  const handleSaveAsPDF = async (student: any) => {
    const cardEl = document.getElementById('id-card-preview-element-student');
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

  const getValidUntil = (student: any) => {
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

  const handlePrintIdCard = (student: any) => {
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

    const colors = {
      indigo: { primary: '#4f46e5', text: '#ffffff', light: '#e0e7ff', border: '#c7d2fe' },
      blue: { primary: '#2563eb', text: '#ffffff', light: '#dbeafe', border: '#bfdbfe' },
      emerald: { primary: '#059669', text: '#ffffff', light: '#d1fae5', border: '#a7f3d0' },
      rose: { primary: '#e11d48', text: '#ffffff', light: '#ffe4e6', border: '#fecdd3' },
      amber: { primary: '#d97706', text: '#ffffff', light: '#fef3c7', border: '#fde68a' },
      slate: { primary: '#1e293b', text: '#ffffff', light: '#f1f5f9', border: '#e2e8f0' },
    };

    const scheme = colors[idCardThemeColor] || colors.indigo;

    const canvasEl = document.getElementById(`qr-canvas-student-${student.uid}`) as HTMLCanvasElement;
    const qrDataUrl = canvasEl ? canvasEl.toDataURL() : '';

    const photoPlaceholder = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(student.name)}&backgroundColor=cbd5e1`;
    const photoSrc = student.photoUrl || photoPlaceholder;

    const classLabel = (student.classIds?.[0] && classes.find(c => c.id === student.classIds[0])?.name) || student.course || 'ICT Department';

    let cardHtml = '';
    if (idCardOrientation === 'portrait') {
      cardHtml = `
        <div class="card-container portrait border-${idCardThemeColor}">
          <div class="card-side front">
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

            <div class="student-photo-wrapper" style="border-color: ${scheme.primary}33;">
              <img src="${photoSrc}" class="student-photo-img" />
            </div>

            <div class="student-info-section">
              <div class="info-row">
                <div class="info-label">NAME</div>
                <div class="info-colon">:</div>
                <div class="info-value name-value">${student.name.toUpperCase()}</div>
              </div>
              <div class="info-row">
                <div class="info-label">REG NO</div>
                <div class="info-colon">:</div>
                <div class="info-value font-mono">${student.admissionNumber || 'PENDING'}</div>
              </div>
              <div class="info-row">
                <div class="info-label">COURSE</div>
                <div class="info-colon">:</div>
                <div class="info-value truncate">${classLabel.toUpperCase()}</div>
              </div>
              <div class="info-row">
                <div class="info-label">EXPIRY</div>
                <div class="info-colon">:</div>
                <div class="info-value expiry-value">${getValidUntil(student)}</div>
              </div>
            </div>

            <div class="badge-footer">
              <div class="qr-code-block">
                ${qrDataUrl ? `<img src="${qrDataUrl}" class="qr-image" />` : `<div class="qr-placeholder">QR</div>`}
                <div class="qr-subtitle">
                  <div class="qr-heading">HOLDER CHECK</div>
                  <div class="qr-url font-mono">${window.location.host}/verify</div>
                </div>
              </div>
              <div class="signature-block">
                <div class="signature-line" style="border-bottom: 1px solid ${scheme.border};">
                  <span class="signature-fallback">Registrar</span>
                </div>
                <div class="signature-label">AUTHORIZED</div>
              </div>
            </div>
          </div>

          <div style="page-break-after: always;"></div>

          <div class="card-side back">
            <div class="back-accent-bar" style="background-color: ${scheme.primary};"></div>
            <div class="back-header">
              <div class="back-school-name">${schoolName}</div>
              <div class="back-system-title">OFFICIAL IDENTIFICATION SYSTEM</div>
            </div>
            <div class="back-rules-list">
              <div class="rules-heading">RULES & POLICIES</div>
              <ul>
                <li>This card is non-transferable and remains physical property of the institution.</li>
                <li>Visibly display your badge inside classes or campus gates.</li>
                <li>Report lost cards to the Registrar's Office immediately.</li>
              </ul>
            </div>
            <div class="back-contact-info" style="border-top: 1px dashed ${scheme.border};">
              <p>Email: ${schoolEmail}</p>
              <p>Tel: ${schoolPhone}</p>
              <p>Address: ${schoolAddress}</p>
            </div>
            <div class="back-footer-bar" style="background-color: ${scheme.primary}; color: ${scheme.text};">
              <span>EXCEL & GROW ALWAYS</span>
              <span>ID: ${student.uid.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      cardHtml = `
        <div class="card-container landscape border-${idCardThemeColor}">
          <div class="card-side front-landscape">
            <div class="card-header-landscape" style="background-color: ${scheme.primary}; color: ${scheme.text};">
              <div class="school-logo-container-landscape">
                ${schoolLogo ? `<img src="${schoolLogo}" class="school-logo-img-landscape" />` : `<div class="logo-fallback-landscape">★</div>`}
              </div>
              <div class="school-header-text-landscape">
                <div class="school-name-landscape">${schoolName}</div>
                <div class="school-motto-landscape">EXCELLENCE & CREATIVITY</div>
              </div>
            </div>

            <div class="flex-landscape-body">
              <div class="left-landscape-col">
                <div class="student-photo-wrapper-landscape" style="border-color: ${scheme.primary}33;">
                  <img src="${photoSrc}" class="student-photo-img" />
                </div>
                <div class="qr-code-block-landscape" style="border: 1px solid ${scheme.border};">
                  ${qrDataUrl ? `<img src="${qrDataUrl}" class="qr-image" />` : `<div class="qr-placeholder">QR</div>`}
                </div>
              </div>

              <div class="right-landscape-col">
                <div class="id-badge-tag-landscape" style="background-color: ${scheme.primary}; color: ${scheme.text};">
                  ${idCardCustomRole.toUpperCase()}
                </div>

                <div class="student-info-section-landscape">
                  <div class="info-row">
                    <div class="info-label">NAME</div>
                    <div class="info-colon">:</div>
                    <div class="info-value name-value">${student.name.toUpperCase()}</div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">REG NO</div>
                    <div class="info-colon">:</div>
                    <div class="info-value font-mono">${student.admissionNumber || 'PENDING'}</div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">COURSE</div>
                    <div class="info-colon">:</div>
                    <div class="info-value truncate">${classLabel.toUpperCase()}</div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">EXPIRY</div>
                    <div class="info-colon">:</div>
                    <div class="info-value expiry-value">${getValidUntil(student)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style="page-break-after: always;"></div>

          <div class="card-side back-landscape">
            <div class="back-header-landscape" style="background-color: ${scheme.primary}; color: ${scheme.text};">
              <div class="back-school-name">${schoolName}</div>
              <div class="back-system-title-landscape">OFFICIAL IDENTIFICATION SYSTEM</div>
            </div>
            
            <div class="back-grid-landscape">
              <div class="policies-col">
                <div class="rules-heading">RULES & POLICIES</div>
                <p>This badge identifies the verified holder. Please keep visual at all events. If lost, report to Administration immediately.</p>
              </div>
              <div class="contacts-col" style="border-left: 1px solid ${scheme.border};">
                <p>Email: ${schoolEmail}</p>
                <p>Phone: ${schoolPhone}</p>
                <p>Address: ${schoolAddress}</p>
              </div>
            </div>

            <div class="back-footer-bar-landscape" style="background-color: ${scheme.light}; color: ${scheme.primary}; border-top: 1px solid ${scheme.border};">
              <span>FOUND THIS BADGE? RETURN TO REGISTRAR'S OFFICE</span>
              <span class="font-mono">ID: ${student.uid.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Student ID Badge - ${student.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@700&display=swap');
          
          body {
            background-color: #f1f5f9;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: 'Inter', sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @media print {
            body {
              background-color: #ffffff;
              padding: 0;
              margin: 0;
            }
            .no-print {
              display: none !important;
            }
            .card-container {
              box-shadow: none !important;
              margin: 0 !important;
              border: none !important;
            }
          }

          .no-print-header {
            margin-bottom: 20px;
            text-align: center;
            background: white;
            padding: 15px 30px;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          }

          .print-btn {
            background-color: #4f46e5;
            color: white;
            border: none;
            padding: 10px 24px;
            font-weight: 750;
            border-radius: 8px;
            cursor: pointer;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.1em;
            transition: all 0.2s;
          }

          .print-btn:hover {
            background-color: #3730a3;
          }

          /* PORTRAIT STYLES */
          .portrait {
            width: 325px;
            height: 500px;
          }

          .card-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
            overflow: hidden;
            border: 1px solid #e2e8f0;
            margin-bottom: 30px;
            position: relative;
            background-color: #ffffff;
          }

          .card-side {
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background-color: #ffffff;
          }

          .front {
            padding-bottom: 0px;
          }

          .card-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 14px 12px;
            text-align: center;
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }

          .school-logo-container {
            width: 36px;
            height: 36px;
            background: white;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2px;
            box-sizing: border-box;
            flex-shrink: 0;
          }

          .school-logo-img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }

          .logo-fallback {
            font-size: 20px;
            font-weight: 900;
            color: #1e293b;
          }

          .school-header-text {
            text-align: left;
            flex: 1;
            min-width: 0;
          }

          .school-name {
            font-size: 11px;
            font-weight: 900;
            line-height: 1.1;
            letter-spacing: -0.01em;
            text-transform: uppercase;
          }

          .school-motto {
            font-size: 6px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            opacity: 0.8;
            margin-top: 2px;
          }

          .id-badge-tag {
            text-align: center;
            padding: 4px 12px;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.25em;
            margin: 10px auto 0;
            border-radius: 9999px;
            display: inline-block;
          }

          .student-photo-wrapper {
            width: 110px;
            height: 115px;
            border-radius: 12px;
            border: 2px solid #e2e8f0;
            overflow: hidden;
            margin: 12px auto 0;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
            background-color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .student-photo-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .student-info-section {
            padding: 12px 18px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            flex-grow: 1;
            justify-content: center;
          }

          .info-row {
            display: flex;
            align-items: center;
            font-size: 11px;
            line-height: 1.2;
          }

          .info-label {
            width: 80px;
            font-weight: 900;
            color: #64748b;
            letter-spacing: 0.05em;
            font-size: 8px;
          }

          .info-colon {
            width: 10px;
            font-weight: 700;
            color: #94a3b8;
          }

          .info-value {
            font-weight: 900;
            color: #1e293b;
            flex: 1;
            min-width: 0;
            text-align: left;
          }

          .name-value {
            color: #0f172a;
            font-size: 11.5px;
          }

          .expiry-value {
            color: #dc2626;
          }

          .badge-footer {
            background-color: #f8fafc;
            border-top: 1px solid #e2e8f0;
            padding: 10px 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .qr-code-block {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .qr-image {
            width: 44px;
            height: 44px;
          }

          .qr-subtitle {
            text-align: left;
            line-height: 1.1;
          }

          .qr-heading {
            font-size: 7px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.05em;
          }

          .qr-url {
            font-size: 6px;
            font-weight: 700;
            color: #4b5563;
          }

          .signature-block {
            text-align: right;
          }

          .signature-line {
            width: 75px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .signature-fallback {
            font-family: cursive;
            font-size: 10px;
            color: #4338ca;
            opacity: 0.7;
          }

          .signature-label {
            font-size: 5px;
            font-weight: 900;
            color: #94a3b8;
            letter-spacing: 0.1em;
            margin-top: 4px;
          }

          /* PORTRAIT BACK */
          .back {
            padding: 16px;
          }

          .back-accent-bar {
            height: 4px;
            width: 100%;
            border-radius: 2px;
          }

          .back-header {
            text-align: center;
            margin: 15px 0 25px;
          }

          .back-school-name {
            font-size: 11px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
          }

          .back-system-title {
            font-size: 7px;
            font-weight: 900;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            margin-top: 4px;
          }

          .back-rules-list {
            text-align: left;
            padding: 0 10px;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }

          .rules-heading {
            font-size: 8px;
            font-weight: 900;
            color: #475569;
            letter-spacing: 0.1em;
            margin-bottom: 8px;
            text-transform: uppercase;
          }

          .back-rules-list ul {
            padding-left: 12px;
            margin: 0;
            list-style-type: square;
          }

          .back-rules-list li {
            font-size: 7.5px;
            color: #64748b;
            font-weight: 600;
            line-height: 1.5;
            margin-bottom: 8px;
          }

          .back-contact-info {
            padding: 10px;
            text-align: left;
            font-size: 7px;
            color: #64748b;
            font-weight: 600;
            line-height: 1.4;
          }

          .back-contact-info p {
            margin: 2px 0;
          }

          .back-footer-bar {
            padding: 6px 12px;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            font-size: 7px;
            font-weight: 900;
            letter-spacing: 0.05em;
          }

          /* LANDSCAPE STYLES */
          .landscape {
            width: 500px;
            height: 325px;
          }

          .front-landscape {
            display: flex;
            flex-direction: column;
            padding: 0;
          }

          .card-header-landscape {
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .school-logo-container-landscape {
            width: 32px;
            height: 32px;
            background: white;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2px;
            box-sizing: border-box;
          }

          .school-logo-img-landscape {
            max-width: 100%;
            max-height: 100%;
          }

          .logo-fallback-landscape {
            font-size: 16px;
            font-weight: 950;
            color: #1e293b;
          }

          .school-header-text-landscape {
            text-align: left;
          }

          .school-name-landscape {
            font-size: 12px;
            font-weight: 950;
            text-transform: uppercase;
            line-height: 1.1;
          }

          .school-motto-landscape {
            font-size: 5.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            margin-top: 2px;
          }

          .flex-landscape-body {
            display: flex;
            flex: 1;
            padding: 10px 16px;
            gap: 16px;
            box-sizing: border-box;
          }

          .left-landscape-col {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            width: 90px;
            flex-shrink: 0;
          }

          .student-photo-wrapper-landscape {
            width: 86px;
            height: 90px;
            border-radius: 8px;
            border: 2px solid #e2e8f0;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8fafc;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
          }

          .qr-code-block-landscape {
            width: 60px;
            height: 60px;
            border-radius: 6px;
            background: white;
            padding: 3px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .right-landscape-col {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          .id-badge-tag-landscape {
            align-self: flex-end;
            padding: 4px 14px;
            border-radius: 9999px;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.2em;
          }

          .student-info-section-landscape {
            display: flex;
            flex-direction: column;
            gap: 4.5px;
            justify-content: center;
            flex-grow: 1;
          }

          /* BACK LANDSCAPE */
          .back-landscape {
            background-color: #ffffff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          .back-header-landscape {
            padding: 10px 16px;
            text-align: center;
          }

          .back-system-title-landscape {
            font-size: 6.5px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            margin-top: 3px;
            opacity: 0.8;
          }

          .back-grid-landscape {
            display: flex;
            flex-grow: 1;
            padding: 14px 16px;
            box-sizing: border-box;
            align-items: center;
          }

          .policies-col {
            flex-grow: 1;
            padding-right: 14px;
            text-align: left;
          }

          .policies-col p {
            font-size: 8px;
            color: #64748b;
            font-weight: 600;
            line-height: 1.45;
            margin: 0;
          }

          .contacts-col {
            width: 180px;
            flex-shrink: 0;
            padding-left: 14px;
            text-align: left;
            font-size: 7.5px;
            color: #64748b;
            font-weight: 600;
            line-height: 1.5;
          }

          .contacts-col p {
            margin: 2px 0;
          }

          .back-footer-bar-landscape {
            padding: 7px 16px;
            display: flex;
            justify-content: space-between;
            font-size: 7.5px;
            font-weight: 900;
            letter-spacing: 0.05em;
          }

          .font-mono {
            font-family: 'JetBrains Mono', monospace;
          }

          .truncate {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        </style>
      </head>
      <body>
        <div class="no-print no-print-header">
          <button class="print-btn" onclick="window.print()">Print ID Badge</button>
        </div>
        ${cardHtml}
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Attempting to send announcement:", newAnnouncement);
    
    if (!newAnnouncement.title || !newAnnouncement.message || (!newAnnouncement.broadcast && !newAnnouncement.classId) || !user) {
      addToast("Please fill in all fields (Title, Message, and " + (newAnnouncement.broadcast ? "" : "Class") + ").", "error");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let attachmentUrl = '';
      let attachmentType = '';
      let attachmentName = '';

      if (attachment) {
        const uploadResult = await uploadFile(attachment, (progress) => {
          setUploadProgress(progress);
        });
        attachmentUrl = uploadResult.url;
        
        attachmentType = attachment.type.startsWith('image/') ? 'image' : 
                         attachment.type === 'application/pdf' ? 'pdf' : 
                         (attachment.type.includes('msword') || attachment.type.includes('officedocument')) ? 'word' : 'file';
        attachmentName = attachment.name;
      }

      console.log("Querying recipients for announcement. Broadcast:", newAnnouncement.broadcast);
      
      let recipientsQ;
      if (newAnnouncement.broadcast) {
        recipientsQ = query(collection(db, 'users'), where('role', 'in', ['student', 'teacher', 'admin', 'staff']));
      } else {
        // For specific class, we fetch class members AND we want ALL staff to see it
        recipientsQ = query(collection(db, 'users'), where('role', 'in', ['teacher', 'admin', 'staff']));
      }
        
      const recipientsSnap = await getDocs(recipientsQ);
      let recipients = recipientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      if (!newAnnouncement.broadcast) {
        // Also fetch students of the specific class
        const classStudentsQ = query(collection(db, 'users'), where('classIds', 'array-contains', newAnnouncement.classId), where('role', '==', 'student'));
        const classStudentsSnap = await getDocs(classStudentsQ);
        const classStudents = classStudentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        // Merge and deduplicate
        const mergedMap = new Map();
        recipients.forEach(r => mergedMap.set(r.id, r));
        classStudents.forEach(s => mergedMap.set(s.id, s));
        recipients = Array.from(mergedMap.values());
      }

      // Filter out self if desired (usually you want to see your own sent announcement in your inbox too)
      // Actually, if we exclude self here, it won't show in our "Notice Board" under "Received". 
      // But we have "My Sent". Let's keep self for simplicity and to ensure it shows up in "Received" too.
      
      console.log(`Found ${recipients.length} total recipients including staff.`);
      
      if (recipients.length === 0) {
        addToast(newAnnouncement.broadcast ? "No recipients found in the system." : "No recipients found in this class.", "error");
        setIsUploading(false);
        return;
      }
      
      const MAX_BATCH_SIZE = 450; // Safety margin
      const batches = [];
      let currentBatch = writeBatch(db);
      let count = 0;

      // Create individual notifications for all recipients
      for (const recipient of recipients) {
        const notifRef = doc(collection(db, 'notifications'));
        const notification: any = {
          userId: recipient.id,
          senderId: user.uid,
          title: newAnnouncement.title,
          message: newAnnouncement.message,
          type: 'announcement',
          read: false,
          createdAt: new Date().toISOString(),
          attachmentUrl: attachmentUrl || null,
          attachmentType: attachmentType || null,
          attachmentName: attachmentName || null
        };
        
        // Remove any undefined fields to prevent Firestore errors
        Object.keys(notification).forEach(key => {
          if (notification[key] === undefined) delete notification[key];
        });
        
        currentBatch.set(notifRef, notification);
        count++;

        if (count >= MAX_BATCH_SIZE) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          count = 0;
        }
      }

      // Add the master record to the current (or new) batch
      const masterRef = doc(collection(db, 'notifications'));
      const masterData: any = {
        userId: 'SYSTEM_ANNOUNCEMENT_ARCHIVE',
        senderId: user.uid,
        senderName: userData?.name || 'Staff',
        title: newAnnouncement.title,
        message: newAnnouncement.message,
        type: 'announcement',
        read: true,
        createdAt: new Date().toISOString(),
        attachmentUrl: attachmentUrl || null,
        attachmentType: attachmentType || null,
        attachmentName: attachmentName || null,
        targetClassId: newAnnouncement.broadcast ? 'all' : newAnnouncement.classId
      };
      
      // Sanitization
      Object.keys(masterData).forEach(key => {
        if (masterData[key] === undefined) delete masterData[key];
      });

      currentBatch.set(masterRef, masterData);
      batches.push(currentBatch);
      
      console.log(`Committing ${batches.length} batches for ${recipients.length + 1} total records...`);
      await Promise.all(batches.map(b => b.commit()));
      console.log("Announcement broadcast complete.");
      
      setIsAnnouncing(false);
      setNewAnnouncement({ title: '', message: '', classId: '', broadcast: false });
      setAttachment(null);
      addToast("Announcement sent successfully!");
    } catch (error) {
      console.error("Announcement error:", error);
      handleFirestoreError(error, OperationType.CREATE, 'notifications/announcement');
      addToast("Failed to send announcement. Check console for details.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const isTeacher = userData?.role === 'teacher';

  useEffect(() => {
    if (!user) return;

    const fetchAllData = async () => {
      try {
        const isStudentOrParent = userData?.role === 'student' || userData?.role === 'parent';
        const targetClassIds = isStudentOrParent ? (studentContext?.classIds || userData?.classIds) : userData?.classIds;
        const targetStudentId = studentContext?.uid || user.uid;

        // Stats and Classes
        const statsClassesQ = (isTeacher || userData?.role === 'admin')
          ? query(collection(db, 'classes'))
          : query(collection(db, 'classes'), where('__name__', 'in', (targetClassIds && targetClassIds.length > 0) ? targetClassIds : ['none']));

        const classesSnap = await getDocs(statsClassesQ);
        setStats(prev => ({ ...prev, classes: classesSnap.size }));
        setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Class)));

        const unitsSnap = await getDocs(query(collection(db, 'units')));
        setStats(prev => ({ ...prev, units: unitsSnap.size }));

        const examsQ = isTeacher
          ? query(collection(db, 'exams'), where('teacherId', '==', user.uid))
          : query(collection(db, 'exams'), where('published', '==', true));
        
        const examsSnap = await getDocs(examsQ);
        setStats(prev => ({ ...prev, exams: examsSnap.size }));
        const allExams = examsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Exam));
        setExams(allExams);
        setRecentExams(allExams.slice(0, 3));
        
        const now = new Date();
        const deadlines = allExams
          .filter(e => e.dueDate && new Date(e.dueDate) > now)
          .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
          .slice(0, 3);
        setUpcomingDeadlines(deadlines);

        // Notifications
        const notifQ = query(
          collection(db, 'notifications'), 
          where('userId', '==', user.uid),
          limit(50)
        );
        const notifSnap = await getDocs(notifQ);
        const allNotifs = notifSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as AppNotification));
        setNotifications(allNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

        const sentQ = query(
          collection(db, 'notifications'),
          where('userId', '==', 'SYSTEM_ANNOUNCEMENT_ARCHIVE'),
          limit(50)
        );
        const sentSnap = await getDocs(sentQ);
        const allSent = sentSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as AppNotification));
        setSentAnnouncements(allSent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

        // Users
        const usersSnap = await getDocs(collection(db, 'users'));
        const counts = { students: 0, teachers: 0, parents: 0, staff: 0 };
        usersSnap.docs.forEach(doc => {
          const u = doc.data();
          if (u.role === 'student') counts.students++;
          else if (u.role === 'teacher') counts.teachers++;
          else if (u.role === 'parent') counts.parents++;
          else if (u.role === 'staff' || u.role === 'admin') counts.staff++;
        });
        setStats(prev => ({ 
          ...prev, 
          students: counts.students,
          teachers: counts.teachers,
          parents: counts.parents,
          staff: counts.staff,
          totalUsers: usersSnap.size
        }));

        // Attendance
        const attendanceSnap = await getDocs(collection(db, 'attendance'));
        setStats(prev => ({ ...prev, attendance: attendanceSnap.size }));
        if (isStudentOrParent) {
          const studentRecords = attendanceSnap.docs
            .map(doc => ({ id: doc.id, ...(doc.data() as any) } as AttendanceRecord))
            .filter(r => r.records[targetStudentId])
            .sort((a, b) => b.date.localeCompare(a.date));
          setMyAttendance(studentRecords);
        }

        // Submissions
        const subQ = isStudentOrParent
          ? query(collection(db, 'submissions'), where('studentId', '==', targetStudentId))
          : query(collection(db, 'submissions'));
        const subSnap = await getDocs(subQ);
        setSubmissions(subSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Submission)));

        // My Units
        if (isStudentOrParent && targetClassIds?.length) {
          const myUnitsQ = query(collection(db, 'units'), where('classId', 'in', targetClassIds));
          const myUnitsSnap = await getDocs(myUnitsQ);
          setMyUnits(myUnitsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Unit)));
        }

        // Timetable
        let timetableQ;
        if (isStudentOrParent && targetClassIds?.length) {
          timetableQ = query(collection(db, 'timetable'), where('classId', '==', targetClassIds[0]));
        } else if (isTeacher) {
          timetableQ = query(collection(db, 'timetable'), where('teacherId', '==', user.uid));
        }
        if (timetableQ) {
          const timetableSnap = await getDocs(timetableQ);
          const entries = timetableSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as TimetableEntry));
          const currentDay = format(now, 'EEEE') as DayOfWeek;
          const currentTimeStr = format(now, 'HH:mm');
          const todayLessons = entries.filter(e => e.day === currentDay).sort((a, b) => a.startTime.localeCompare(b.startTime));
          setTodayLessons(todayLessons);
          setNextLesson(todayLessons.find(e => e.startTime > currentTimeStr) || null);
        }

        // Finance
        if (isStudentOrParent) {
          const feesQ = query(collection(db, 'fees'), where('studentId', '==', targetStudentId));
          const feesSnap = await getDocs(feesQ);
          if (!feesSnap.empty) {
            setFeeBalance({ id: feesSnap.docs[0].id, ...(feesSnap.docs[0].data() as any) } as FeeBalance);
          } else {
            setFeeBalance(null);
          }
        }
        if (hasPermission('view_finance')) {
          const allFeesSnap = await getDocs(collection(db, 'fees'));
          setAllFeeBalances(allFeesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as FeeBalance)));
          const allExpensesSnap = await getDocs(collection(db, 'expenses'));
          setAllExpenses(allExpensesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Expense)));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'dashboard-data');
      }
    };

    fetchAllData();
  }, [user, isTeacher, userData?.role, userData?.uid, userData?.classIds?.join(','), studentContext, hasPermission]);

  // Deduplicate fee balances by studentId to prevent double-counting
  const uniqueFeeBalances = React.useMemo(() => {
    const map = new Map<string, FeeBalance>();
    // Sort oldest to newest so newest overwrites in loop
    const sorted = [...allFeeBalances].sort((a, b) => (a.lastUpdated || '').localeCompare(b.lastUpdated || ''));
    
    sorted.forEach(fb => {
      if (!fb.studentId) return;
      const sId = String(fb.studentId).trim();
      const existing = map.get(sId);
      
      const balDate = fb.lastUpdated || '';
      const existingDate = existing?.lastUpdated || '';
      
      const balIsUidMatch = fb.id === sId;
      const existingIsUidMatch = existing?.id === sId;

      if (!existing) {
        map.set(sId, fb);
      } else if (balIsUidMatch && !existingIsUidMatch) {
        map.set(sId, fb);
      } else if (balIsUidMatch === existingIsUidMatch) {
        if (balDate >= existingDate) {
          map.set(sId, fb);
        }
      }
    });
    return Array.from(map.values());
  }, [allFeeBalances]);

  // Calculate real financial data
  const realFinancialData = React.useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    const monthlyData = months.map(month => ({
      month,
      income: 0,
      billings: 0,
      expense: 0
    }));

    // Aggregate Income and Billings from Fees history
    uniqueFeeBalances.forEach(fb => {
      fb.history?.forEach(h => {
        const date = new Date(h.date);
        if (date.getFullYear() === currentYear) {
          const monthIdx = date.getMonth();
          if (h.type === 'payment') {
            monthlyData[monthIdx].income += h.amount;
          } else if (h.type === 'charge') {
            monthlyData[monthIdx].billings += h.amount;
          }
        }
      });
    });

    // Aggregate Expenses
    allExpenses.forEach(exp => {
      const date = new Date(exp.date);
      if (date.getFullYear() === currentYear) {
        monthlyData[date.getMonth()].expense += exp.amount;
      }
    });

    return monthlyData.slice(0, new Date().getMonth() + 1); // Only show up to current month
  }, [uniqueFeeBalances, allExpenses]);

  const totalFinancialStats = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    
    // Yearly totals (matching the chart scope)
    let yearlyIncome = 0;
    let yearlyBillings = 0;
    let yearlyExpenses = 0;

    uniqueFeeBalances.forEach(fb => {
      fb.history?.forEach(h => {
        const date = new Date(h.date);
        if (date.getFullYear() === currentYear) {
          if (h.type === 'payment') yearlyIncome += h.amount;
          else if (h.type === 'charge') yearlyBillings += h.amount;
        }
      });
    });

    allExpenses.forEach(exp => {
      const date = new Date(exp.date);
      if (date.getFullYear() === currentYear) yearlyExpenses += exp.amount;
    });

    // Lifetime totals (for overall context)
    const lifetimeCollections = uniqueFeeBalances.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
    const lifetimeBillings = uniqueFeeBalances.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
    const totalLifetimeExpenses = allExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return {
      income: yearlyIncome,
      billings: yearlyBillings,
      expenses: yearlyExpenses,
      profit: yearlyIncome - yearlyExpenses,
      lifetimeIncome: lifetimeCollections,
      lifetimeExpenses: totalLifetimeExpenses,
      outstanding: lifetimeBillings - lifetimeCollections
    };
  }, [uniqueFeeBalances, allExpenses]);

  const statCards = React.useMemo(() => [
    { name: 'Total', value: stats.totalUsers, label: 'Total Users', icon: Users, color: 'bg-gradient-to-br from-slate-800 to-slate-900' },
    { name: 'Students', value: stats.students, label: 'Enrollments', icon: GraduationCap, color: 'bg-gradient-to-br from-blue-600 to-blue-800' },
    { name: 'Units', value: stats.units, label: 'Active Units', icon: BookOpen, color: 'bg-gradient-to-br from-indigo-600 to-indigo-800' },
    { name: 'Exams', value: stats.exams, label: 'Assessments', icon: FileText, color: 'bg-gradient-to-br from-violet-600 to-violet-800' },
    { name: 'Revenue', value: `Ksh ${totalFinancialStats.income.toLocaleString()}`, label: 'Yearly Income', icon: Wallet, color: 'bg-gradient-to-br from-emerald-600 to-emerald-800' },
  ], [stats, totalFinancialStats.income]);

  const scanCards = React.useMemo(() => [
    { 
      name: 'Revenue 💰', 
      value: `Ksh ${totalFinancialStats.income.toLocaleString()}`, 
      label: 'Yearly Income', 
      icon: Wallet, 
      indicatorColor: 'bg-[#10B981]', 
      to: '/fees',
      emoji: '💰'
    },
    { 
      name: 'Students 👥', 
      value: `${stats.students} Enrolled`, 
      label: 'Enrollments & Users', 
      icon: GraduationCap, 
      indicatorColor: 'bg-[#2563EB]', 
      to: '/students',
      emoji: '👥'
    },
    { 
      name: 'Metrics 📈', 
      value: `${stats.units} Units / ${stats.exams} Exams`, 
      label: 'Academic Performance', 
      icon: BookOpen, 
      indicatorColor: 'bg-[#F59E0B]', 
      to: '/dashboard',
      emoji: '📈'
    },
    { 
      name: 'Schedule 📅', 
      value: `${todayLessons.length} Classes Today`, 
      label: 'Timetable & Lessons', 
      icon: Calendar, 
      indicatorColor: 'bg-[#8B5CF6]', 
      to: '/dashboard',
      emoji: '📅'
    },
  ], [stats, totalFinancialStats.income, todayLessons.length]);

  // Mock financial data for the "LOOK"
  const incomeData = [
    { month: 'Jan', income: 450000, expense: 320000 },
    { month: 'Feb', income: 520000, expense: 410000 },
    { month: 'Mar', income: 490000, expense: 380000 },
    { month: 'Apr', income: 223650, expense: 0 },
  ];

  const yearlyData = [
    { month: 'Jan', income: 1008800, expense: 86300 },
    { month: 'Feb', income: 250000, expense: 120000 },
    { month: 'Mar', income: 110000, expense: 40000 },
    { month: 'Apr', income: 223650, expense: 0 },
  ];

  // Chart Data Calculation
  const performanceData = React.useMemo(() => {
    const data = [
      { name: 'Pass', value: 0, color: '#10B981' },
      { name: 'Fail', value: 0, color: '#EF4444' },
      { name: 'Ungraded', value: 0, color: '#94A3B8' }
    ];

    submissions.forEach(sub => {
      const exam = exams.find(e => e.id === sub.examId);
      if (!exam) return;
      
      if (sub.grade === undefined || sub.grade === null) {
        data[2].value++;
      } else if (sub.grade >= (exam.passingMarks || 40)) {
        data[0].value++;
      } else {
        data[1].value++;
      }
    });
    return data;
  }, [submissions, exams]);

  const userDistributionData = React.useMemo(() => [
    { name: 'Students', value: stats.students, color: '#17c2d7' },
    { name: 'Teachers', value: stats.teachers, color: '#8e54e9' },
    { name: 'Parents', value: stats.parents, color: '#4776e6' },
    { name: 'Staff', value: stats.staff, color: '#d63384' }
  ].filter(d => d.value > 0), [stats]);

  const calendarDays = React.useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const hasChartData = performanceData.some(d => d.value > 0);

  const studentAttendanceStats = React.useMemo(() => {
    if (!myAttendance.length) return { present: 0, total: 0, percentage: 0 };
    const targetStudentId = studentContext?.uid || user!.uid;
    const total = myAttendance.length;
    const present = myAttendance.filter(r => r.records[targetStudentId] === 'present' || r.records[targetStudentId] === 'late').length;
    return { present, total, percentage: Math.round((present / total) * 100) };
  }, [myAttendance, user, studentContext]);

  const verifiedToday = React.useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const targetStudentId = studentContext?.uid || user!.uid;
    const record = myAttendance.find(r => r.date === today);
    return !!record?.biometricLogs?.[targetStudentId];
  }, [myAttendance, user, studentContext]);

  // Student Portal Component
  const renderStudentPortal = () => {
    const isParent = userData?.role === 'parent';
    const displayStudent = isParent ? studentContext : userData;

    const pendingAssignmentsCount = exams.filter(e => {
      const isSubmitted = submissions.some(s => s.examId === e.id);
      return !isSubmitted && e.dueDate && new Date(e.dueDate) > new Date();
    }).length;

    const now = new Date();
    const dateStr = format(now, 'EEE, MMM d');

    return (
      <div className="space-y-6 pb-20 -mt-4">
        {/* Top Header - Mobile Specific */}
        <div className="flex items-center justify-between lg:hidden mb-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/10 ring-2 ring-blue-500/20 shadow-2xl">
                {displayStudent?.photoUrl ? (
                  <img src={displayStudent.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white font-bold text-xl">
                    {displayStudent?.name?.charAt(0)}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-[#0B1221] rounded-full" />
            </div>
            
            <div className="max-w-[150px] sm:max-w-none">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded-md uppercase tracking-widest border border-blue-500/10">Active</span>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{isParent ? "Child" : "Student"}</p>
              </div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight truncate">
                {displayStudent?.name?.split(' ')[0] || "Student"} <span className="animate-bounce inline-block">👋</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className={settings?.logoUrl ? "transform hover:scale-110 transition-transform" : "bg-white p-1 rounded-xl shadow-xl shadow-black/20 transform hover:scale-110 transition-transform"}>
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                  BI
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Program & Date Row */}
        <div className="flex items-center justify-between">
          <div className="bg-blue-600/10 px-5 py-2.5 rounded-2xl border border-blue-500/20 flex items-center gap-2.5 backdrop-blur-md">
            <GraduationCap size={18} className="text-blue-400" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
              {displayStudent?.classIds?.[0] ? classes.find(c => c.id === displayStudent.classIds[0])?.name || "Diploma in ICT" : "Diploma in ICT"}
            </span>
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{dateStr}</p>
        </div>

        {/* Highlights Banner */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-blue-600/10 p-7 rounded-[32px] border border-blue-500/10 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-6 text-blue-400/20 group-hover:scale-110 transition-transform duration-500">
            <TrendingUp size={80} />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-400 mb-4">
              <BookOpen size={20} />
            </div>
            <p className="text-xl font-bold text-blue-100 leading-snug">
              {isParent ? "Selected student has" : "You have"} <span className="text-blue-400 font-extrabold">{todayLessons.length} classes</span> today and <span className="text-blue-400 font-extrabold">{pendingAssignmentsCount} pending</span> assignment
            </p>
          </div>
        </motion.div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
           <Link to="/fees" className="bg-[#1A1F2E] p-7 rounded-[32px] border border-white/5 space-y-6 hover:bg-white/5 transition-colors group shadow-lg">
             <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
               <Wallet size={24} />
             </div>
             <div>
               <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">KSh {feeBalance?.balance?.toLocaleString() || "0"}</h3>
               <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">Fees Balance <br/> remaining</p>
             </div>
           </Link>

           <div className="bg-[#1A1F2E] p-7 rounded-[32px] border border-white/5 space-y-6 shadow-lg">
             <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
               <Clock size={24} />
             </div>
             <div>
               <h3 className="text-2xl font-bold text-white tracking-tight">{nextLesson?.startTime || "--:--"}</h3>
               <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.2em] mt-1 leading-relaxed">
                 Next Class <br/> 
                 <span className="text-gray-400 truncate block max-w-full">{nextLesson?.unitName || "No Classes"}</span>
               </p>
             </div>
           </div>

           <Link to="/attendance" className="bg-[#1A1F2E] p-7 rounded-[32px] border border-white/5 space-y-6 hover:bg-white/5 transition-colors group shadow-lg">
             <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${verifiedToday ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary/10 text-primary'}`}>
                  <ClipboardCheck size={24} />
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${verifiedToday ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-500'}`}>
                    {verifiedToday ? 'Verified' : 'Pending'}
                  </span>
                </div>
             </div>
             <div>
               <h3 className="text-2xl font-bold text-white tracking-tight">{studentAttendanceStats.percentage}%</h3>
               <div className="mt-2 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                 <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${studentAttendanceStats.percentage}%` }}
                    className={`h-full rounded-full ${studentAttendanceStats.percentage >= 75 ? 'bg-emerald-500' : studentAttendanceStats.percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                 />
               </div>
               <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.2em] mt-3">Monthly Attendance</p>
             </div>
           </Link>

           <div 
             onClick={() => setShowStudentIDModal(true)} 
             className="bg-gradient-to-br from-[#1E2538] to-[#111726] p-7 rounded-[32px] border border-blue-500/20 space-y-6 hover:bg-white/5 cursor-pointer transition-all group shadow-lg ring-1 ring-blue-500/10 hover:shadow-blue-500/5 hover:-translate-y-1 duration-300"
           >
             <div className="flex items-center justify-between">
               <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                 <QrCode size={24} />
               </div>
               <div>
                 <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 tracking-wider">
                   Secured ID
                 </span>
               </div>
             </div>
             <div>
               <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                 ID Badge <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
               </h3>
               <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.2em] mt-1.5 leading-relaxed">
                 View Physical <br/>
                 <span className="text-blue-400 font-extrabold">Student ID Badge</span>
               </p>
             </div>
           </div>
        </div>

        {/* Notice Board Section for Students */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="w-1.5 h-6 bg-blue-600 rounded-full" />
              Notice Board
            </h3>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                {notifications.filter(n => !n.read).length} NEW
              </span>
            )}
          </div>
          
          <div className="space-y-4">
            {notifications.length > 0 ? (
              notifications.slice(0, 5).map((notif, idx) => (
                <motion.div
                  key={`${notif.id}_student_${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-6 rounded-[28px] border transition-all relative overflow-hidden group shadow-sm ${
                    !notif.read 
                    ? 'bg-white border-blue-200 ring-2 ring-blue-500/10' 
                    : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3.5 rounded-2xl shrink-0 ${
                      notif.type === 'fee' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      notif.type === 'exam' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {notif.type === 'fee' ? <Wallet size={20} /> :
                       notif.type === 'exam' ? <FileText size={20} /> :
                       <Bell size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="font-bold text-base text-slate-900 tracking-tight break-words">{notif.title}</h4>
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg uppercase tracking-wide whitespace-nowrap">
                          {format(new Date(notif.createdAt), 'MMM dd, HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed font-medium break-words whitespace-pre-wrap">{notif.message}</p>
                      
                      {notif.attachmentUrl && (
                        <a
                          href={notif.attachmentUrl.startsWith('http') ? `/api/download?url=${encodeURIComponent(notif.attachmentUrl)}&filename=${encodeURIComponent(notif.attachmentName || 'attachment')}` : notif.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 rounded-xl text-xs font-bold text-blue-600 uppercase tracking-widest transition-all border border-slate-200"
                        >
                          <Paperclip size={14} /> View Attachment
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-white p-10 rounded-[28px] border border-slate-200 text-center shadow-sm">
                <Bell className="mx-auto text-slate-400 mb-3 opacity-60" size={32} />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No recent announcements</p>
              </div>
            )}
            {notifications.length > 5 && (
              <Link to="/messages" className="block text-center text-xs font-bold text-blue-600 uppercase tracking-widest hover:underline py-2">
                View All Messages
              </Link>
            )}

            {/* Global Archive for Students */}
            {sentAnnouncements.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-200 space-y-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2">Global System Broadcasts</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sentAnnouncements.slice(0, 4).map((notif, idx) => (
                    <div key={`${notif.id}_student_announcement_${idx}`} className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-300 transition-colors shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                          {format(new Date(notif.createdAt), 'MMM dd, yyyy')}
                        </p>
                        <Megaphone size={14} className="text-blue-600 opacity-60" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1 truncate uppercase">{notif.title}</h4>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Daily Schedule Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
              Today's Schedule
            </h3>
            <Link to="/timetable" className="text-xs font-bold text-blue-400 uppercase tracking-widest hover:underline">Full Timetable</Link>
          </div>

          <div className="space-y-4">
            {todayLessons.length > 0 ? (
              todayLessons.map((lesson, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={`${lesson.id}_${idx}`} 
                  className="bg-[#1A1F2E] p-6 rounded-[32px] border border-white/5 flex items-center justify-between relative overflow-hidden group hover:border-white/10 transition-all"
                >
                  <div className="flex items-center gap-6">
                    <div className="text-center min-w-[70px]">
                      <p className="text-xl font-bold text-white">{lesson.startTime}</p>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                        {parseInt(lesson.startTime) >= 12 ? 'PM' : 'AM'}
                      </p>
                    </div>
                    <div className="w-px h-12 bg-white/10" />
                    <div>
                      <h4 className="text-base font-bold text-white leading-none tracking-tight mb-2">{lesson.unitName}</h4>
                      <div className="flex items-center gap-2">
                         <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{lesson.teacherName}</span>
                         <span className="w-1 h-1 bg-gray-700 rounded-full" />
                         <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{lesson.room}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Indicator or Join Button */}
                  <div className="flex items-center gap-3">
                    {idx === 1 && ( // Match image's visual where second item has a join button
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => addToast("Connecting to live session...", "success")}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-600/30 active:bg-blue-700"
                      >
                        Join Class <Video size={14} />
                      </motion.button>
                    )}
                    <div className={`w-1.5 h-12 rounded-full ${idx === 0 ? 'bg-slate-700' : 'bg-blue-500'} transition-all`} />
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-[#1A1F2E] p-12 rounded-[32px] border border-white/5 text-center">
                <Calendar className="mx-auto text-gray-800 mb-4" size={48} />
                <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-xs">No Classes Scheduled Today</p>
              </div>
            )}
          </div>
        </div>

        {/* Share App Section */}
        <ShareAppCard />

        {/* Student ID Card Modal */}
        <AnimatePresence>
          {showStudentIDModal && displayStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
                onClick={() => setShowStudentIDModal(false)}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 30 }}
                className="relative bg-bg-card border border-white/10 rounded-[32px] p-6 sm:p-8 w-full max-w-4xl shadow-2xl flex flex-col md:flex-row gap-8 items-center md:items-start my-auto max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar"
              >
                {/* Customizer Panel */}
                <div className="w-full md:w-80 space-y-6 flex-shrink-0 text-left">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Your Digital ID Card</h2>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5">Customize and Download Badge</p>
                  </div>

                  {/* Orientation Settings */}
                  <div className="space-y-2">
                    <label className="block text-[10px] text-text-muted uppercase tracking-widest font-bold">Orientation</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setIdCardOrientation('portrait');
                          setIdCardShowBack(false);
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                          idCardOrientation === 'portrait'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        Portrait
                      </button>
                      <button
                        onClick={() => {
                          setIdCardOrientation('landscape');
                          setIdCardShowBack(false);
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                          idCardOrientation === 'landscape'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        Landscape
                      </button>
                    </div>
                  </div>

                  {/* Theme Color Settings */}
                  <div className="space-y-2">
                    <label className="block text-[10px] text-text-muted uppercase tracking-widest font-bold">Design Theme</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['indigo', 'blue', 'emerald', 'rose', 'amber', 'slate'] as const).map((color) => (
                        <button
                          key={color}
                          onClick={() => setIdCardThemeColor(color)}
                          className={`py-1.5 px-2 rounded-xl text-[10px] font-bold text-center capitalize transition-all border ${
                            idCardThemeColor === color
                              ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                              : 'border-white/5 bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card side Settings */}
                  <div className="space-y-2">
                    <label className="block text-[10px] text-text-muted uppercase tracking-widest font-bold">Badge Side</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setIdCardShowBack(false)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                          !idCardShowBack
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        Front Side
                      </button>
                      <button
                        onClick={() => setIdCardShowBack(true)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                          idCardShowBack
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        Back Side
                      </button>
                    </div>
                  </div>

                  {/* Actions Package */}
                  <div className="pt-4 border-t border-white/5 space-y-3">
                    <button
                      onClick={() => handleSaveAsPNG(displayStudent)}
                      disabled={isSavingPng}
                      className="w-full bg-blue-600 py-3 rounded-xl text-white font-bold text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10 disabled:opacity-50"
                    >
                      {isSavingPng ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      Save as PNG Image
                    </button>
                    <button
                      onClick={() => handleSaveAsPDF(displayStudent)}
                      disabled={isSavingPdf}
                      className="w-full bg-[#1A1F2E] text-white hover:bg-white/5 border border-white/5 py-3 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSavingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      Save as PDF Badge
                    </button>
                    <button
                      onClick={() => handlePrintIdCard(displayStudent)}
                      className="w-full bg-slate-800 text-white hover:bg-slate-700 py-3 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Share2 size={14} />
                      Print Official Card
                    </button>
                    <button
                      onClick={() => setShowStudentIDModal(false)}
                      className="w-full text-center text-[10px] text-gray-500 font-bold uppercase tracking-widest hover:text-white pt-2"
                    >
                      Close ID Badge Panel
                    </button>
                  </div>
                </div>

                {/* Card Canvas Visualizer Box */}
                <div className="flex-1 flex flex-col items-center justify-center bg-slate-950/20 rounded-[32px] p-6 border border-white/5 min-h-[500px] w-full relative">
                  {/* Decorative background grid elements */}
                  <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-5 pointer-events-none" />

                  {/* Hidden high-res canvas helper for background printing */}
                  <div className="hidden">
                    <QRCodeCanvas
                      id={`qr-canvas-student-${displayStudent.uid}`}
                      value={`${window.location.origin.includes('bitc.ac.ke') ? 'https://bitc.ac.ke' : window.location.origin}/student/verify/${displayStudent.admissionNumber || displayStudent.uid}`}
                      size={200}
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  <div className="scale-90 md:scale-100 transition-all">
                    {idCardOrientation === 'portrait' ? (
                      /* PORTRAIT PREVIEW CONTAINER */
                      <div 
                        id="id-card-preview-element-student" 
                        className="relative animate-fade-in w-[310px] h-[480px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden text-slate-800"
                      >
                        {idCardShowBack ? (
                          /* PORTRAIT BACK */
                          <div className="w-full h-full flex flex-col justify-between p-4 bg-white relative">
                            {/* Accent indicator */}
                            <div className={`absolute top-0 left-0 w-full h-2 ${
                              idCardThemeColor === 'blue' ? 'bg-blue-600' :
                              idCardThemeColor === 'emerald' ? 'bg-emerald-600' :
                              idCardThemeColor === 'rose' ? 'bg-rose-600' :
                              idCardThemeColor === 'amber' ? 'bg-amber-600' :
                              idCardThemeColor === 'slate' ? 'bg-slate-800' : 'bg-indigo-600'
                            }`} />
                            
                            <div className="text-center pt-4">
                              <span className="text-[10px] font-black text-slate-800 block uppercase tracking-wider leading-tight">
                                {settings?.schoolName || 'BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE'}
                              </span>
                              <span className="text-[7px] text-slate-400 font-extrabold uppercase block tracking-widest mt-1">
                                Identification Badge System
                              </span>
                            </div>

                            <div className="space-y-3 px-2 flex-1 justify-center flex flex-col">
                              <p className="text-[8px] font-bold uppercase text-slate-500 tracking-wider mb-2">Rules & Regulations</p>
                              <ul className="list-disc text-[7.5px] leading-relaxed text-slate-400 space-y-1.5 pl-3 font-semibold text-left">
                                <li>The badge is non-transferable and remains physical property of the institution.</li>
                                <li>Visibly display your ID card inside the class or campus gates.</li>
                                <li>Present barcode or QR ID for lecture check-in & school gate entry.</li>
                                <li>Lost cards must be reported to the Registrar Office immediately.</li>
                              </ul>
                            </div>

                            <div className="p-2 border-t border-dashed bg-slate-50 border-slate-200 text-left">
                              <div className="text-[7.5px] text-slate-500 space-y-0.5 font-bold">
                                <p><span className="text-slate-400 font-normal">Email:</span> {settings?.publicEmail || 'info@bitc.ac.ke'}</p>
                                <p><span className="text-slate-400 font-normal">Tel:</span> {settings?.publicPhone || '+254 7XX'}</p>
                                <p><span className="text-slate-400 font-normal">Addr:</span> {settings?.publicAddress || 'Thika, Kenya'}</p>
                              </div>
                            </div>

                            <div className={`-mx-4 -mb-4 px-4 py-2.5 flex items-center justify-between text-white text-[7.5px] font-extrabold uppercase mt-2 ${
                              idCardThemeColor === 'blue' ? 'bg-blue-600' :
                              idCardThemeColor === 'emerald' ? 'bg-emerald-600' :
                              idCardThemeColor === 'rose' ? 'bg-rose-600' :
                              idCardThemeColor === 'amber' ? 'bg-amber-600' :
                              idCardThemeColor === 'slate' ? 'bg-slate-800' : 'bg-indigo-600'
                            }`}>
                              <span>EXCEL & GROW ALWAYS</span>
                              <span>ID: {displayStudent.uid.slice(0, 8).toUpperCase()}</span>
                            </div>
                          </div>
                        ) : (
                          /* PORTRAIT FRONT */
                          <div className="w-full h-full flex flex-col justify-between relative bg-white">
                            {/* Card Letterhead Top */}
                            <div className={`p-4 text-white text-center flex flex-col items-center justify-center h-[76px] shrink-0 ${
                              idCardThemeColor === 'blue' ? 'bg-[#0d1b94]' :
                              idCardThemeColor === 'emerald' ? 'bg-[#004d40]' :
                              idCardThemeColor === 'rose' ? 'bg-[#880e4f]' :
                              idCardThemeColor === 'amber' ? 'bg-[#e65100]' :
                              idCardThemeColor === 'slate' ? 'bg-[#1e293b]' : 'bg-[#311b92]'
                            }`}>
                              <span className="text-[11px] font-black uppercase tracking-tight leading-none block">
                                {settings?.schoolName || 'BREAKTHROUGH INTERNATIONAL BIBLE COLLEGE'}
                              </span>
                              <span className="text-[7px] tracking-[0.15em] font-black uppercase text-yellow-400 mt-1 block">
                                OFFICIAL STUDENT ID CARD
                              </span>
                            </div>

                            {/* Main Details Body */}
                            <div className="flex-grow px-4 py-3 flex flex-col justify-center items-center gap-3">
                              
                              {/* Photo / ID Image Frame */}
                              <div className="relative">
                                <div className={`w-[95px] h-[100px] rounded-xl border-2 overflow-hidden bg-slate-50 flex items-center justify-center shrink-0 shadow-md ${
                                  idCardThemeColor === 'blue' ? 'border-[#0d1b94]/30' :
                                  idCardThemeColor === 'emerald' ? 'border-emerald-600/30' :
                                  idCardThemeColor === 'rose' ? 'border-rose-600/30' :
                                  idCardThemeColor === 'amber' ? 'border-amber-600/30' :
                                  idCardThemeColor === 'slate' ? 'border-slate-800/30' : 'border-indigo-600/30'
                                }`}>
                                  {displayStudent.photoUrl ? (
                                    <img src={displayStudent.photoUrl} className="w-full h-full object-cover animate-fade-in" referrerPolicy="no-referrer" />
                                  ) : (
                                    <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayStudent.name)}&backgroundColor=cbd5e1`} className="w-full h-full object-cover opacity-80" />
                                  )}
                                </div>
                                <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 shadow border border-white">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>

                              {/* Student parameters */}
                              <div className="w-full space-y-1.5 mt-1 text-left">
                                <div className="flex items-center text-[10.5px]">
                                  <span className="w-[85px] font-black text-slate-500 uppercase tracking-widest text-[8.5px]">Name</span>
                                  <span className="w-2 font-bold text-slate-450 mr-1">:</span>
                                  <span className="flex-1 font-black text-slate-900 truncate uppercase">{displayStudent.name}</span>
                                </div>
                                <div className="flex items-center text-[10.5px]">
                                  <span className="w-[85px] font-black text-slate-500 uppercase tracking-widest text-[8.5px]">Reg No</span>
                                  <span className="w-2 font-bold text-slate-450 mr-1">:</span>
                                  <span className="flex-1 font-bold text-slate-800 uppercase tracking-tight">{displayStudent.admissionNumber || 'PENDING'}</span>
                                </div>
                                <div className="flex items-center text-[10.5px]">
                                  <span className="w-[85px] font-black text-slate-500 uppercase tracking-widest text-[8.5px]">Course</span>
                                  <span className="w-2 font-bold text-slate-450 mr-1">:</span>
                                  <span className="flex-1 font-bold text-slate-800 truncate uppercase">
                                    {(displayStudent?.classIds?.[0] && classes.find(c => c.id === displayStudent.classIds[0])?.name) || displayStudent.course || 'NOT ASSIGNED'}
                                  </span>
                                </div>
                                <div className="flex items-center text-[10.5px]">
                                  <span className="w-[85px] font-black text-slate-500 uppercase tracking-widest text-[8.5px]">Campus</span>
                                  <span className="w-2 font-bold text-slate-450 mr-1">:</span>
                                  <span className="flex-1 font-bold text-slate-800 uppercase">{displayStudent.residence || 'THIKA MAIN CAMPUS'}</span>
                                </div>
                                <div className="flex items-center text-[10.5px]">
                                  <span className="w-[85px] font-black text-slate-500 uppercase tracking-widest text-[8.5px]">Expiry Date</span>
                                  <span className="w-2 font-bold text-slate-450 mr-1">:</span>
                                  <span className="flex-1 font-black text-rose-600 uppercase">{getValidUntil(displayStudent)}</span>
                                </div>
                              </div>
                            </div>

                            {/* QR Code Footer Block */}
                            <div className="bg-slate-50 border-t border-slate-150 p-2 flex items-center justify-between h-[78px] shrink-0">
                              <div className="flex items-center gap-2">
                                <div className="bg-white border p-1 rounded shadow-sm shrink-0">
                                  <QRCodeCanvas
                                    value={`${window.location.origin.includes('bitc.ac.ke') ? 'https://bitc.ac.ke' : window.location.origin}/student/verify/${displayStudent.admissionNumber || displayStudent.uid}`}
                                    size={256}
                                    level="H"
                                    includeMargin={false}
                                    style={{ width: '56px', height: '56px', display: 'block' }}
                                  />
                                </div>
                                <div className="text-left leading-none">
                                  <span className="text-[7px] font-black text-slate-900 block tracking-tight uppercase">SECURE HOLDER CHECK</span>
                                  <span className="text-[5.5px] font-semibold text-slate-400 block mt-0.5 whitespace-nowrap overflow-hidden max-w-[130px]">
                                    verify.bitc.ac.ke/student/{displayStudent.admissionNumber || displayStudent.uid.slice(0, 5).toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end">
                                <div className="h-5 w-16 border-b border-slate-300 opacity-60 flex items-center justify-center">
                                  <span className="font-serif italic text-[10px] text-indigo-850 select-none">Registrar</span>
                                </div>
                                <span className="text-[5px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">AUTH SIGNATURE</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* LANDSCAPE BADGE PREVIEW */
                      <div 
                        id="id-card-preview-element-student" 
                        className="relative animate-fade-in w-[480px] h-[300px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col justify-between overflow-hidden text-slate-800"
                      >
                        {idCardShowBack ? (
                          /* LANDSCAPE BACK */
                          <div className="w-full h-full flex flex-col justify-between p-4 bg-white relative">
                            <div className={`p-2 flex justify-between items-center text-white -mx-4 -mt-4 px-4 ${
                              idCardThemeColor === 'blue' ? 'bg-blue-600' :
                              idCardThemeColor === 'emerald' ? 'bg-emerald-600' :
                              idCardThemeColor === 'rose' ? 'bg-rose-600' :
                              idCardThemeColor === 'amber' ? 'bg-amber-600' :
                              idCardThemeColor === 'slate' ? 'bg-slate-800' : 'bg-indigo-600'
                            }`}>
                              <span className="text-[8px] font-black uppercase tracking-wide">
                                {settings?.schoolName || 'BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE'}
                              </span>
                              <span className="text-[7px] text-white/80 font-bold font-mono">ID: {displayStudent.uid.slice(0, 8).toUpperCase()}</span>
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
                                <p className="text-[7px] font-bold text-slate-600 truncate text-right">Email: {settings?.publicEmail || 'info@bitc.ac.ke'}</p>
                                <p className="text-[7px] font-bold text-slate-600 truncate text-right">Phone: {settings?.publicPhone || '+2547000'}</p>
                                <p className="text-[7px] font-bold text-slate-600 truncate text-right">Campus: {settings?.publicAddress || 'Thika, Kenya'}</p>
                              </div>
                            </div>

                            <div className={`text-center py-1.5 -mx-4 -mb-4 text-[7px] font-extrabold uppercase mt-2 ${
                              idCardThemeColor === 'blue' ? 'bg-blue-50 text-blue-700 border-t border-blue-100' :
                              idCardThemeColor === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-t border-emerald-100' :
                              idCardThemeColor === 'rose' ? 'bg-rose-50 text-rose-700 border-t border-rose-100' :
                              idCardThemeColor === 'amber' ? 'bg-amber-50 text-amber-700 border-t border-amber-100' :
                              idCardThemeColor === 'slate' ? 'bg-slate-100 text-slate-700 border-t border-slate-200' :
                              'bg-indigo-50 text-indigo-700 border-t border-indigo-100'
                            }`}>
                              FOUND THIS BADGE? PLEASE RETURN IT IMMEDIATELY TO THE REGISTRAR'S OFFICE
                            </div>
                          </div>
                        ) : (
                          /* LANDSCAPE FRONT */
                          <div className="w-full h-full flex flex-col bg-[#FFFDF6] text-slate-800">
                            {/* Top Header Banner */}
                            <div className={`text-white py-1.5 pr-3.5 pl-[68px] flex items-center justify-center h-[58px] relative shrink-0 ${
                              idCardThemeColor === 'blue' ? 'bg-[#0d1b94]' :
                              idCardThemeColor === 'emerald' ? 'bg-[#004d40]' :
                              idCardThemeColor === 'rose' ? 'bg-[#880e4f]' :
                              idCardThemeColor === 'amber' ? 'bg-[#e65100]' :
                              idCardThemeColor === 'slate' ? 'bg-[#1e293b]' : 'bg-[#311b92]'
                            }`}>
                              <div className="absolute left-[14px] top-1/2 -translate-y-1/2 w-[44px] h-[44px] rounded bg-white flex items-center justify-center p-0.5 shrink-0 shadow-sm">
                                {settings?.logoUrl ? (
                                  <img src={settings.logoUrl} className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                                ) : (
                                  <svg className="w-full h-full" viewBox="0 0 100 100">
                                    <polygon points="50,5 90,25 90,75 50,95 10,75 10,25" fill="#facc15" stroke="#ffffff" strokeWidth="3"/>
                                    <polygon points="50,12 82,28 82,72 50,88 18,72 18,28" fill="#0d1b94"/>
                                    <path d="M50,22 L65,37 M50,22 L35,37 M50,22 L50,78" stroke="#facc15" strokeWidth="4" strokeLinecap="round"/>
                                    <circle cx="50" cy="50" r="12" fill="#ef4444" stroke="#ffffff" strokeWidth="2"/>
                                  </svg>
                                )}
                              </div>
                              <div className="text-center w-full flex flex-col justify-center items-center">
                                <h4 className="text-[13.5px] font-black uppercase leading-tight text-white tracking-tight whitespace-nowrap">
                                  {settings?.schoolName || 'BREAKTHROUGH INTERNATIONAL BIBLE COLLEGE'}
                                </h4>
                                <h5 className="text-[8px] font-black uppercase leading-none text-yellow-400 tracking-wide mt-1 whitespace-nowrap">OFFICIAL STUDENT BADGE</h5>
                              </div>
                            </div>

                            {/* Main Body */}
                            <div className="flex-grow flex p-3 justify-between items-center overflow-hidden">
                              {/* Left Column: Photo & Big QR Code */}
                              <div className="w-[105px] flex flex-col items-center justify-between h-full shrink-0">
                                <div className="w-[90px] h-[95px] rounded-lg border border-indigo-150 overflow-hidden bg-slate-50 flex items-center justify-center shrink-0 shadow-sm">
                                  {displayStudent.photoUrl ? (
                                    <img src={displayStudent.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayStudent.name)}&backgroundColor=cbd5e1`} className="w-full h-full object-cover" />
                                  )}
                                </div>
                                <div className="w-[84px] h-[84px] bg-white border border-gray-200 rounded p-1 flex items-center justify-center shadow-sm -mt-1 shrink-0">
                                  <QRCodeCanvas
                                    value={`${window.location.origin.includes('bitc.ac.ke') ? 'https://bitc.ac.ke' : window.location.origin}/student/verify/${displayStudent.admissionNumber || displayStudent.uid}`}
                                    size={256}
                                    level="H"
                                    includeMargin={false}
                                    style={{ width: '74px', height: '74px', display: 'block' }}
                                  />
                                </div>
                              </div>

                              {/* Right Column: Category pill & details info */}
                              <div className="flex-1 pl-4 flex flex-col justify-start relative select-text h-full">
                                {/* Category pill tag */}
                                <div className="flex justify-end -mr-3 mb-2 shrink-0">
                                  <div className="bg-[#ee1c24] text-white text-[12px] font-black uppercase px-6 py-1 tracking-widest rounded-l-full shadow-sm text-right min-w-[200px]">
                                    Student ID Card
                                  </div>
                                </div>

                                {/* Information Records */}
                                <div className="flex-grow flex flex-col justify-center space-y-1 pl-1 text-slate-800 text-left">
                                  <div className="flex items-baseline text-[11px]">
                                    <span className="w-[88px] font-black text-[#0b1654] uppercase tracking-wide text-[9.5px]">Name</span>
                                    <span className="w-3 font-bold text-[#0b1654] mr-1 text-center">:</span>
                                    <span className="flex-1 font-black text-[#000c40] uppercase truncate text-[12px]">{displayStudent.name}</span>
                                  </div>
                                  <div className="flex items-baseline text-[11px]">
                                    <span className="w-[88px] font-black text-[#0b1654] uppercase tracking-wide text-[9.5px]">Reg No</span>
                                    <span className="w-3 font-bold text-[#0b1654] mr-1 text-center">:</span>
                                    <span className="flex-1 font-bold text-[#000c40] uppercase text-[12px]">{displayStudent.admissionNumber || 'PENDING'}</span>
                                  </div>
                                  <div className="flex items-baseline text-[11px]">
                                    <span className="w-[88px] font-black text-[#0b1654] uppercase tracking-wide text-[9.5px]">Course</span>
                                    <span className="w-3 font-bold text-[#0b1654] mr-1 text-center">:</span>
                                    <span className="flex-1 font-bold text-[#000c40] uppercase truncate text-[12px]">
                                      {(displayStudent?.classIds?.[0] && classes.find(c => c.id === displayStudent.classIds[0])?.name) || displayStudent.course || 'NOT ASSIGNED'}
                                    </span>
                                  </div>
                                  <div className="flex items-baseline text-[11px]">
                                    <span className="w-[88px] font-black text-[#0b1654] uppercase tracking-wide text-[9.5px]">Campus</span>
                                    <span className="w-3 font-bold text-[#0b1654] mr-1 text-center">:</span>
                                    <span className="flex-1 font-bold text-[#000c40] uppercase text-[12px]">{displayStudent.residence || 'THIKA MAIN CAMPUS'}</span>
                                  </div>
                                  <div className="flex items-baseline text-[11px]">
                                    <span className="w-[88px] font-black text-[#0b1654] uppercase tracking-wide text-[9.5px]">Expiry Date</span>
                                    <span className="w-3 font-bold text-[#0b1654] mr-1 text-center">:</span>
                                    <span className="flex-1 font-black text-[#ee1c24] uppercase text-[12px]">{getValidUntil(displayStudent)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderTeacherPortal = () => {
    const now = new Date();
    const dateStr = format(now, 'EEE, MMM d');
    
    return (
      <div className="space-y-8 pb-20 -mt-4">
        {/* Top Header - Teacher Specific */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                <Sparkles size={32} />
              </div>
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-[0.3em] mb-1">Faculty Portal</p>
                <h1 className="text-4xl font-bold text-text-primary tracking-tight">Main Dashboard</h1>
              </div>
            </div>
            <p className="text-lg font-medium text-text-secondary max-w-2xl">
              Good {format(now, 'a') === 'AM' ? 'Morning' : 'Afternoon'}, Lecturer {userData?.name?.split(' ')[0]}. You have <span className="text-primary font-bold">{todayLessons.length} units</span> to facilitate today.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-bg-card/40 backdrop-blur-md px-6 py-4 rounded-[24px] border border-white/5 flex flex-col items-end">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{dateStr}</span>
              <span className="text-sm font-bold text-text-primary tracking-tight">{format(now, 'HH:mm')} System Time</span>
            </div>
          </div>
        </div>

        {/* Faculty Portal Quick Navigation */}
        <div className="bg-bg-card p-6 rounded-[32px] border border-white/5 shadow-xl">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Faculty Academic Tools Quick Access
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link 
              to="/attendance" 
              className="p-5 rounded-2xl bg-white/5 hover:bg-primary/10 border border-white/5 hover:border-primary/20 transition-all flex flex-col items-start justify-between group active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ClipboardCheck size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">Attendance</h4>
                <p className="text-[10px] text-text-muted mt-0.5">Mark & view class logs</p>
              </div>
            </Link>

            <Link 
              to="/timetable" 
              className="p-5 rounded-2xl bg-white/5 hover:bg-primary/10 border border-white/5 hover:border-primary/20 transition-all flex flex-col items-start justify-between group active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Calendar size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">Timetable</h4>
                <p className="text-[10px] text-text-muted mt-0.5">Teaching schedule</p>
              </div>
            </Link>

            <Link 
              to="/my-units" 
              className="p-5 rounded-2xl bg-white/5 hover:bg-primary/10 border border-white/5 hover:border-primary/20 transition-all flex flex-col items-start justify-between group active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <BookOpen size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">Units</h4>
                <p className="text-[10px] text-text-muted mt-0.5">My assigned units</p>
              </div>
            </Link>

            <Link 
              to="/classes" 
              className="p-5 rounded-2xl bg-white/5 hover:bg-primary/10 border border-white/5 hover:border-primary/20 transition-all flex flex-col items-start justify-between group active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Users size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">Classes</h4>
                <p className="text-[10px] text-text-muted mt-0.5">Manage class rosters</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Highlights Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-8 rounded-[32px] border border-[#E2E8F0] shadow-sm text-[#0F172A] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700 text-blue-600">
              <BookOpen size={100} />
            </div>
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#64748B] mb-2">My Units</p>
                <h3 className="text-4xl font-bold text-[#0F172A]">{stats.units}</h3>
              </div>
              <Link to="/my-units" className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors">
                View All <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="bg-bg-card p-8 rounded-[40px] border border-white/5 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 text-emerald-500/10 group-hover:scale-110 transition-transform duration-700">
              <ClipboardCheck size={100} />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted mb-2">Teaching Students</p>
            <h3 className="text-4xl font-bold text-text-primary">{stats.students}</h3>
            <p className="text-xs font-bold text-success/80 mt-2 uppercase tracking-wide">Across all categories</p>
          </div>

          <div className="bg-bg-card p-8 rounded-[40px] border border-white/5 shadow-xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-6 text-primary/10 group-hover:scale-110 transition-transform duration-700">
              <FileText size={100} />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted mb-2">Active Assessments</p>
            <h3 className="text-4xl font-bold text-text-primary">{stats.exams}</h3>
            <Link to="/exams" className="mt-4 inline-block text-xs font-bold text-primary uppercase tracking-widest hover:underline">
              Create New
            </Link>
          </div>

          {nextLesson ? (
            <div className="bg-primary p-8 rounded-[40px] shadow-2xl shadow-primary/30 text-white relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-6 text-white/10 group-hover:scale-110 transition-transform duration-700">
                <Clock size={100} />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60 mb-2">Next up @ {nextLesson.startTime}</p>
              <h3 className="text-xl font-bold truncate">{nextLesson.unitName}</h3>
              <div className="flex items-center gap-2 mt-2">
                <MapPin size={14} className="text-white/60" />
                <span className="text-xs font-bold uppercase tracking-widest">{nextLesson.room || 'TBA'}</span>
              </div>
            </div>
          ) : (
             <div className="bg-white/5 p-8 rounded-[40px] border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
               <Clock size={32} className="text-text-muted/20 mb-2" />
               <p className="text-xs font-bold text-text-muted/40 uppercase tracking-widest">No more lessons</p>
             </div>
          )}
        </div>

        {/* Schedule & Announcements Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between px-2">
               <h2 className="text-primary font-bold uppercase tracking-[0.25em] text-sm flex items-center gap-3">
                 <span className="w-1.5 h-6 bg-primary rounded-full" />
                 Today's Facilitation Schedule
               </h2>
               <Link to="/timetable" className="text-xs font-bold text-primary uppercase tracking-widest hover:underline px-4 py-2 bg-primary/5 rounded-xl border border-primary/10">
                 Full Calendar
               </Link>
            </div>

            <div className="space-y-5">
              {todayLessons.length > 0 ? (
                todayLessons.map((lesson, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      key={`${lesson.id}_${idx}`}
                      className="bg-bg-card p-8 rounded-[40px] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-primary/20 transition-all group shadow-xl hover:shadow-primary/5"
                    >
                    <div className="flex items-center gap-8">
                      <div className="text-center min-w-[90px] border-r border-white/5 pr-8">
                        <p className="text-2xl font-bold text-text-primary">{lesson.startTime}</p>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mt-1">Start Time</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                           <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lesson.color || '#3b82f6' }} />
                           <h4 className="text-xl font-bold text-text-primary tracking-tight leading-none group-hover:text-primary transition-colors">{lesson.unitName}</h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                           <div className="flex items-center gap-2 text-text-muted">
                             <Users size={14} className="text-emerald-500" />
                             <span className="text-[10px] font-bold uppercase tracking-widest">Target Class: {classes.find(c => c.id === lesson.classId)?.name || 'Unknown'}</span>
                           </div>
                           <div className="flex items-center gap-2 text-text-muted">
                             <MapPin size={14} className="text-amber-500" />
                             <span className="text-[10px] font-bold uppercase tracking-widest">Venue: {lesson.room || 'TBA'}</span>
                           </div>
                           <div className="flex items-center gap-2 text-text-muted">
                             <Clock size={14} className="text-primary" />
                             <span className="text-[10px] font-bold uppercase tracking-widest">Duration: {lesson.startTime} — {lesson.endTime}</span>
                           </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <Link 
                        to={`/timetable`}
                        className="w-full sm:w-auto bg-white/5 hover:bg-primary transition-all text-text-primary hover:text-white px-8 py-3.5 rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2 group/btn active:scale-95"
                      >
                        Class Info <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="bg-bg-card p-20 rounded-[40px] border-2 border-dashed border-white/5 text-center group">
                   <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center mx-auto mb-6 opacity-40 group-hover:scale-110 transition-transform">
                      <Calendar size={40} className="text-text-muted" />
                   </div>
                   <h3 className="text-xl font-bold text-text-primary mb-2">No Facilitation Today</h3>
                   <p className="text-sm font-medium text-text-muted uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                     Your teaching schedule is clear for today. Use this time for curriculum development.
                   </p>
                </div>
              )}
            </div>

             {/* Recent Assessment Activity */}
             <div className="pt-6 space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-primary font-bold uppercase tracking-[0.25em] text-sm flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                    Pending Gradings
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   {recentExams.filter(e => e.teacherId === user.uid).map((exam, idx) => (
                    <div key={`${exam.id}_pending_gradings_${idx}`} className="bg-bg-card/40 p-6 rounded-[32px] border border-white/5 flex flex-col justify-between hover:bg-bg-card transition-colors shadow-lg">
                       <div>
                         <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                               <Award size={20} />
                            </div>
                            <h4 className="text-sm font-bold text-text-primary tracking-tight leading-tight line-clamp-1 uppercase">{exam.title}</h4>
                         </div>
                         <div className="flex items-center justify-between mb-4">
                           <div className="text-center bg-white/5 px-4 py-2 rounded-xl">
                              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest leading-none mb-1">Submissions</p>
                              <p className="text-lg font-bold text-text-primary">--</p>
                           </div>
                           <div className="text-center bg-white/5 px-4 py-2 rounded-xl">
                              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest leading-none mb-1">Graded</p>
                              <p className="text-lg font-bold text-text-primary">--</p>
                           </div>
                         </div>
                       </div>
                       <Link to="/marks-register" className="w-full py-3 bg-indigo-500/10 hover:bg-indigo-500 transition-all text-indigo-500 hover:text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest text-center shadow-lg active:scale-95">
                         Open Register
                       </Link>
                    </div>
                   ))}
                   {recentExams.filter(e => e.teacherId === user.uid).length === 0 && (
                     <div className="col-span-1 md:col-span-2 py-6 bg-white/5 rounded-3xl text-center">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest italic">No pending assessment data</p>
                     </div>
                   )}
                </div>
             </div>
          </div>

          <div className="space-y-8">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
               <div className="bg-white/5 w-14 h-14 rounded-2xl flex items-center justify-center mb-10 border border-white/10">
                  <Megaphone size={28} className="text-primary" />
               </div>
               <h3 className="text-2xl font-bold text-text-primary mb-3 tracking-tight">Announcements</h3>
               <p className="text-text-muted font-medium text-sm mb-10 leading-relaxed">
                 Broadcast direct academic notices to your units or general student body.
               </p>
               <button 
                onClick={() => setIsAnnouncing(true)}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary-hover transition-all active:scale-95"
               >
                 <Plus size={18} /> New Broadcast
               </button>
            </div>

            <div className="bg-bg-card p-8 rounded-[40px] border border-white/5 shadow-xl">
               <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                      <MessageSquare size={20} />
                   </div>
                   <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Class Group Chats</h3>
                 </div>
                 <Link to="/whatsapp" className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">
                   Open Chat
                 </Link>
               </div>
               <div className="space-y-3">
                 {chatRooms.filter(r => r.type === 'group').length > 0 ? (
                   chatRooms.filter(r => r.type === 'group').slice(0, 5).map((room, idx) => (
                     <Link 
                       key={`${room.id || 'room'}_${idx}`} 
                       to="/whatsapp" 
                       state={{ openClassId: room.classId }}
                       className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors group"
                     >
                        <div className="w-10 h-10 rounded-xl bg-[#D9FDD3] flex items-center justify-center text-[#06CF9C] shrink-0">
                          <Users size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="text-xs font-bold text-text-primary truncate uppercase">{room.name}</h4>
                            <span className="text-[9px] text-text-muted font-bold">
                              {room.lastMessageAt ? format(new Date(room.lastMessageAt), 'p') : ''}
                            </span>
                          </div>
                          <p className="text-[10px] text-text-muted mt-1 truncate italic">
                            {room.lastMessage || 'No messages yet'}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-text-muted group-hover:translate-x-1 transition-transform" />
                     </Link>
                   ))
                 ) : (
                   <div className="text-center py-6 border-2 border-dashed border-white/5 rounded-3xl">
                     <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest italic opacity-40">No active group chats</p>
                   </div>
                 )}
               </div>
            </div>

            <div className="bg-bg-card p-8 rounded-[40px] border border-white/5 shadow-xl">
               <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                      <Bell size={20} />
                   </div>
                   <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Notice Board</h3>
                 </div>
                 {notifications.filter(n => !n.read).length > 0 && (
                   <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                     {notifications.filter(n => !n.read).length} NEW
                   </span>
                 )}
               </div>
               <div className="space-y-4">
                  {/* Show combination of received notifications and sent announcements */}
                  <div className="space-y-1 mb-4">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-1">Received Notices</p>
                    {notifications.length > 0 ? (
                      notifications.slice(0, 3).map((notif, idx) => (
                        <div 
                          key={`${notif.id}_unread_${idx}`} 
                          onClick={() => setViewingNotif(notif)}
                          className={`flex gap-4 p-4 rounded-2xl transition-colors cursor-pointer group ${!notif.read ? 'bg-primary/5 hover:bg-primary/10' : 'bg-white/5 hover:bg-white/10'}`}
                        >
                           <div className={`flex-shrink-0 w-1.5 h-10 rounded-full transition-all ${notif.type === 'grade' ? 'bg-amber-500' : notif.type === 'fee' ? 'bg-indigo-500' : 'bg-primary'}`} />
                           <div className="min-w-0 flex-1">
                             <div className="flex justify-between items-start gap-2">
                               <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{format(new Date(notif.createdAt), 'MMM dd')}</p>
                               {!notif.read && <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />}
                             </div>
                             <h4 className={`text-xs font-bold leading-tight uppercase break-words ${!notif.read ? 'text-primary' : 'text-text-primary'}`}>{notif.title}</h4>
                             <p className="text-[10px] text-text-muted mt-1 line-clamp-1 break-words">{notif.message}</p>
                           </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-4 text-[10px] font-bold text-text-muted/40 uppercase italic tracking-widest">No incoming notices</p>
                    )}
                  </div>

                  <div className="space-y-1 border-t border-white/5 pt-4">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-1">Recent System Broadcasts</p>
                    {sentAnnouncements.slice(0, 5).map((notif, idx) => (
                      <div 
                        key={`${notif.id}_announcement_${idx}`} 
                        onClick={() => setViewingNotif(notif)}
                        className="flex gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                      >
                         <div className="flex-shrink-0 w-1.5 h-10 rounded-full bg-emerald-500/40 group-hover:h-full transition-all" />
                         <div className="min-w-0 flex-1">
                           <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{format(new Date(notif.createdAt), 'MMM dd')} • By {(notif as any).senderName || 'Staff'}</p>
                           <h4 className="text-xs font-bold text-text-primary leading-tight uppercase break-words">{notif.title}</h4>
                           <p className="text-[10px] text-text-muted mt-1 line-clamp-1">{notif.message}</p>
                         </div>
                      </div>
                    ))}
                    {sentAnnouncements.length === 0 && (
                      <p className="text-center py-4 text-xs font-bold text-text-muted/40 uppercase italic tracking-widest">No sent messages</p>
                    )}
                  </div>
               </div>
            </div>

            <div className="bg-bg-card p-8 rounded-[40px] border border-white/5 shadow-xl">
               <h3 className="font-bold text-text-primary uppercase tracking-widest text-xs mb-6 flex items-center gap-3">
                 <ClipboardCheck size={18} className="text-success" /> Attendance Summary
               </h3>
               <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-2xl flex items-center justify-between">
                     <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Today's Class Average</span>
                     <span className="text-sm font-bold text-success">--%</span>
                  </div>
                  <Link to="/attendance" className="w-full py-4 text-primary font-bold text-[10px] uppercase tracking-widest text-center block hover:bg-primary/5 rounded-2xl transition-all">
                    Register Attendance
                  </Link>
               </div>
            </div>

            <ShareAppCard />
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    if (userData?.role === 'student' || userData?.role === 'parent') return renderStudentPortal();
    if (isTeacher) return renderTeacherPortal();
    
    return (
      <div className="space-y-10 relative">
        {/* Decorative Background Accents */}
        <div id="acc-bg-top-right" className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-blue-400/5 rounded-full blur-[100px] pointer-events-none" />
        <div id="acc-bg-bottom-left" className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-400/5 rounded-full blur-[100px] pointer-events-none" />
        <div id="acc-bg-mid" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-400/[0.02] rounded-full blur-[120px] pointer-events-none" />

        <motion.div 
          id="dashboard-welcome-banner"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-white border border-[#E2E8F0] p-8 sm:p-10 rounded-[32px] text-[#0F172A] shadow-sm"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div>
              <h1 id="welcome-title" className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-[#0F172A]">
                Hello, {userData?.name?.split(' ')[0]}! 👋
              </h1>
              <p id="welcome-subtitle" className="text-[#64748B] text-sm sm:text-base font-medium max-w-lg leading-relaxed">
                Welcome back to {settings?.appTitle || 'BITC'}. Everything is looking session-ready.
              </p>
            </div>
          </div>
        </motion.div>

      <div id="dashboard-quick-stats" className="bg-white p-6 sm:p-8 rounded-[32px] border border-[#E2E8F0] shadow-sm scroll-mt-20">
        <h2 className="text-[#0F172A] font-heading font-bold mb-6 uppercase tracking-widest text-[10px] flex items-center gap-2">
          <span>Overview Summary</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {scanCards.map((stat, idx) => (
            <Link
              to={stat.to}
              key={`${stat.name}_${idx}`}
              className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[140px] group cursor-pointer hover:-translate-y-1"
            >
              {/* Colored Indicator Line */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${stat.indicatorColor}`} />
              
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">{stat.name}</span>
                  <span className="text-lg">{stat.emoji}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold font-mono text-[#0F172A] tracking-tight">
                  {stat.value}
                </h3>
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50 pl-2">
                <p className="text-xs font-medium text-[#64748B]">{stat.label}</p>
                <stat.icon size={16} className="text-[#64748B] group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {hasPermission('view_finance') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Monthly Chart */}
          <div className="bg-bg-card p-8 rounded-[32px] border border-white/5 shadow-2xl flex flex-col h-[500px]">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h2 className="text-primary font-bold">Income and Expenses for {format(new Date(), 'MMM yyyy')}</h2>
              <div className="flex items-center gap-2">
                <div className="bg-white/5 border border-white/10 p-2 rounded-xl text-text-muted hover:bg-white/10 transition-colors cursor-pointer"><ChevronDown size={20} /></div>
                <Link to="/fees" className="bg-primary p-2 rounded-xl text-white hover:bg-primary-hover transition-colors cursor-pointer"><Plus size={20} /></Link>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
              <div className="space-y-1">
                <p className="text-primary font-bold text-sm">Ksh {totalFinancialStats.income.toLocaleString()}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-tight">{new Date().getFullYear()} Income</p>
              </div>
              <div className="space-y-1">
                <p className="text-primary font-bold text-sm">Ksh {totalFinancialStats.billings.toLocaleString()}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-tight">{new Date().getFullYear()} Billable</p>
              </div>
              <div className="space-y-1">
                <p className="text-primary font-bold text-sm">Ksh {totalFinancialStats.expenses.toLocaleString()}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-tight">{new Date().getFullYear()} Expense</p>
              </div>
              <div className="space-y-1">
                <p className="text-primary font-bold text-sm">Ksh {totalFinancialStats.profit.toLocaleString()}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-tight">{new Date().getFullYear()} Profit</p>
              </div>
              <div className="sm:text-right">
                <p className="text-success font-bold text-sm">Ksh {totalFinancialStats.outstanding.toLocaleString()}</p>
                <p className="text-xs font-bold text-text-muted uppercase tracking-tight">Total Outstanding</p>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <div className="h-full relative overflow-hidden flex items-end justify-around px-10 pb-4">
                {realFinancialData.map((data, i) => {
                  const maxVal = Math.max(...realFinancialData.map(d => Math.max(d.income, d.expense, d.billings)), 1);
                  const incomeH = (data.income / maxVal) * 80;
                  const billingH = (data.billings / maxVal) * 80;
                  const expenseH = (data.expense / maxVal) * 80;
                  return (
                    <div key={`${data.month}_${i}`} className="flex gap-1 items-end h-full w-6 relative">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${billingH}%` }}
                        className="w-1.5 bg-blue-400 opacity-60 rounded-full" 
                        title={`Billable: ${data.billings}`}
                      />
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${incomeH}%` }}
                        className="w-1.5 bg-[#8e54e9] rounded-full" 
                        title={`Collected: ${data.income}`}
                      />
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${expenseH}%` }}
                        className="w-1.5 bg-red-400 rounded-full" 
                        title={`Expense: ${data.expense}`}
                      />
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-400">{data.month}</span>
                    </div>
                  );
                })}
                <div className="absolute inset-0 flex flex-col justify-between py-10 pointer-events-none">
                  <div className="w-full h-px bg-gray-50" />
                  <div className="w-full h-px bg-gray-50" />
                  <div className="w-full h-px bg-gray-50" />
                  <div className="w-full h-px bg-gray-50" />
                </div>
                
                <div className="absolute right-10 top-1/2 -translate-y-1/2 bg-white border border-purple-200 shadow-xl rounded-xl p-4 z-10 pointer-events-none text-bg-main">
                  <p className="text-xl font-bold text-purple-600 text-center">{realFinancialData.length}</p>
                  <div className="space-y-1 mt-2">
                      <p className="text-xs flex justify-between gap-4 text-gray-400 font-bold uppercase">Income: <span className="text-gray-900">{totalFinancialStats.income}</span></p>
                      <p className="text-xs flex justify-between gap-4 text-gray-400 font-bold uppercase">Expense: <span className="text-gray-900">{totalFinancialStats.expenses}</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Yearly Chart */}
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col h-[500px]">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h2 className="text-blue-600 font-bold">Financial Summary {new Date().getFullYear()}</h2>
              <div className="flex items-center gap-2">
                <div className="bg-gray-50 border border-gray-100 p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"><ChevronDown size={20} /></div>
                <div className="bg-indigo-600 p-2 rounded-xl text-white hover:bg-indigo-700 transition-colors cursor-pointer"><XCircle size={20} /></div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
              <div className="space-y-1">
                <p className="text-blue-600 font-bold text-sm">Ksh {totalFinancialStats.income.toLocaleString()}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Yearly Collected</p>
              </div>
              <div className="space-y-1">
                <p className="text-blue-600 font-bold text-sm">Ksh {totalFinancialStats.billings.toLocaleString()}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Yearly Billable</p>
              </div>
              <div className="space-y-1">
                <p className="text-blue-600 font-bold text-sm">Ksh {totalFinancialStats.expenses.toLocaleString()}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Yearly Expense</p>
              </div>
              <div className="space-y-1">
                <p className="text-blue-600 font-bold text-sm">Ksh {totalFinancialStats.profit.toLocaleString()}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Yearly Profit</p>
              </div>
              <div className="sm:text-right">
                <p className="text-blue-600 font-bold text-sm">Ksh {totalFinancialStats.lifetimeIncome.toLocaleString()}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Lifetime Income</p>
              </div>
            </div>

            <div className="flex-1 min-h-0 relative px-4 text-center flex items-center justify-center border-t border-gray-50">
               <div className="space-y-4">
                  <div className="flex items-center gap-4 justify-center">
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 bg-blue-400 opacity-60 rounded-full" />
                       <span className="text-xs text-gray-500 font-bold uppercase">Billable</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 bg-purple-600 rounded-full" />
                       <span className="text-xs text-gray-500 font-bold uppercase">Collected</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 bg-red-400 rounded-full" />
                       <span className="text-xs text-gray-500 font-bold uppercase">Expenses</span>
                    </div>
                  </div>
                 <p className="text-gray-400 text-sm">Dashboard is now synchronized with current financial records.</p>
               </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-bg-card p-6 sm:p-8 rounded-[32px] border border-white/5 shadow-xl flex items-center justify-between">
        <h2 className="text-primary font-bold uppercase tracking-widest text-sm flex items-center gap-3">
          <Megaphone className="rotate-[-10deg] animate-bounce text-primary" size={24} /> Notice Board
        </h2>
        {(userData?.role === 'admin' || userData?.role === 'teacher' || userData?.role === 'staff') && (
          <button 
            onClick={() => setIsAnnouncing(true)}
            className="bg-primary hover:bg-primary-hover transition-colors text-white px-6 sm:px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus size={18} /> Add
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-primary font-bold uppercase tracking-widest text-xs">Recent Messages</h2>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg shadow-rose-500/20">
                {notifications.filter(n => !n.read).length} NEW
              </span>
            )}
          </div>
          
          <div className="space-y-4">
            {notifications.length > 0 ? (
              notifications.slice(0, 5).map((notif, idx) => (
                <motion.div
                  key={`${notif.id}_${idx}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ y: -2 }}
                  className={`p-6 rounded-[28px] border transition-all relative overflow-hidden group shadow-sm ${
                    !notif.read 
                    ? 'bg-white border-blue-200 ring-2 ring-blue-500/10' 
                    : 'bg-white border-slate-200'
                  }`}
                >
                  {!notif.read && (
                    <div className="absolute top-0 right-0 p-4">
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          await updateDoc(doc(db, 'notifications', notif.id), { read: true });
                        }}
                        className="text-xs font-bold text-blue-600 uppercase tracking-widest hover:underline"
                      >
                        Mark as Read
                      </button>
                    </div>
                  )}
                  <div className="flex items-start gap-5">
                    <div className={`p-4 rounded-[20px] shrink-0 shadow-sm ${
                      notif.type === 'fee' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      notif.type === 'exam' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      notif.type === 'grade' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                      'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {notif.type === 'fee' ? <Wallet size={20} /> :
                       notif.type === 'exam' ? <FileText size={20} /> :
                       notif.type === 'grade' ? <GraduationCap size={20} /> :
                       <Bell size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                        <h4 className="font-bold text-base tracking-tight break-words text-slate-900">{notif.title}</h4>
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg uppercase tracking-wide whitespace-nowrap">
                          {format(new Date(notif.createdAt), 'MMM dd, HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed mb-4 break-words font-medium text-slate-700">{notif.message}</p>
                      
                      <div className="flex flex-wrap gap-3">
                        {notif.attachmentUrl && (
                          <a
                            href={notif.attachmentUrl.startsWith('http') ? `/api/download?url=${encodeURIComponent(notif.attachmentUrl)}&filename=${encodeURIComponent(notif.attachmentName || 'attachment')}` : notif.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-xl transition-all group/btn"
                          >
                            {notif.attachmentType === 'image' ? <ImageIcon size={16} className="text-blue-600" /> : <FileIcon size={16} className="text-rose-500" />}
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                              {notif.attachmentName || 'View Attachment'}
                            </span>
                            <Download size={14} className="text-slate-500 group-hover/btn:translate-y-1 transition-transform" />
                          </a>
                        )}
                        {notif.link && (
                          <Link
                            to={notif.link}
                            onClick={async () => {
                              if (!notif.read) await updateDoc(doc(db, 'notifications', notif.id), { read: true });
                            }}
                            className="inline-flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline"
                          >
                            View Details <ArrowRight size={14} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-white p-12 rounded-[32px] border border-slate-200 text-center space-y-4 shadow-sm">
                <div className="bg-slate-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                  <Bell size={28} />
                </div>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Inbox is clear</p>
              </div>
            )}
          </div>

          {/* Global Archive for Admins */}
          {sentAnnouncements.length > 0 && (
            <div className="mt-12 space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-slate-900 font-bold uppercase tracking-[0.2em] text-xs flex items-center gap-2">
                  <Megaphone size={14} className="text-blue-600" /> System Broadcast Archive
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sentAnnouncements.slice(0, 6).map((notif, idx) => (
                  <motion.div
                    key={`${notif.id}_archive_${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-5 rounded-[24px] bg-white border border-slate-200 shadow-sm hover:border-blue-300 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
                        {format(new Date(notif.createdAt), 'MMM dd, yyyy')}
                      </span>
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest italic">
                        Sent by {(notif as any).senderName || 'Staff'}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 tracking-tight mb-2 group-hover:text-blue-600 transition-colors">{notif.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{notif.message}</p>
                    {notif.attachmentUrl && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                        <Paperclip size={12} /> Has Attachment
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <h2 className="text-primary font-bold uppercase tracking-[0.2em] text-xs px-2 mt-12">Quick Links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
             {recentExams.map((exam, idx) => (
              <div key={`${exam.id}_recent_${idx}`} className="bg-bg-card p-6 rounded-[32px] border border-white/5 flex items-center justify-between hover:shadow-2xl hover:shadow-primary/10 transition-all group cursor-pointer hover:-translate-y-1 active:scale-95">
                <div className="flex items-center gap-5">
                  <div className="bg-primary/10 p-4 rounded-2xl text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-all duration-500">
                    <FileText size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-text-primary leading-tight mb-1 text-sm tracking-tight">{exam.title}</h4>
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">{format(new Date(exam.createdAt), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <ArrowRight size={16} className="text-text-muted group-hover:text-primary transition-colors" />
                </div>
              </div>
            ))}
            {recentExams.length === 0 && (
               <div className="sm:col-span-2 bg-bg-card/50 border border-white/5 rounded-[32px] p-12 text-center text-text-muted font-bold text-xs uppercase tracking-[0.2em]">
                  No Activity Records
               </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-gradient-to-br from-cyan-500 to-primary rounded-[40px] p-10 text-white shadow-2xl shadow-cyan-500/10 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
              <div className="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-10 backdrop-blur-md">
                <Users size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-3 tracking-tight relative z-10">Directory</h3>
              <p className="text-blue-50 font-medium text-sm mb-10 leading-relaxed opacity-90 relative z-10">
                Manage all student registrations and profiles across all departments.
              </p>
              <Link to="/students" className="block w-full bg-white text-primary font-bold py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl text-center hover:bg-blue-50 transition-all hover:scale-[1.02] active:scale-95">
                Manage List
              </Link>
           </div>

           <div className="bg-gradient-to-br from-purple-600 to-highlight rounded-[40px] p-10 text-white shadow-2xl shadow-purple-600/10 relative overflow-hidden group">
              <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
              <div className="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-10 backdrop-blur-md">
                <Award size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-3 tracking-tight relative z-10">Performance</h3>
              <p className="text-indigo-50 font-medium text-sm mb-10 leading-relaxed opacity-90 relative z-10">
                Review detailed academic metrics and grade distribution analytics.
              </p>
              <Link to="/results" className="block w-full bg-white text-highlight font-bold py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl text-center hover:bg-indigo-50 transition-all hover:scale-[1.02] active:scale-95">
                Analytics Hub
              </Link>
           </div>
        </div>
      </div>
          {/* Calendar Section */}
          <div className="bg-bg-card/40 rounded-3xl p-6 border border-white/5 shadow-xl col-span-1 lg:col-span-2 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-bold text-text-primary tracking-tight">School Calendar</h3>
                <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-0.5">Academic Events & Deadlines</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-white/5 p-1 rounded-full border border-white/10 shadow-sm">
                  <button 
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} 
                    className="p-1.5 hover:bg-white/10 hover:shadow-sm rounded-full text-text-muted hover:text-primary transition-all"
                  >
                    <ArrowRight className="rotate-180" size={12} />
                  </button>
                  <span className="text-xs font-bold uppercase tracking-widest min-w-[110px] text-center text-text-secondary">
                    {format(currentMonth, 'MMMM yyyy')}
                  </span>
                  <button 
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} 
                    className="p-1.5 hover:bg-white/10 hover:shadow-sm rounded-full text-text-muted hover:text-primary transition-all"
                  >
                    <ArrowRight size={12} />
                  </button>
                </div>
                <button 
                  onClick={() => setCurrentMonth(new Date())}
                  className="bg-primary text-white text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
                >
                  Current
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
                <div key={`${d}-${i}`} className="text-xs font-bold text-text-muted text-center pb-2 uppercase tracking-[0.1em]">{d}</div>
              ))}
              {calendarDays.map((day, i) => {
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isWeekendDay = isWeekend(day);
                const hasExam = exams.some(e => {
                  const d = e.examDate || e.dueDate;
                  return d && isSameDay(new Date(d), day);
                });

                return (
                  <div 
                    key={`${day.getTime()}_${i}`} 
                    className={`
                    relative group aspect-[1/1] sm:aspect-[4/3] flex flex-col items-center justify-center rounded-lg transition-all duration-300
                      ${!isCurrentMonth ? 'opacity-10 grayscale' : ''}
                      ${isToday ? 'bg-primary shadow-xl shadow-primary/20 z-10' : 'hover:bg-white/5'}
                      ${hasExam && !isToday ? 'bg-amber-500/10 border border-amber-500/30' : ''}
                      ${isWeekendDay && isCurrentMonth && !isToday && !hasExam ? 'bg-white/5' : ''}
                    `}
                  >
                    <span className={`
                      text-sm font-bold transition-colors
                      ${isToday ? 'text-white' : !isCurrentMonth ? 'text-text-muted/40' : isWeekendDay ? 'text-text-muted/60' : 'text-text-secondary'}
                      ${hasExam && !isToday ? 'text-amber-500 font-extrabold' : ''}
                    `}>
                      {format(day, 'd')}
                    </span>
                    
                    {hasExam && (
                      <div className={`
                        absolute bottom-1 w-1.5 h-1.5 rounded-full
                        ${isToday ? 'bg-amber-200' : 'bg-amber-500'}
                      `} />
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-8 justify-center">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-md shadow-primary/20" />
                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Today</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-white/5 shadow-md shadow-amber-500/20" />
                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Exam Date</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full border border-white/10 bg-white/5" />
                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Weekend</span>
              </div>
            </div>
          </div>

          <div className="bg-bg-card p-6 rounded-[32px] border border-white/5 shadow-xl">
            <h3 className="font-bold text-text-primary mb-6 border-l-4 border-primary pl-3 uppercase text-xs tracking-widest">User Distribution</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={userDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {userDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {userDistributionData.map((d, i) => (
                <div key={`${d.name}_${i}`} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-xs font-bold text-text-muted uppercase">{d.name}: {d.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-bg-card p-6 rounded-[32px] border border-white/5 shadow-xl">
            <h3 className="font-bold text-text-primary mb-4 border-l-4 border-rose-500 pl-3 uppercase text-xs tracking-widest">Upcoming Deadlines</h3>
            <div className="space-y-4">
              {upcomingDeadlines.length > 0 ? (
                upcomingDeadlines.map((exam, idx) => (
                  <div key={`${exam.id}_deadline_${idx}`} className="flex gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors">
                    <div className="flex-shrink-0 w-10 h-10 bg-rose-500/10 rounded-lg flex flex-col items-center justify-center text-rose-500">
                      <span className="text-xs font-bold uppercase">{format(new Date(exam.dueDate!), 'MMM')}</span>
                      <span className="text-base font-bold leading-none">{format(new Date(exam.dueDate!), 'dd')}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-text-primary leading-tight uppercase tracking-tight">{exam.title}</h4>
                      <p className="text-xs font-medium text-text-muted mt-0.5">Due at {format(new Date(exam.dueDate!), 'HH:mm')}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-text-muted/40 text-sm italic">
                  No upcoming deadlines.
                </div>
              )}
              
              {isTeacher && (
                <>
                  <div className="border-t border-white/5 pt-4 mt-4">
                    <p className="text-xs font-bold text-text-muted uppercase mb-3">System Events</p>
                    <div className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors">
                      <div className="flex-shrink-0 w-12 h-12 bg-amber-500/10 rounded-lg flex flex-col items-center justify-center text-amber-500">
                        <span className="text-xs font-bold uppercase">Apr</span>
                        <span className="text-lg font-bold">05</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-text-primary">Staff Meeting</h4>
                        <p className="text-xs text-text-muted">09:00 AM - Room 204</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <ShareAppCard />
        </div>
      );
    };

  return (
    <div className="min-h-screen bg-bg-dark p-4 lg:p-8">
      {renderDashboard()}
      <AnimatePresence>
        {isAnnouncing && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto pt-10 sm:pt-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsAnnouncing(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-bg-card rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-white/10 max-h-[calc(100vh-4rem)] sm:max-h-[85vh] flex flex-col my-auto"
            >
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5 flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-text-primary tracking-tight">Create Announcement</h2>
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5">Broadcast message to portal</p>
                </div>
                <button onClick={() => setIsAnnouncing(false)} className="text-text-muted hover:text-text-primary transition-colors p-2 hover:bg-white/5 rounded-xl">
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSendAnnouncement} className="space-y-4 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                  <input
                    type="checkbox"
                    id="broadcast"
                    checked={newAnnouncement.broadcast}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, broadcast: e.target.checked }))}
                    className="w-4 h-4 text-primary border-white/10 rounded focus:ring-primary bg-bg-dark"
                  />
                  <label htmlFor="broadcast" className="text-xs font-semibold text-text-secondary cursor-pointer">
                    Broadcast to ALL students
                  </label>
                </div>

                {!newAnnouncement.broadcast && (
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 px-1">Target Class</label>
                    <select
                      required
                      value={newAnnouncement.classId}
                      onChange={(e) => setNewAnnouncement(prev => ({ ...prev, classId: e.target.value }))}
                      className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    >
                      <option value="" className="bg-bg-dark">Select Class</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id} className="bg-bg-dark">{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 px-1">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter announcement title"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary placeholder:text-text-muted/40 focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 px-1">Message</label>
                  <textarea
                    required
                    placeholder="Type your message here..."
                    value={newAnnouncement.message}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, message: e.target.value }))}
                    rows={4}
                    className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary placeholder:text-text-muted/40 focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 px-1 flex items-center gap-2">
                    <Paperclip size={14} className="text-text-muted" />
                    Attachment (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-3 border border-dashed border-white/10 rounded-xl p-4 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group">
                      <Paperclip size={16} className="text-text-muted group-hover:text-primary transition-colors" />
                      <span className="text-xs text-text-muted font-medium truncate max-w-[150px]">
                        {attachment ? attachment.name : 'Choose File'}
                      </span>
                      <input 
                        type="file" 
                        onChange={(e) => setAttachment(e.target.files?.[0] || null)} 
                        className="hidden" 
                      />
                    </label>
                    {attachment && (
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                      >
                        <XCircle size={20} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2 sticky bottom-0 bg-bg-card pb-2">
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs uppercase tracking-widest"
                  >
                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {isUploading ? 'Sending...' : 'Send Announcement'}
                  </button>
                </div>
              </form>

              {isUploading && uploadProgress > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    <span>Uploading Attachment</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      className="h-full bg-primary rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <Toast messages={toasts} onRemove={removeToast} />

      {/* Notice Viewer Modal */}
      <AnimatePresence>
        {viewingNotif && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto pt-10 sm:pt-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingNotif(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-bg-card border border-white/10 rounded-[32px] p-5 sm:p-8 md:p-10 w-full max-w-2xl max-h-[calc(100vh-4rem)] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden my-auto"
            >
               <div className="absolute top-0 left-0 w-full h-2 bg-primary" />
               <div className="flex justify-between items-start mb-6 shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
                        <Bell size={24} />
                     </div>
                     <div>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-1">
                          Notice • {format(new Date(viewingNotif.createdAt), 'MMMM dd, yyyy')}
                        </p>
                        <h2 className="text-xl font-bold text-text-primary uppercase tracking-tight leading-tight">{viewingNotif.title}</h2>
                     </div>
                  </div>
                  <button onClick={() => setViewingNotif(null)} className="p-2 text-text-muted hover:text-white transition-colors">
                     <XCircle size={24} />
                  </button>
               </div>

               <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar space-y-6">
                  <div className="bg-white/5 rounded-3xl p-6 sm:p-8">
                     <p className="text-text-secondary leading-relaxed whitespace-pre-wrap font-medium">
                       {viewingNotif.message}
                     </p>
                  </div>

                  {viewingNotif.attachmentUrl && (
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          {viewingNotif.attachmentType === 'image' ? <ImageIcon size={20} className="text-primary" /> : <FileText size={20} className="text-primary" />}
                          <span className="text-xs font-bold text-text-primary uppercase tracking-widest truncate max-w-[200px]">
                            {viewingNotif.attachmentName || 'View Attachment'}
                          </span>
                       </div>
                       <a 
                         href={viewingNotif.attachmentUrl} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-hover transition-all active:scale-95"
                       >
                         Download
                       </a>
                    </div>
                  )}

                  {viewingNotif.link && (
                    <Link 
                      to={viewingNotif.link} 
                      onClick={() => setViewingNotif(null)}
                      className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                    >
                      Open Related Page <ArrowRight size={16} />
                    </Link>
                  )}
               </div>

               {/* Dedicated Close button at bottom for easy mobile tap */}
               <div className="mt-6 pt-3 border-t border-white/5 shrink-0">
                  <button
                    onClick={() => setViewingNotif(null)}
                    className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 rounded-2xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98]"
                  >
                    Close
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
