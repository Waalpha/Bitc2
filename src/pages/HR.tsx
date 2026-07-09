import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { User } from '../types';
import { 
  Users, 
  UserCheck, 
  Briefcase, 
  Calendar, 
  Wallet, 
  Award, 
  Printer, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Clock, 
  ShieldAlert, 
  ChevronRight, 
  FileText, 
  ChevronDown, 
  User as UserIcon, 
  Loader2, 
  TrendingUp,
  Sliders,
  DollarSign,
  BriefcaseBusiness,
  HeartPulse,
  Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toast, ToastMessage } from '../components/Toast';

// Interface for leave requests
interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedBy?: string;
  comments?: string;
}

// Interface for payroll records
interface PayrollRecord {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  month: string; // e.g. "2026-07"
  basicSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: 'processed' | 'paid';
  processedAt: string;
  referenceNo: string;
  paymentMethod: string;
  department?: string;
}

// Interface for appraisal records
interface AppraisalRecord {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  reviewerId: string;
  reviewerName: string;
  kpis: { name: string; score: number }[];
  overallScore: number; // 1-5 scale
  achievements: string;
  areasOfImprovement: string;
  goals: string;
  createdAt: string;
}

export function HR() {
  const { userData, settings } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'leave' | 'payroll' | 'appraisal'>('overview');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Loading states
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingLeaves, setLoadingLeaves] = useState(true);
  const [loadingPayroll, setLoadingPayroll] = useState(true);
  const [loadingAppraisals, setLoadingAppraisals] = useState(true);

  // Firestore collections states
  const [staffList, setStaffList] = useState<User[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [appraisals, setAppraisals] = useState<AppraisalRecord[]>([]);

  // Modals / Forms states
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    role: 'teacher',
    phone: '',
    course: '', // acts as Department
    specialization: '', // acts as Designation/Role Details
    admissionDate: new Date().toISOString().split('T')[0],
    basicSalary: 35000,
    allowances: 5000,
    deductions: 2500,
  });

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    type: 'Annual Leave',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const [reviewingLeave, setReviewingLeave] = useState<LeaveRequest | null>(null);
  const [reviewComments, setReviewComments] = useState('');

  const [isAppraisalModalOpen, setIsAppraisalModalOpen] = useState(false);
  const [appraisalForm, setAppraisalForm] = useState({
    staffId: '',
    kpis: [
      { name: 'Punctuality & Attendance', score: 4 },
      { name: 'Task Quality & Timeliness', score: 4 },
      { name: 'Collaboration & Teamwork', score: 4 },
      { name: 'Student Engagement/Satisfaction', score: 4 },
    ],
    achievements: '',
    areasOfImprovement: '',
    goals: '',
  });

  // Payroll processing state
  const [processingMonth, setProcessingMonth] = useState(new Date().toISOString().substring(0, 7));
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);

  const isAdmin = userData?.role === 'admin';
  const currentUserId = userData?.uid || '';

  const addToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // Subscriptions to database
  useEffect(() => {
    // 1. Staff users subscription (role is NOT student or parent)
    const staffQuery = query(collection(db, 'users'));
    const unsubStaff = onSnapshot(staffQuery, (snap) => {
      const allUsers = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      const filteredStaff = allUsers.filter(u => u.role && !['student', 'parent'].includes(u.role));
      setStaffList(filteredStaff);
      setLoadingStaff(false);
    }, (err) => {
      console.error("Staff subscription error", err);
      setLoadingStaff(false);
    });

    // 2. Leave Requests subscription
    const leaveQuery = collection(db, 'leave_requests');
    const unsubLeaves = onSnapshot(leaveQuery, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
      // Sort by creation or startDate descending
      list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      setLeaveRequests(list);
      setLoadingLeaves(false);
    }, (err) => {
      console.error("Leave requests subscription error", err);
      setLoadingLeaves(false);
    });

    // 3. Payroll Records subscription
    const payrollQuery = collection(db, 'payroll');
    const unsubPayroll = onSnapshot(payrollQuery, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollRecord));
      list.sort((a, b) => b.month.localeCompare(a.month));
      setPayrollRecords(list);
      setLoadingPayroll(false);
    }, (err) => {
      console.error("Payroll subscription error", err);
      setLoadingPayroll(false);
    });

    // 4. Appraisals subscription
    const appraisalQuery = collection(db, 'appraisals');
    const unsubAppraisals = onSnapshot(appraisalQuery, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppraisalRecord));
      list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      setAppraisals(list);
      setLoadingAppraisals(false);
    }, (err) => {
      console.error("Appraisal subscription error", err);
      setLoadingAppraisals(false);
    });

    return () => {
      unsubStaff();
      unsubLeaves();
      unsubPayroll();
      unsubAppraisals();
    };
  }, []);

  // Filtered views
  const filteredStaffList = useMemo(() => {
    return staffList.filter(s => {
      const matchesSearch = s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.course?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [staffList, searchQuery]);

  // Leave stats & list filtered for current user if not admin
  const userLeaves = useMemo(() => {
    if (isAdmin) return leaveRequests;
    return leaveRequests.filter(l => l.staffId === currentUserId);
  }, [leaveRequests, isAdmin, currentUserId]);

  const userPayroll = useMemo(() => {
    if (isAdmin) return payrollRecords;
    return payrollRecords.filter(p => p.staffId === currentUserId);
  }, [payrollRecords, isAdmin, currentUserId]);

  const userAppraisals = useMemo(() => {
    if (isAdmin) return appraisals;
    return appraisals.filter(a => a.staffId === currentUserId);
  }, [appraisals, isAdmin, currentUserId]);

  // Calculations for overview stats
  const stats = useMemo(() => {
    const totalStaffCount = staffList.length;
    const pendingLeavesCount = leaveRequests.filter(l => l.status === 'pending').length;
    const totalSalaryProcessedThisMonth = payrollRecords
      .filter(p => p.month === processingMonth)
      .reduce((sum, p) => sum + (p.netPay || 0), 0);
    
    // Average overall rating of staff from recent appraisals
    const ratings = appraisals.map(a => a.overallScore);
    const avgRating = ratings.length > 0 ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : 'N/A';

    return {
      totalStaffCount,
      pendingLeavesCount,
      totalSalaryProcessedThisMonth,
      avgRating
    };
  }, [staffList, leaveRequests, payrollRecords, appraisals, processingMonth]);

  // Submit new staff details or update salary grades
  const handleSaveStaffSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    try {
      const userRef = doc(db, 'users', editingStaff.uid);
      await updateDoc(userRef, {
        course: staffForm.course, // Department
        specialization: staffForm.specialization, // Designation/Role
        admissionDate: staffForm.admissionDate, // Date of Admission
        basicSalary: Number(staffForm.basicSalary) || 0,
        allowances: Number(staffForm.allowances) || 0,
        deductions: Number(staffForm.deductions) || 0,
        updatedAt: new Date().toISOString()
      });
      addToast(`Staff settings updated successfully!`, 'success');
      setIsStaffModalOpen(false);
      setEditingStaff(null);
    } catch (err: any) {
      console.error("Error updating staff", err);
      addToast(`Failed to update staff settings: ${err.message}`, 'error');
    }
  };

  const handleOpenEditStaff = (staff: User) => {
    setEditingStaff(staff);
    setStaffForm({
      name: staff.name || '',
      email: staff.email || '',
      role: staff.role || 'teacher',
      phone: staff.phone || '',
      course: staff.course || '',
      specialization: staff.specialization || '',
      admissionDate: staff.admissionDate || new Date().toISOString().split('T')[0],
      basicSalary: (staff as any).basicSalary !== undefined ? Number((staff as any).basicSalary) : 35000,
      allowances: (staff as any).allowances !== undefined ? Number((staff as any).allowances) : 5000,
      deductions: (staff as any).deductions !== undefined ? Number((staff as any).deductions) : 2500,
    });
    setIsStaffModalOpen(true);
  };

  // Apply for a leave/time-off
  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    try {
      const docRef = await addDoc(collection(db, 'leave_requests'), {
        staffId: currentUserId,
        staffName: userData.name || 'Unknown Staff',
        role: userData.role || 'staff',
        type: leaveForm.type,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      addToast(`Leave application submitted successfully!`, 'success');
      setIsLeaveModalOpen(false);
      setLeaveForm({
        type: 'Annual Leave',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        reason: '',
      });
    } catch (err: any) {
      console.error("Error applying leave", err);
      addToast(`Leave submission failed: ${err.message}`, 'error');
    }
  };

  // Approve/Reject leave requests
  const handleReviewLeave = async (status: 'approved' | 'rejected') => {
    if (!reviewingLeave) return;

    try {
      const reqRef = doc(db, 'leave_requests', reviewingLeave.id);
      await updateDoc(reqRef, {
        status,
        reviewedBy: userData?.name || 'Administrator',
        comments: reviewComments,
        reviewedAt: new Date().toISOString()
      });
      addToast(`Leave request ${status} successfully!`, 'success');
      setReviewingLeave(null);
      setReviewComments('');
    } catch (err: any) {
      console.error("Error reviewing leave", err);
      addToast(`Review update failed: ${err.message}`, 'error');
    }
  };

  // Submit appraisal
  const handleSubmitAppraisal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appraisalForm.staffId) {
      addToast('Please select a staff member first.', 'warning');
      return;
    }

    const targetStaff = staffList.find(s => s.uid === appraisalForm.staffId);
    if (!targetStaff) return;

    // Calculate overall average score
    const totalScore = appraisalForm.kpis.reduce((acc, kpi) => acc + kpi.score, 0);
    const overallScore = Number((totalScore / appraisalForm.kpis.length).toFixed(1));

    try {
      await addDoc(collection(db, 'appraisals'), {
        staffId: targetStaff.uid,
        staffName: targetStaff.name || 'Unknown',
        role: targetStaff.role || 'staff',
        reviewerId: currentUserId,
        reviewerName: userData?.name || 'Administrator',
        kpis: appraisalForm.kpis,
        overallScore,
        achievements: appraisalForm.achievements,
        areasOfImprovement: appraisalForm.areasOfImprovement,
        goals: appraisalForm.goals,
        createdAt: new Date().toISOString()
      });
      addToast(`Performance Appraisal recorded for ${targetStaff.name}!`, 'success');
      setIsAppraisalModalOpen(false);
      setAppraisalForm({
        staffId: '',
        kpis: [
          { name: 'Punctuality & Attendance', score: 4 },
          { name: 'Task Quality & Timeliness', score: 4 },
          { name: 'Collaboration & Teamwork', score: 4 },
          { name: 'Student Engagement/Satisfaction', score: 4 },
        ],
        achievements: '',
        areasOfImprovement: '',
        goals: '',
      });
    } catch (err: any) {
      console.error("Error recording appraisal", err);
      addToast(`Failed to record performance review: ${err.message}`, 'error');
    }
  };

  // Run payroll processing for all staff members for the chosen month
  const handleProcessPayroll = async () => {
    if (!isAdmin) return;
    
    // Check if payroll already processed for this month to prevent duplicate entries
    const exists = payrollRecords.some(p => p.month === processingMonth);
    if (exists) {
      if (!window.confirm(`Payroll has already been processed for ${processingMonth}. Do you want to overwrite or process missing entries?`)) {
        return;
      }
    }

    let processedCount = 0;
    try {
      for (const staff of staffList) {
        // Calculate payroll details (basic, allowances, deductions)
        const basic = (staff as any).basicSalary !== undefined ? Number((staff as any).basicSalary) : 35000;
        const allowances = (staff as any).allowances !== undefined ? Number((staff as any).allowances) : 5000;
        const deductions = (staff as any).deductions !== undefined ? Number((staff as any).deductions) : 2500;
        const netPay = basic + allowances - deductions;

        // Create a record ID that is deterministic or unique per staff + month
        const refNo = `PAY-${processingMonth.replace('-', '')}-${staff.uid.substring(0, 4).toUpperCase()}`;

        // Check if record exists
        const existingRec = payrollRecords.find(p => p.staffId === staff.uid && p.month === processingMonth);
        
        if (existingRec) {
          // Update
          await updateDoc(doc(db, 'payroll', existingRec.id), {
            basicSalary: basic,
            allowances,
            deductions,
            netPay,
            processedAt: new Date().toISOString(),
            referenceNo: refNo,
          });
        } else {
          // Add new
          await addDoc(collection(db, 'payroll'), {
            staffId: staff.uid,
            staffName: staff.name || 'Unknown',
            role: staff.role || 'staff',
            department: staff.course || 'Support Services',
            month: processingMonth,
            basicSalary: basic,
            allowances,
            deductions,
            netPay,
            status: 'processed',
            processedAt: new Date().toISOString(),
            referenceNo: refNo,
            paymentMethod: 'Bank Transfer'
          });
        }
        processedCount++;
      }
      addToast(`Payroll compiled and processed for ${processedCount} staff members!`, 'success');
    } catch (err: any) {
      console.error("Error processing payroll", err);
      addToast(`Payroll processing failed: ${err.message}`, 'error');
    }
  };

  // Print highly professional Payslip to browser print window
  const handlePrintPayslip = (payslip: PayrollRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const staffMember = staffList.find(s => s.uid === payslip.staffId);
    const dateFormatted = new Date(payslip.processedAt).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const monthName = new Date(`${payslip.month}-02`).toLocaleString('en-KE', { month: 'long', year: 'numeric' });

    const html = `
      <html>
        <head>
          <title>Payslip - ${payslip.staffName} (${monthName})</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              color: #1f2937; 
              padding: 40px; 
              line-height: 1.5; 
              font-size: 13px;
            }
            .payslip-card {
              max-width: 800px;
              margin: 0 auto;
              border: 1px solid #e5e7eb;
              padding: 30px;
              border-radius: 12px;
              position: relative;
            }
            .header-container {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 3px double #143449;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .college-info {
              text-align: left;
            }
            .college-logo {
              max-height: 65px;
              width: auto;
            }
            .college-title {
              font-size: 20px;
              font-weight: 900;
              color: #143449;
              letter-spacing: -0.02em;
              text-transform: uppercase;
              margin: 0;
            }
            .college-sub {
              font-size: 10px;
              font-weight: 700;
              color: #ef4444;
              letter-spacing: 0.15em;
              text-transform: uppercase;
              margin: 4px 0 0;
            }
            .document-title {
              font-size: 18px;
              font-weight: 800;
              color: #111827;
              text-transform: uppercase;
              text-align: right;
              margin: 0;
              letter-spacing: 0.05em;
            }
            .doc-ref {
              font-size: 11px;
              color: #6b7280;
              font-weight: 600;
              text-align: right;
              margin-top: 5px;
            }
            .meta-grid {
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 25px;
              margin-bottom: 25px;
              background-color: #f9fafb;
              padding: 18px;
              border-radius: 8px;
              border: 1px solid #f3f4f6;
            }
            .meta-column h3 {
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              color: #9ca3af;
              margin: 0 0 8px 0;
            }
            .meta-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 6px;
              font-size: 12px;
            }
            .meta-label {
              font-weight: 500;
              color: #6b7280;
            }
            .meta-val {
              font-weight: 700;
              color: #111827;
            }
            
            .ledger-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .ledger-table th {
              background-color: #143449;
              color: #ffffff;
              text-align: left;
              padding: 10px 12px;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .ledger-table td {
              padding: 12px;
              border-bottom: 1px solid #e5e7eb;
              font-size: 12px;
            }
            .ledger-group-title {
              font-weight: 800;
              color: #143449;
              background: #f3f4f6;
              font-size: 11px;
              text-transform: uppercase;
              padding: 8px 12px !important;
            }
            .amount {
              text-align: right;
              font-weight: 600;
            }
            .amount-green {
              color: #10b981;
            }
            .amount-red {
              color: #ef4444;
            }
            
            .summary-block {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 35px;
            }
            .summary-table {
              width: 300px;
              border-collapse: collapse;
            }
            .summary-table td {
              padding: 8px 12px;
              font-size: 12px;
            }
            .summary-label {
              color: #4b5563;
              font-weight: 500;
            }
            .net-pay-row {
              background-color: #143449;
              color: white;
              font-weight: 800;
              font-size: 14px !important;
              border-radius: 6px;
            }
            .net-pay-row td {
              color: white !important;
              padding: 12px !important;
            }
            
            .stamp-container {
              position: absolute;
              bottom: 45px;
              left: 45px;
              z-index: 10;
              opacity: 0.85;
            }
            .stamp {
              max-height: 100px;
              width: auto;
            }
            .signature-area {
              display: flex;
              justify-content: flex-end;
              margin-top: 50px;
              padding-top: 20px;
            }
            .sig-block {
              text-align: center;
              width: 220px;
            }
            .sig-line {
              border-bottom: 1px solid #9ca3af;
              margin-bottom: 8px;
              height: 40px;
            }
            .sig-title {
              font-size: 11px;
              color: #6b7280;
              font-weight: 600;
              text-transform: uppercase;
            }

            .watermark-container {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              z-index: -10;
              opacity: 0.05;
              pointer-events: none;
            }
            .watermark-text {
              font-size: 55pt;
              font-weight: 950;
              color: #143449;
              transform: rotate(-35deg);
              text-align: center;
              white-space: nowrap;
              letter-spacing: 5px;
            }

            @media print {
              body { padding: 0; }
              .payslip-card { border: none; padding: 0; }
              @page { margin: 1.5cm; }
              .net-pay-row {
                background-color: #143449 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .net-pay-row td {
                color: white !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="payslip-card">
            <div class="watermark-container">
              <div class="watermark-text">${(settings?.schoolName || 'Breakthrough College').toUpperCase()}</div>
            </div>
            
            <div class="header-container">
              <div class="college-info">
                ${settings?.logoUrl ? `<img src="${settings.logoUrl}" class="college-logo" alt="Logo" />` : ''}
                <h1 class="college-title">${settings?.schoolName || 'Breakthrough International Training College'}</h1>
                <p class="college-sub">OFFICIAL SALARY ADVICE / PAYSLIP</p>
              </div>
              <div>
                <h2 class="document-title">PAYSLIP</h2>
                <div class="doc-ref">REF: ${payslip.referenceNo}</div>
                <div class="doc-ref" style="margin-top: 2px;">DATE: ${dateFormatted}</div>
              </div>
            </div>

            <div class="meta-grid">
              <div class="meta-column">
                <h3>Employee Information</h3>
                <div class="meta-row">
                  <span class="meta-label">Name:</span>
                  <span class="meta-val">${payslip.staffName}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Employee ID:</span>
                  <span class="meta-val">${staffMember?.admissionNumber || payslip.staffId.substring(0, 8).toUpperCase()}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Role/Designation:</span>
                  <span class="meta-val" style="text-transform: capitalize;">${staffMember?.specialization || payslip.role}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Department:</span>
                  <span class="meta-val">${payslip.department || 'Academic Affairs'}</span>
                </div>
              </div>
              <div class="meta-column">
                <h3>Payment Details</h3>
                <div class="meta-row">
                  <span class="meta-label">Pay Period:</span>
                  <span class="meta-val">${monthName}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Payment Method:</span>
                  <span class="meta-val">${payslip.paymentMethod}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Currency:</span>
                  <span class="meta-val">Kenya Shillings (Ksh)</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Status:</span>
                  <span class="meta-val" style="color: #10b981; text-transform: uppercase;">Paid</span>
                </div>
              </div>
            </div>

            <table class="ledger-table">
              <thead>
                <tr>
                  <th width="70%">Description</th>
                  <th width="30%" class="amount">Amount (Ksh)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="ledger-group-title" colspan="2">Earning / Basic Allowances</td>
                </tr>
                <tr>
                  <td>Basic Salary / Monthly Base Grade</td>
                  <td class="amount amount-green">+ Ksh ${payslip.basicSalary.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>House Allowance & Academic Stipend</td>
                  <td class="amount amount-green">+ Ksh ${(payslip.allowances * 0.6).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Transport & Commuter Reimbursement</td>
                  <td class="amount amount-green">+ Ksh ${(payslip.allowances * 0.4).toLocaleString()}</td>
                </tr>
                
                <tr>
                  <td class="ledger-group-title" colspan="2">Statutory & Voluntarily Deductions</td>
                </tr>
                <tr>
                  <td>National Social Security Fund (NSSF Kenya)</td>
                  <td class="amount amount-red">- Ksh ${(payslip.deductions * 0.35).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>National Hospital Insurance Fund (NHIF Kenya)</td>
                  <td class="amount amount-red">- Ksh ${(payslip.deductions * 0.25).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Pay As You Earn (PAYE Income Tax)</td>
                  <td class="amount amount-red">- Ksh ${(payslip.deductions * 0.40).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                ${settings?.stampUrl ? `
                  <div class="stamp-container">
                    <img src="${settings.stampUrl}" class="stamp" alt="Stamp" />
                  </div>
                ` : ''}
              </div>
              <div class="summary-block">
                <table class="summary-table">
                  <tr>
                    <td class="summary-label">Gross Earnings:</td>
                    <td class="amount">Ksh ${(payslip.basicSalary + payslip.allowances).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td class="summary-label">Total Deductions:</td>
                    <td class="amount" style="color: #ef4444;">Ksh ${payslip.deductions.toLocaleString()}</td>
                  </tr>
                  <tr class="net-pay-row">
                    <td>NET TAKE-HOME:</td>
                    <td class="amount">Ksh ${payslip.netPay.toLocaleString()}</td>
                  </tr>
                </table>
              </div>
            </div>

            <div class="signature-area">
              <div class="sig-block">
                <div class="sig-line"></div>
                <div class="sig-title">Finance Controller / Principal</div>
                <div class="sig-title" style="font-size: 9px; font-weight: normal; margin-top: 2px;">Breakthrough Finance Office</div>
              </div>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8" id="hr_module_root">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Toast Container */}
        <Toast messages={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

        {/* Dynamic Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden" id="hr_header">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-32 h-32 bg-emerald-50 rounded-full blur-3xl pointer-events-none" />
          <div>
            <span className="text-[10px] font-black tracking-[0.3em] text-emerald-600 uppercase">Human Resources</span>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mt-1">HR & Staff Management</h1>
            <p className="text-sm font-semibold text-gray-400 mt-1">
              {isAdmin ? "Manage employee registry, leave calendars, statutory payrolls, and official payslips" : `Personal HR Space - Logged in as ${userData?.name}`}
            </p>
          </div>
          
          {/* Main Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            {activeTab === 'leave' && (
              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-100 transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>Request Leave</span>
              </button>
            )}
            {activeTab === 'appraisal' && isAdmin && (
              <button
                onClick={() => setIsAppraisalModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-100 transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>Evaluate Employee</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto scrollbar-none" id="hr_tab_bar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'overview' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <TrendingUp size={14} />
            <span>Overview</span>
          </button>
          
          {isAdmin && (
            <button
              onClick={() => setActiveTab('staff')}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'staff' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Users size={14} />
              <span>Staff Directory</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('leave')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'leave' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Calendar size={14} />
            <span>Leave {isAdmin && stats.pendingLeavesCount > 0 && <span className="ml-1 bg-rose-500 text-white text-[10px] h-5 w-5 rounded-full flex items-center justify-center font-bold animate-pulse inline-flex">{stats.pendingLeavesCount}</span>}</span>
          </button>

          <button
            onClick={() => setActiveTab('payroll')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'payroll' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Wallet size={14} />
            <span>Payroll</span>
          </button>

          <button
            onClick={() => setActiveTab('appraisal')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'appraisal' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Award size={14} />
            <span>Appraisals</span>
          </button>
        </div>

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8" id="overview_panel">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl">
                  <Users size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Employees</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{loadingStaff ? '...' : stats.totalStaffCount}</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="bg-rose-50 text-rose-500 p-4 rounded-2xl">
                  <Calendar size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pending Leaves</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{loadingLeaves ? '...' : stats.pendingLeavesCount}</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl">
                  <Wallet size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monthly Payroll Net</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">Ksh {loadingPayroll ? '...' : stats.totalSalaryProcessedThisMonth.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl">
                  <Award size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Average Appraisal</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{loadingAppraisals ? '...' : stats.avgRating} <span className="text-xs text-gray-400 font-bold">/ 5</span></p>
                </div>
              </div>
            </div>

            {/* Split Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Block - Staff Quick Overview */}
              <div className="lg:col-span-7 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
                <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Staff Demographics</h2>
                {loadingStaff ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="animate-spin text-emerald-500 mr-2" size={20} />
                    <span>Loading statistics...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {['teacher', 'registrar', 'finance', 'staff'].map(role => {
                      const count = staffList.filter(s => s.role === role).length;
                      const percentage = staffList.length > 0 ? (count / staffList.length) * 100 : 0;
                      const roleColors: any = {
                        teacher: 'bg-emerald-500',
                        registrar: 'bg-blue-500',
                        finance: 'bg-indigo-500',
                        staff: 'bg-rose-500'
                      };
                      return (
                        <div key={role} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold text-gray-600">
                            <span className="capitalize">{role === 'staff' ? 'Support Staff' : role}s</span>
                            <span>{count} Staff ({percentage.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${roleColors[role] || 'bg-slate-500'}`} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Block - Announcements/Quick Actions */}
              <div className="lg:col-span-5 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">System Guide</h2>
                  <p className="text-xs text-gray-400 leading-relaxed mt-2">
                    Human Resources module implements complete organizational control. Staff can request leaves of absence, check monthly processed salary advices, and view performance scorecards. Admins can manage designations, process automated monthly statutory payroll files, and record KPIs.
                  </p>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-gray-100 space-y-3">
                  <p className="text-xs font-bold text-gray-700">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setActiveTab('leave')} className="p-3 bg-white hover:bg-slate-50 border border-gray-200 rounded-xl text-xs font-semibold text-center text-gray-700 cursor-pointer">
                      Leave Records
                    </button>
                    <button onClick={() => setActiveTab('payroll')} className="p-3 bg-white hover:bg-slate-50 border border-gray-200 rounded-xl text-xs font-semibold text-center text-gray-700 cursor-pointer">
                      Payslips
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. STAFF DIRECTORY TAB */}
        {activeTab === 'staff' && isAdmin && (
          <div className="space-y-6" id="staff_directory_panel">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search staff by name, email, department, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-white rounded-2xl border border-gray-100 text-sm font-semibold focus:ring-4 focus:ring-slate-100 outline-none transition-all text-gray-800 shadow-sm"
                />
              </div>
            </div>

            {/* Staff Cards Grid */}
            {loadingStaff ? (
              <div className="text-center py-24 bg-white rounded-[32px] border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-emerald-600 mb-3" size={32} />
                <p className="text-gray-400 font-bold text-sm">Loading staff members...</p>
              </div>
            ) : filteredStaffList.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-[32px] border border-gray-100 shadow-sm">
                <p className="text-gray-400 font-bold">No staff members found matching search query.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStaffList.map((staff) => (
                  <motion.div
                    key={staff.uid}
                    layout
                    className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6"
                  >
                    <div>
                      {/* Badge / Role */}
                      <div className="flex justify-between items-start">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          staff.role === 'teacher' ? 'bg-emerald-50 text-emerald-600' :
                          staff.role === 'registrar' ? 'bg-blue-50 text-blue-600' :
                          staff.role === 'finance' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-500'
                        }`}>
                          {staff.role === 'staff' ? 'Support Staff' : staff.role}
                        </span>
                        
                        <button
                          onClick={() => handleOpenEditStaff(staff)}
                          className="p-2 hover:bg-slate-50 text-gray-400 hover:text-gray-900 rounded-xl transition-all cursor-pointer"
                          title="Configure Designation, Department & Salaries"
                        >
                          <Edit2 size={15} />
                        </button>
                      </div>

                      {/* Info block */}
                      <div className="flex gap-4 mt-4">
                        <div className="h-12 w-12 bg-slate-50 border border-gray-100 rounded-2xl flex items-center justify-center text-gray-500 font-bold uppercase text-base shrink-0">
                          {staff.name?.substring(0, 2) || 'ST'}
                        </div>
                        <div className="overflow-hidden">
                          <h3 className="font-bold text-gray-900 text-sm truncate">{staff.name || 'Anonymous Employee'}</h3>
                          <p className="text-xs text-gray-400 truncate">{staff.email}</p>
                          <p className="text-[10px] font-bold text-gray-500 mt-1">{staff.phone || 'No phone recorded'}</p>
                        </div>
                      </div>

                      {/* Detail List */}
                      <div className="mt-5 pt-4 border-t border-gray-50 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Department:</span>
                          <span className="font-bold text-gray-700">{staff.course || 'Not Assigned'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Designation:</span>
                          <span className="font-bold text-gray-700">{staff.specialization || 'Not Assigned'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Admission Date:</span>
                          <span className="font-bold text-gray-700">{staff.admissionDate ? new Date(staff.admissionDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Pay Grade Preview */}
                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-gray-100/50 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 font-medium">Estimated Net Salary:</span>
                        <span className="font-bold text-emerald-600">
                          Ksh {(((staff as any).basicSalary || 35000) + ((staff as any).allowances || 5000) - ((staff as any).deductions || 2500)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. LEAVE TAB */}
        {activeTab === 'leave' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="leave_panel">
            {/* Left side: Applications History */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                <h2 className="text-base font-black text-gray-900 uppercase tracking-tight mb-6">Leave Application Log</h2>
                
                {loadingLeaves ? (
                  <div className="text-center py-12 flex flex-col items-center">
                    <Loader2 className="animate-spin text-emerald-600 mb-2" size={24} />
                    <p className="text-sm text-gray-400">Loading leave requests...</p>
                  </div>
                ) : userLeaves.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-400 font-bold">No leave requests logged in this period.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {userLeaves.map((req) => (
                      <div key={req.id} className="py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 first:pt-0 last:pb-0">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-bold text-gray-900 text-sm">{req.type}</span>
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                              req.status === 'rejected' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {req.status}
                            </span>
                          </div>
                          {isAdmin && (
                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider mt-1">{req.staffName} ({req.role})</p>
                          )}
                          <p className="text-xs text-gray-500 mt-2 font-medium">
                            Duration: <span className="text-gray-800 font-bold">{new Date(req.startDate).toLocaleDateString('en-KE')}</span> to <span className="text-gray-800 font-bold">{new Date(req.endDate).toLocaleDateString('en-KE')}</span>
                          </p>
                          <p className="text-xs text-gray-400 italic mt-1">&quot;{req.reason}&quot;</p>
                          {req.comments && (
                            <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-2.5">
                              <strong>Remarks:</strong> {req.comments}
                            </p>
                          )}
                        </div>

                        {/* Action for admin */}
                        {isAdmin && req.status === 'pending' && (
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => {
                                setReviewingLeave(req);
                                setReviewComments('');
                              }}
                              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              Action Request
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Quick Info / Current User Leave Balance Card */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Time-Off Allocation</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Annual leave allocations are calculated based on job designation. Standard annual paid leave is 21 calendar days per annum.
                </p>
                <div className="space-y-4 pt-4 border-t border-gray-50 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold">Annual Paid Leave:</span>
                    <span className="font-bold text-gray-900">21 Days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold">Sick Leave Allocation:</span>
                    <span className="font-bold text-gray-900">14 Days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold">Maternity Leave:</span>
                    <span className="font-bold text-gray-900">90 Days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. PAYROLL TAB */}
        {activeTab === 'payroll' && (
          <div className="space-y-6" id="payroll_panel">
            {/* Control Strip for Admin */}
            {isAdmin && (
              <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-wider">Payroll Month:</label>
                  <input
                    type="month"
                    value={processingMonth}
                    onChange={(e) => setProcessingMonth(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleProcessPayroll}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-50 transition-all cursor-pointer w-full sm:w-auto text-center justify-center"
                >
                  <Wallet size={15} />
                  <span>Compile & Process Payroll</span>
                </button>
              </div>
            )}

            {/* Payroll History Ledger */}
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
              <h2 className="text-base font-black text-gray-900 uppercase tracking-tight mb-6">Payroll Ledger / Payslip Archive</h2>
              
              {loadingPayroll ? (
                <div className="text-center py-12">
                  <Loader2 className="animate-spin text-emerald-600 mx-auto mb-2" size={24} />
                  <p className="text-sm text-gray-400">Loading payroll history...</p>
                </div>
              ) : userPayroll.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-400 font-bold">No processed payroll records found in this cycle.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-400 font-black uppercase tracking-wider">
                        <th className="pb-4">Employee</th>
                        <th className="pb-4">Month</th>
                        <th className="pb-4">Ref No.</th>
                        <th className="pb-4 text-right">Basic Pay</th>
                        <th className="pb-4 text-right">Net Pay</th>
                        <th className="pb-4 text-center">Status</th>
                        <th className="pb-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm font-semibold text-gray-800">
                      {userPayroll.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="py-4">
                            <div>
                              <p className="font-bold text-gray-900">{rec.staffName}</p>
                              <p className="text-[10px] text-gray-400 capitalize">{rec.role}</p>
                            </div>
                          </td>
                          <td className="py-4 text-xs font-bold text-gray-500">
                            {new Date(`${rec.month}-02`).toLocaleString('en-KE', { month: 'long', year: 'numeric' })}
                          </td>
                          <td className="py-4 text-xs font-bold text-slate-500 font-mono">{rec.referenceNo}</td>
                          <td className="py-4 text-right font-bold text-gray-600">Ksh {rec.basicSalary.toLocaleString()}</td>
                          <td className="py-4 text-right font-black text-emerald-600">Ksh {rec.netPay.toLocaleString()}</td>
                          <td className="py-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600">
                              Paid
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <button
                              onClick={() => handlePrintPayslip(rec)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
                            >
                              <Printer size={12} />
                              <span>Payslip</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. APPRAISALS TAB */}
        {activeTab === 'appraisal' && (
          <div className="space-y-6" id="appraisals_panel">
            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
              <h2 className="text-base font-black text-gray-900 uppercase tracking-tight mb-6">Staff Scorecards & Reviews</h2>
              
              {loadingAppraisals ? (
                <div className="text-center py-12">
                  <Loader2 className="animate-spin text-emerald-600 mx-auto mb-2" size={24} />
                  <p className="text-sm text-gray-400">Loading appraisal archive...</p>
                </div>
              ) : userAppraisals.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-400 font-bold">No performance appraisals have been logged for this cycle.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {userAppraisals.map((appr) => (
                    <div key={appr.id} className="p-6 bg-slate-50/50 rounded-2xl border border-gray-100 flex flex-col md:flex-row gap-6 justify-between">
                      <div className="space-y-4 flex-1">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-gray-900 text-base">{appr.staffName}</h3>
                            <span className="capitalize text-xs text-gray-400 font-bold">({appr.role})</span>
                          </div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Reviewed by {appr.reviewerName} on {new Date(appr.createdAt).toLocaleDateString()}</p>
                        </div>

                        {/* KPI breakdown */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {appr.kpis.map((kpi, kIdx) => (
                            <div key={kIdx} className="bg-white p-3.5 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
                              <span className="text-gray-500 font-bold">{kpi.name}</span>
                              <span className="font-bold text-indigo-600">{kpi.score} / 5</span>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2 pt-2 border-t border-gray-100 text-xs">
                          <div>
                            <span className="text-gray-400 font-bold uppercase tracking-wide block">Achievements:</span>
                            <p className="text-gray-700 font-semibold mt-1 bg-white p-3 rounded-xl border border-gray-100/50 leading-relaxed">&quot;{appr.achievements}&quot;</p>
                          </div>
                          <div>
                            <span className="text-gray-400 font-bold uppercase tracking-wide block">Areas for Improvement:</span>
                            <p className="text-gray-700 font-semibold mt-1 bg-white p-3 rounded-xl border border-gray-100/50 leading-relaxed">&quot;{appr.areasOfImprovement}&quot;</p>
                          </div>
                          <div>
                            <span className="text-gray-400 font-bold uppercase tracking-wide block">Future Goals:</span>
                            <p className="text-gray-700 font-semibold mt-1 bg-white p-3 rounded-xl border border-gray-100/50 leading-relaxed">&quot;{appr.goals}&quot;</p>
                          </div>
                        </div>
                      </div>

                      {/* Score Badge */}
                      <div className="flex flex-col items-center justify-center bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100/50 text-center shrink-0 w-full md:w-40 h-fit space-y-2 md:mt-2">
                        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-500">Overall Grade</span>
                        <div className="text-4xl font-black text-indigo-700">{appr.overallScore}</div>
                        <div className="flex text-amber-500 text-sm">
                          {Array.from({ length: Math.round(appr.overallScore) }).map((_, i) => (
                            <span key={i}>★</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ================= MODALS ================= */}

      {/* 1. Staff Modal (Configure staff settings/salaries) */}
      <AnimatePresence>
        {isStaffModalOpen && editingStaff && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden border border-gray-100 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-black text-gray-900 text-lg uppercase">Staff Setup</h3>
                  <p className="text-xs text-gray-400 font-semibold">{editingStaff.name}</p>
                </div>
                <button
                  onClick={() => setIsStaffModalOpen(false)}
                  className="h-8 w-8 rounded-full hover:bg-white/50 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-all cursor-pointer"
                >
                  <XCircle size={22} />
                </button>
              </div>

              <form onSubmit={handleSaveStaffSettings} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                {/* Department & Designation */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Department</label>
                    <input
                      type="text"
                      placeholder="e.g. IT, Science, Kitchen"
                      value={staffForm.course}
                      onChange={(e) => setStaffForm({ ...staffForm, course: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Designation</label>
                    <input
                      type="text"
                      placeholder="e.g. Lecturer, Chef, Supervisor"
                      value={staffForm.specialization}
                      onChange={(e) => setStaffForm({ ...staffForm, specialization: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 font-bold"
                    />
                  </div>
                </div>

                {/* Date of Admission */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Date of Admission / Appointment</label>
                  <input
                    type="date"
                    value={staffForm.admissionDate}
                    onChange={(e) => setStaffForm({ ...staffForm, admissionDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 font-bold text-gray-800"
                  />
                </div>

                {/* Salary details */}
                <div className="p-5 bg-slate-50 rounded-2xl border border-gray-100 space-y-4">
                  <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
                    <DollarSign size={14} className="text-indigo-600" />
                    <span>Compensation Schedule</span>
                  </h4>
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Basic Pay</label>
                        <input
                          type="number"
                          value={staffForm.basicSalary}
                          onChange={(e) => setStaffForm({ ...staffForm, basicSalary: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Allowances</label>
                        <input
                          type="number"
                          value={staffForm.allowances}
                          onChange={(e) => setStaffForm({ ...staffForm, allowances: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Deductions</label>
                        <input
                          type="number"
                          value={staffForm.deductions}
                          onChange={(e) => setStaffForm({ ...staffForm, deductions: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all cursor-pointer"
                >
                  Save Contract Details
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Leave Modal */}
      <AnimatePresence>
        {isLeaveModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden border border-gray-100 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-black text-gray-900 text-lg uppercase">Apply for Leave</h3>
                  <p className="text-xs text-gray-400 font-semibold">Enter details for supervisor review</p>
                </div>
                <button
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="h-8 w-8 rounded-full hover:bg-white/50 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-all cursor-pointer"
                >
                  <XCircle size={22} />
                </button>
              </div>

              <form onSubmit={handleApplyLeave} className="p-8 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Leave Category</label>
                  <select
                    value={leaveForm.type}
                    onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-50 font-bold text-gray-800"
                  >
                    <option value="Annual Leave">Annual Leave</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Casual Leave">Casual Leave</option>
                    <option value="Maternity Leave">Maternity Leave</option>
                    <option value="Paternity Leave">Paternity Leave</option>
                    <option value="Compassionate Leave">Compassionate Leave</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Start Date</label>
                    <input
                      type="date"
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-50 font-bold text-gray-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">End Date</label>
                    <input
                      type="date"
                      value={leaveForm.endDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-50 font-bold text-gray-800"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Reason for Request</label>
                  <textarea
                    rows={3}
                    placeholder="Enter context or special justification..."
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-50 font-bold text-gray-800 resize-none"
                    required
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all cursor-pointer"
                >
                  Submit Application
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Leave Review Modal */}
      <AnimatePresence>
        {reviewingLeave && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden border border-gray-100 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-black text-gray-900 text-lg uppercase">Review Leave Application</h3>
                  <p className="text-xs text-gray-400 font-semibold">Decide request for {reviewingLeave.staffName}</p>
                </div>
                <button
                  onClick={() => setReviewingLeave(null)}
                  className="h-8 w-8 rounded-full hover:bg-white/50 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-all cursor-pointer"
                >
                  <XCircle size={22} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-gray-100 text-xs">
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-gray-400">Employee:</span>
                    <span className="text-gray-800 capitalize">{reviewingLeave.staffName} ({reviewingLeave.role})</span>
                  </div>
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-gray-400">Category:</span>
                    <span className="text-gray-800">{reviewingLeave.type}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-gray-400">Duration:</span>
                    <span className="text-gray-800">{reviewingLeave.startDate} to {reviewingLeave.endDate}</span>
                  </div>
                  <p className="mt-3 text-gray-500 italic border-t border-slate-200/50 pt-2.5">&quot;{reviewingLeave.reason}&quot;</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Review Comments</label>
                  <textarea
                    rows={2}
                    placeholder="Provide optional explanation or comment..."
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 font-bold text-gray-800 resize-none"
                  ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleReviewLeave('rejected')}
                    className="py-4 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 font-black text-xs uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
                  >
                    Reject Leave
                  </button>
                  <button
                    onClick={() => handleReviewLeave('approved')}
                    className="py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-50 transition-all cursor-pointer"
                  >
                    Approve Leave
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Appraisal Modal */}
      <AnimatePresence>
        {isAppraisalModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden border border-gray-100 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-black text-gray-900 text-lg uppercase">Performance Appraisal</h3>
                  <p className="text-xs text-gray-400 font-semibold">Record ratings & key scorecard feedback</p>
                </div>
                <button
                  onClick={() => setIsAppraisalModalOpen(false)}
                  className="h-8 w-8 rounded-full hover:bg-white/50 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-all cursor-pointer"
                >
                  <XCircle size={22} />
                </button>
              </div>

              <form onSubmit={handleSubmitAppraisal} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Employee to Appraise</label>
                  <select
                    value={appraisalForm.staffId}
                    onChange={(e) => setAppraisalForm({ ...appraisalForm, staffId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 font-bold text-gray-800"
                    required
                  >
                    <option value="">-- Choose Employee --</option>
                    {staffList.map(s => (
                      <option key={s.uid} value={s.uid}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>

                {/* Score indicators */}
                <div className="space-y-4">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">KPI Star Rating (1 to 5)</p>
                  <div className="space-y-3">
                    {appraisalForm.kpis.map((kpi, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-xs text-gray-600 font-bold">{kpi.name}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => {
                                const copy = [...appraisalForm.kpis];
                                copy[idx].score = star;
                                setAppraisalForm({ ...appraisalForm, kpis: copy });
                              }}
                              className={`text-base font-bold ${star <= kpi.score ? 'text-amber-500' : 'text-slate-200'} transition-all`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Narrative blocks */}
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Key Achievements</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Excellent student feedback, launched modular practical class..."
                      value={appraisalForm.achievements}
                      onChange={(e) => setAppraisalForm({ ...appraisalForm, achievements: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 font-bold text-gray-800 resize-none"
                    ></textarea>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Areas of Improvement</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Turnaround time for marking exam registers..."
                      value={appraisalForm.areasOfImprovement}
                      onChange={(e) => setAppraisalForm({ ...appraisalForm, areasOfImprovement: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 font-bold text-gray-800 resize-none"
                    ></textarea>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Future Professional Goals</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Complete advanced certifications, supervise next clinical cohort..."
                      value={appraisalForm.goals}
                      onChange={(e) => setAppraisalForm({ ...appraisalForm, goals: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 font-bold text-gray-800 resize-none"
                    ></textarea>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all cursor-pointer"
                >
                  Save Evaluation
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
