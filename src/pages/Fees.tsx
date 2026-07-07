import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, setDoc, addDoc, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { FeeBalance, User, Class, ClassFee, Unit, FeeType, FeeGroup, Expense } from '../types';
import { Wallet, Plus, History, Send, Search, Filter, CreditCard, ArrowUpRight, ArrowDownLeft, XCircle, BookOpen, Layers, CheckCircle2, Users, RefreshCw, Edit2, Trash2, Printer, TrendingUp, Tags, FileText, Sparkles, Calculator, Calendar, Eye, EyeOff, AlertTriangle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Toast, ToastMessage } from '../components/Toast';

export const Fees: React.FC = () => {
  const { user, userData, hasPermission, settings, studentContext } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [activeTab, setActiveTab] = useState<'individual' | 'classes' | 'structure' | 'reports'>('individual');
  const [structureClassId, setStructureClassId] = useState<string>('all');
  const [feeBalances, setFeeBalances] = useState<FeeBalance[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [classFees, setClassFees] = useState<ClassFee[]>([]);
  const [myBalance, setMyBalance] = useState<FeeBalance | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'outstanding' | 'overpaid' | 'suspended'>('all');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAddingClassFee, setIsAddingClassFee] = useState(false);
  const [isAddingFeeType, setIsAddingFeeType] = useState(false);
  const [isAddingFeeGroup, setIsAddingFeeGroup] = useState(false);
  const [newFeeTypeName, setNewFeeTypeName] = useState('');
  const [newFeeGroupName, setNewFeeGroupName] = useState('');
  const [isApplyingFee, setIsApplyingFee] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [updateForm, setUpdateForm] = useState({ 
    amount: 0, 
    type: 'payment' as 'payment' | 'charge', 
    description: '',
    file: null as File | null
  });
  const [updateMode, setUpdateMode] = useState<'transaction' | 'direct'>('transaction');
  const [directForm, setDirectForm] = useState({
    totalAmount: 0,
    paidAmount: 0,
    reason: ''
  });
  const [feeGroups, setFeeGroups] = useState<FeeGroup[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [suspendedStudentIds, setSuspendedStudentIds] = useState<Set<string>>(new Set());
  const [classFeeForm, setClassFeeForm] = useState({ classId: '', title: '', amount: 0, period: 'monthly' as 'semester' | 'yearly' | 'monthly', feeType: '', feeGroup: '' });
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editingFeeTypeId, setEditingFeeTypeId] = useState<string | null>(null);
  const [editingFeeGroupId, setEditingFeeGroupId] = useState<string | null>(null);
  const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null);
  const [auditSelectedClassId, setAuditSelectedClassId] = useState<string | null>(null);
  const [auditStatusFilter, setAuditStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'overpaid' | 'paid_this_month'>('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [printConfirm, setPrintConfirm] = useState<{ student: User, item: any, balance: any } | null>(null);
  const [isPenaltyEnabled, setIsPenaltyEnabled] = useState<boolean>(settings?.isPenaltyEnabled ?? true);
  const [penaltyDay, setPenaltyDay] = useState<number>(settings?.penaltyDay ?? 5);
  const [penaltyAmount, setPenaltyAmount] = useState<number>(settings?.penaltyAmount ?? 500);
  const [isSavingPenaltySettings, setIsSavingPenaltySettings] = useState<boolean>(false);
  const [isApplyingPenalties, setIsApplyingPenalties] = useState<boolean>(false);

  const addToast = (text: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const isAdminView = hasPermission('manage_fees');

  const handleDeleteHistoryItem = async (studentId: string, index: number) => {
    if (!isAdminView) return;
    if (!confirm("Are you sure you want to delete this transaction? This will permanently adjust the student's balance.")) return;
    
    try {
      const studentBalance = feeBalances.find(b => b.studentId === studentId);
      if (!studentBalance) {
        addToast("Fee balance record not found", "error");
        return;
      }
      
      const history = studentBalance.history || [];
      if (index < 0 || index >= history.length) return;
      
      const itemToDelete = history[index];
      const newHistory = [...history];
      newHistory.splice(index, 1);
      
      const amountNum = Number(itemToDelete.amount);
      let newTotal = Number(studentBalance.totalAmount || 0);
      let newPaid = Number(studentBalance.paidAmount || 0);
      
      if (itemToDelete.type === 'payment') {
        newPaid -= amountNum;
      } else {
        newTotal -= amountNum;
      }
      
      await updateDoc(doc(db, 'fees', studentBalance.id), {
        totalAmount: newTotal,
        paidAmount: newPaid,
        balance: newTotal - newPaid,
        lastUpdated: new Date().toISOString(),
        history: newHistory
      });

      // Sync with fee_balances collection
      try {
        await setDoc(doc(db, 'fee_balances', studentBalance.studentId || studentBalance.id), {
          studentId: studentBalance.studentId || studentBalance.id,
          totalAmount: newTotal,
          paidAmount: newPaid,
          balance: newTotal - newPaid,
          lastUpdated: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.error("error updating fee_balances:", e);
      }
      
      await loadFeesData();
      addToast("Transaction deleted and balance adjusted");
    } catch (error) {
      console.error("Delete history item error:", error);
      addToast("Failed to delete transaction", "error");
    }
  };

  const handleDeleteFeeBalance = async (balanceId: string) => {
    if (!isAdminView) return;
    if (!confirm("Are you sure you want to delete this entire fee balance record? All transaction history for this student will be permanently removed.")) return;
    
    try {
      await deleteDoc(doc(db, 'fees', balanceId));
      
      // Sync deletion with fee_balances collection
      try {
        await deleteDoc(doc(db, 'fee_balances', balanceId));
      } catch (e) {
        console.error("error deleting from fee_balances:", e);
      }

      await loadFeesData();
      addToast("Student fee record deleted successfully");
    } catch (error) {
      console.error("Delete fee balance error:", error);
      addToast("Failed to delete record", "error");
    }
  };

  const handlePrintFeesInvoice = (student: User, balance: FeeBalance) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Find class names for student if any
    const studentClasses = classes.filter(c => student.classIds?.includes(c.id)).map(c => c.name).join(', ') || 'N/A';
    const invoiceNumber = `INV-${new Date().getFullYear()}-${(student.admissionNumber || Math.random().toString(36).substring(2, 6).toUpperCase()).replace(/\//g, '-')}`;
    const todayStr = format(new Date(), 'MMMM dd, yyyy');
    const dueDateStr = format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'MMMM dd, yyyy'); // 14 days later

    // Get only the CHARGES (actual invoice items)
    const chargeItems = balance.history?.filter(item => item.type === 'charge') || [];

    const totalInvoiced = balance.totalAmount || 0;
    const totalPaid = balance.paidAmount || 0;
    const outstanding = balance.balance !== undefined ? balance.balance : (totalInvoiced - totalPaid);

    const html = `
      <html>
        <head>
          <title>Fees Invoice - ${student.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              padding: 25px 35px; 
              color: #1e293b; 
              line-height: 1.5; 
              background-color: #ffffff;
              font-size: 11px;
            }
            .invoice-container { 
              max-width: 800px; 
              margin: 0 auto; 
            }
            .header-flex {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }
            .school-info h1 {
              font-size: 20px;
              font-weight: 800;
              color: #1e3a8a;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: -0.01em;
            }
            .school-info p {
              font-size: 10px;
              font-weight: 500;
              color: #64748b;
              margin: 3px 0 0 0;
            }
            .doc-title {
              text-align: right;
            }
            .doc-title h2 {
              font-size: 22px;
              font-weight: 900;
              color: #0f172a;
              margin: 0;
              letter-spacing: -0.02em;
              text-transform: uppercase;
            }
            .doc-title .invoice-no {
              font-size: 12px;
              font-family: monospace;
              font-weight: bold;
              color: #1e3a8a;
              margin: 4px 0 0 0;
            }
            
            .meta-details {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
              background-color: #f8fafc;
              padding: 12px 18px;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
            }
            .meta-col {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .meta-col h3 {
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              color: #475569;
              margin: 0 0 4px 0;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
              letter-spacing: 0.05em;
            }
            .meta-col p {
              margin: 0;
              font-size: 11px;
              color: #334155;
            }
            .meta-col p strong {
              color: #0f172a;
              font-weight: 600;
            }

            .invoice-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .invoice-table th {
              background-color: #1e3a8a;
              color: #ffffff;
              padding: 8px 12px;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              text-align: left;
            }
            .invoice-table td {
              padding: 10px 12px;
              font-size: 11px;
              border-bottom: 1px solid #e2e8f0;
              color: #334155;
            }
            .invoice-table tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .amount-col {
              text-align: right;
            }

            .totals-section {
              margin-left: auto;
              width: 250px;
              margin-bottom: 30px;
              display: flex;
              flex-direction: column;
              gap: 6px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              color: #475569;
            }
            .total-row.grand-total {
              font-size: 14px;
              font-weight: 800;
              color: #0f172a;
              border-top: 2px solid #e2e8f0;
              padding-top: 6px;
              margin-top: 4px;
            }

            .stamp-section {
              margin-top: 30px;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              position: relative;
            }
            .stamp-container { 
              position: absolute; 
              right: 40px;
              bottom: 10px;
              opacity: 0.95; 
              pointer-events: none; 
              z-index: 50; 
            }
            .stamp { width: 4cm !important; height: 4cm !important; max-width: 4cm !important; max-height: 4cm !important; object-fit: contain; transform: rotate(-3deg); }

            .invoice-footer {
              text-align: center;
              font-size: 9px;
              color: #94a3b8;
              margin-top: 40px;
              font-weight: 500;
              border-top: 1px dashed #e2e8f0;
              padding-top: 15px;
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
              .no-print { display: none; }
              body { padding: 15px; background-color: #ffffff; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .stamp-container { opacity: 1 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .watermark-container { opacity: 0.14 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              tr { page-break-inside: avoid; }
              @page { size: portrait; margin: 0.4in; }
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
          <div class="invoice-container">
            <div class="header-flex">
              <div class="school-info">
                ${settings?.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" style="max-height: 60px; width: auto; margin-bottom: 8px;" />` : ''}
                <h1>${settings?.schoolName || settings?.appTitle || 'Breakthrough International Training College'}</h1>
                <p>${settings?.publicAddress || 'Main Highway, P.O. Box 1234-01000, Thika, Kenya'}</p>
                <p>TEL: ${settings?.publicPhone || '+254 7XX XXX XXX'} | EMAIL: ${settings?.publicEmail || 'info@bitc.ac.ke'}</p>
              </div>
              <div class="doc-title">
                <h2>FEES INVOICE</h2>
                <div class="invoice-no">${invoiceNumber}</div>
                <p style="margin-top: 4px;"><strong>Date:</strong> ${todayStr}</p>
                <p><strong>Due Date:</strong> ${dueDateStr}</p>
              </div>
            </div>

            <div class="meta-details">
              <div class="meta-col" style="width: 48%;">
                <h3>BILL TO (STUDENT)</h3>
                <p><strong>Name:</strong> ${student.name.toUpperCase()}</p>
                ${student.admissionNumber ? `<p><strong>Admission No:</strong> ${student.admissionNumber}</p>` : ''}
                ${student.email ? `<p><strong>Email:</strong> ${student.email}</p>` : ''}
                ${student.phone ? `<p><strong>Phone:</strong> ${student.phone}</p>` : ''}
              </div>
              <div class="meta-col" style="width: 48%;">
                <h3>ACADEMIC DETAILS</h3>
                <p><strong>Course Offered:</strong> ${student.course || 'Selected Program'}</p>
                <p><strong>Class:</strong> ${studentClasses}</p>
                ${student.guardianName ? `<p><strong>Guardian:</strong> ${student.guardianName}</p>` : ''}
                <p><strong>Account Status:</strong> <span style="font-weight: 700; color: #1e3a8a;">REGULAR STUDENT</span></p>
              </div>
            </div>

            <h3 style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin-bottom: 8px;">Detailed Charge Items</h3>
            <table class="invoice-table">
              <thead>
                <tr>
                  <th width="15%">Date</th>
                  <th width="65%">Fee Item / Description</th>
                  <th width="20%" style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${chargeItems.map(item => `
                  <tr>
                    <td>${format(new Date(item.date), 'MMM dd, yyyy')}</td>
                    <td style="font-weight: 500; color: #0f172a;">${item.description}</td>
                    <td class="amount-col" style="font-weight: 600;">Ksh ${item.amount.toLocaleString()}</td>
                  </tr>
                `).join('')}
                ${chargeItems.length === 0 ? `
                  <tr>
                    <td>${todayStr}</td>
                    <td style="font-weight: 500; color: #0f172a;">Tuition Fees Invoice (Default Record)</td>
                    <td class="amount-col" style="font-weight: 600;">Ksh ${totalInvoiced.toLocaleString()}</td>
                  </tr>
                ` : ''}
              </tbody>
            </table>

            <div class="totals-section">
              <div class="total-row">
                <span>Total Fee Invoiced:</span>
                <span style="font-weight: 600;">Ksh ${totalInvoiced.toLocaleString()}</span>
              </div>
              <div class="total-row" style="color: #10b981;">
                <span>Total Paid to Date:</span>
                <span style="font-weight: 600;">- Ksh ${totalPaid.toLocaleString()}</span>
              </div>
              <div class="total-row grand-total">
                <span>Outstanding Balance:</span>
                <span>Ksh ${outstanding.toLocaleString()}</span>
              </div>
            </div>

            <div class="stamp-section">
              <div>
                <p style="font-size: 12px; margin: 0; font-weight: 600; color: #475569;">Issued By: Finance Office Registrar</p>
                <div style="border-bottom: 1px dashed #cbd5e1; width: 220px; height: 40px;"></div>
                <p style="font-size: 10px; margin-top: 6px; color: #94a3b8;">Breakthrough International Training College</p>
              </div>

              <div class="stamp-container">
                ${settings?.stampUrl 
                  ? `<img src="${settings.stampUrl}" class="stamp" alt="Official Stamp" />` 
                  : `<img src="${window.location.host.includes('localhost') ? '/stamp.png' : window.location.origin + '/stamp.png'}" class="stamp" alt="Official Stamp" />`
                }
              </div>
            </div>

            <div class="invoice-footer" style="margin-top: 30px; text-align: left; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px;">
              <p style="margin: 0 0 6px 0; font-weight: bold; color: #1e3a8a; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;">Payment Instructions (Bank Deposit):</p>
              <p style="margin: 0; font-size: 10px; color: #334155; line-height: 1.4;">
                <strong>Bank Account Name:</strong> BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE<br />
                <strong>Account Number (A/C. No.):</strong> 032000025240<br />
                <strong>Branch:</strong> Thika Makongeni<br />
                <em>Note: Always write the student's full name and Admission Number as the reference on the deposit slip.</em>
              </p>
            </div>

            <div class="invoice-footer">
              <p>Please note that all fee payments are governed by the college financial blueprint guidelines. Always retain official printed invoices & receipts for verification.</p>
              <p style="margin-top: 8px; font-weight: bold; color: #1e3a8a;">Breakthrough International Training College • Registrar Finances Portal</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintStudentStatement = (student: User, balance: FeeBalance) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const actualBalance = typeof balance.balance === 'number' ? balance.balance : ((balance.totalAmount || 0) - (balance.paidAmount || 0));

    // Sort history chronologically (oldest to newest) to calculate running balance correctly
    const sortedHistory = [...(balance.history || [])].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let currentTermBalance = 0;
    const ledger = sortedHistory.map(item => {
      const amt = Number(item.amount) || 0;
      if (item.type === 'payment') {
        currentTermBalance -= amt;
      } else {
        currentTermBalance += amt;
      }
      return {
        ...item,
        running: currentTermBalance
      };
    }).reverse(); // Reverse for display (newest first)

    // Find class names for student if any
    const studentClasses = classes.filter(c => student.classIds?.includes(c.id)).map(c => c.name).join(', ') || 'N/A';

    const html = `
      <html>
        <head>
          <title>Fee Statement - ${student.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              padding: 20px 30px; 
              color: #1e293b; 
              line-height: 1.4; 
              background-color: #ffffff;
              font-size: 11px;
            }
            .statement-container { 
              max-width: 800px; 
              margin: 0 auto; 
            }
            .header-flex {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 12px;
              margin-bottom: 15px;
            }
            .school-info h1 {
              font-size: 20px;
              font-weight: 800;
              color: #1e3a8a;
              margin: 0;
              letter-spacing: -0.02em;
            }
            .school-info p {
              font-size: 10px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.12em;
              margin: 2px 0 0 0;
            }
            .doc-title {
              text-align: right;
            }
            .doc-title h2 {
              font-size: 16px;
              font-weight: 900;
              color: #0f172a;
              margin: 0;
              letter-spacing: -0.01em;
              text-transform: uppercase;
            }
            .doc-title p {
              font-size: 10px;
              color: #64748b;
              margin: 2px 0 0 0;
            }
            .profile-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-bottom: 15px;
              background: #f8fafc;
              padding: 12px 16px;
              border-radius: 12px;
              border: 1px solid #f1f5f9;
            }
            .profile-block h3 {
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.05em;
              margin: 0 0 6px 0;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
            }
            .profile-block p {
              margin: 2px 0;
              font-size: 11px;
              color: #334155;
            }
            .profile-block p strong {
              color: #0f172a;
              font-weight: 600;
            }
            .summary-cards {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              margin-bottom: 15px;
            }
            .summary-card {
              padding: 10px 14px;
              border-radius: 10px;
              border: 1px solid #e2e8f0;
              background-color: #ffffff;
            }
            .summary-card.accent-due {
              background-color: #fffafb;
              border-color: #fee2e2;
            }
            .summary-card.accent-credit {
              background-color: #f0fdf4;
              border-color: #dcfce7;
            }
            .card-label {
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
              color: #64748b;
              letter-spacing: 0.05em;
              margin-bottom: 4px;
            }
            .summary-card.accent-due .card-label {
              color: #ef4444;
            }
            .summary-card.accent-credit .card-label {
              color: #10b981;
            }
            .card-value {
              font-size: 15px;
              font-weight: 800;
              color: #0f172a;
            }
            .summary-card.accent-due .card-value {
              color: #991b1b;
            }
            .summary-card.accent-credit .card-value {
              color: #065f46;
            }
            .card-status {
              font-size: 9px;
              font-weight: 700;
              margin-top: 2px;
              display: inline-block;
            }
            h3.section-title {
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.05em;
              margin: 15px 0 8px 0;
            }
            .ledger-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            .ledger-table th {
              background-color: #f1f5f9;
              padding: 6px 10px;
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.05em;
              border-bottom: 2px solid #e2e8f0;
              text-align: left;
            }
            .ledger-table td {
              padding: 6px 10px;
              font-size: 11px;
              border-bottom: 1px solid #f1f5f9;
              color: #334155;
            }
            .ledger-table tr:hover {
              background-color: #f8fafc;
            }
            .badge {
              display: inline-flex;
              align-items: center;
              padding: 1px 6px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .badge-charge {
               background-color: #fef2f2;
               color: #ef4444;
            }
            .badge-payment {
               background-color: #f0fdf4;
               color: #16a34a;
            }
            .amount-col {
              text-align: right;
              font-weight: 600;
            }
            .amount-charge {
              color: #b91c1c;
            }
            .amount-payment {
              color: #15803d;
            }
            .stamp-section {
              margin-top: 15px;
              border-top: 1px solid #e2e8f0;
              padding-top: 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              position: relative;
            }
            .stamp-container { 
              position: absolute; 
              right: 40px;
              bottom: 10px;
              opacity: 0.85; 
              pointer-events: none; 
              z-index: 50; 
            }
            .stamp { width: 4cm !important; height: 4cm !important; max-width: 4cm !important; max-height: 4cm !important; object-fit: contain; transform: rotate(-5deg); }
            .statement-footer {
              text-align: center;
              font-size: 9px;
              color: #94a3b8;
              margin-top: 20px;
              font-weight: 500;
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
              .no-print { display: none; }
              body { padding: 10px 15px; background-color: #ffffff; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .stamp-container { opacity: 1 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .watermark-container { opacity: 0.14 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              tr { page-break-inside: avoid; }
              h3, h2, h1 { page-break-after: avoid; }
              @page { size: portrait; margin: 0.4in; }
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
          <div class="statement-container">
            <div class="header-flex">
              <div class="school-info">
                ${settings?.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" style="max-height: 55px; width: auto; margin-bottom: 8px;" />` : ''}
                <h1>${settings?.appTitle || 'BITC School'}</h1>
                <p>Official School Statement of Account</p>
              </div>
              <div class="doc-title">
                <h2>Statement of Account</h2>
                <p>Generated on ${format(new Date(), 'MMMM dd, yyyy')}</p>
              </div>
            </div>

            <div class="profile-grid">
              <div class="profile-block">
                <h3>Student Information</h3>
                <p><strong>Name:</strong> ${student.name}</p>
                <p><strong>Email:</strong> ${student.email}</p>
                ${student.admissionNumber ? `<p><strong>Admission No:</strong> ${student.admissionNumber}</p>` : ''}
                ${student.phone ? `<p><strong>Phone:</strong> ${student.phone}</p>` : ''}
              </div>
              <div class="profile-block">
                <h3>Academic & Billing Details</h3>
                <p><strong>Enrolled Class:</strong> ${studentClasses}</p>
                ${student.guardianName ? `<p><strong>Parent/Guardian:</strong> ${student.guardianName}</p>` : ''}
                ${student.guardianPhone ? `<p><strong>Guardian Phone:</strong> ${student.guardianPhone}</p>` : ''}
                <p><strong>Status:</strong> <span style="font-weight:bold; color:#2563EB;">Active Member</span></p>
              </div>
            </div>

            <div class="summary-cards">
              <div class="summary-card">
                <div class="card-label">Total Invoiced (Fees)</div>
                <div class="card-value">Ksh ${balance.totalAmount.toLocaleString()}</div>
              </div>
              <div class="summary-card" style="border-left: 3px solid #10b981;">
                <div class="card-label" style="color:#10b981;">Total Paid</div>
                <div class="card-value" style="color:#065f46;">Ksh ${balance.paidAmount.toLocaleString()}</div>
              </div>
              <div class="summary-card ${actualBalance > 0 ? 'accent-due' : 'accent-credit'}" style="border-left: 3px solid ${actualBalance > 0 ? '#ef4444' : '#10b981'};">
                <div class="card-label">${actualBalance > 0 ? 'Outstanding Balance' : 'Prepaid Credit Status'}</div>
                <div class="card-value">
                  Ksh ${Math.abs(actualBalance).toLocaleString()}
                </div>
                <div class="card-status" style="color: ${actualBalance > 0 ? '#b91c1c' : '#047857'};">
                  ${actualBalance > 0 ? '⚠️ Payment Outstanding' : '🎉 Account Fully Paid / Credit Held'}
                </div>
              </div>
            </div>

            <h3 class="section-title">Detailed Ledger Transactions</h3>
            <table class="ledger-table">
              <thead>
                <tr>
                  <th width="15%">Date</th>
                  <th width="14%">Type</th>
                  <th width="41%">Description</th>
                  <th width="15%" style="text-align: right;">Amount</th>
                  <th width="15%" style="text-align: right;">Running Bal.</th>
                </tr>
              </thead>
              <tbody>
                ${ledger.map(item => `
                  <tr>
                    <td>${format(new Date(item.date), 'MMM dd, yyyy')}</td>
                    <td>
                      <span class="badge ${item.type === 'charge' ? 'badge-charge' : 'badge-payment'}">
                        ${item.type}
                      </span>
                    </td>
                    <td style="font-weight: 500; color: #0f172a;">${item.description}</td>
                    <td class="amount-col ${item.type === 'charge' ? 'amount-charge' : 'amount-payment'}">
                      ${item.type === 'payment' ? '-' : '+'}Ksh ${item.amount.toLocaleString()}
                    </td>
                    <td class="amount-col" style="color: ${item.running > 0 ? '#b91c1c' : '#15803d'};">
                      Ksh ${item.running.toLocaleString()}
                    </td>
                  </tr>
                `).join('')}
                ${ledger.length === 0 ? `
                  <tr>
                    <td colspan="5" style="text-align: center; color: #94a3b8; padding: 30px; font-style: italic;">
                      No transactional ledger entries found.
                    </td>
                  </tr>
                ` : ''}
              </tbody>
            </table>

            <div class="stamp-section">
              <div>
                <p style="font-size: 12px; margin: 0; font-weight: 600; color: #475569;">Authorized Signature / Finance Office</p>
                <div style="border-bottom: 1px dashed #cbd5e1; width: 220px; height: 40px;"></div>
                <p style="font-size: 11px; margin-top: 6px; color: #94a3b8;">Printed on standard physical register on ${format(new Date(), 'yyyy-MM-dd HH:mm')}</p>
              </div>

              <div class="stamp-container">
                ${settings?.stampUrl 
                  ? `<img src="${settings.stampUrl}" class="stamp" alt="Official Stamp" />` 
                  : `<img src="${window.location.host.includes('localhost') ? '/stamp.png' : window.location.origin + '/stamp.png'}" class="stamp" alt="Official Stamp" />`
                }
              </div>
            </div>

            <div class="statement-footer">
              <p>Thank you for keeping your account up to date. This statement provides an official record of tuition invoices and payments received.</p>
              <p style="margin-top: 8px;">Breakthrough International • Smart Learning Management Console</p>
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

  const handlePrintFeeStructure = (targetClassId: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast("Failed to open print window. Please allow popups.", "error");
      return;
    }

    const cls = classes.find(c => String(c.id) === String(targetClassId));
    const className = cls ? cls.name : 'All Academic Programs';
    const todayStr = format(new Date(), 'MMMM dd, yyyy');

    const filteredFees = classFees.filter(fee => 
      targetClassId === 'all' || String(fee.classId) === String(targetClassId) || String(fee.classId) === 'all'
    );

    const totalAmount = filteredFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);

    const html = `
      <html>
        <head>
          <title>Official Fees Structure - ${className}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              padding: 35px; 
              color: #1e293b; 
              line-height: 1.45; 
              background-color: #ffffff;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-b: 2px solid #e2e8f0;
              padding-bottom: 12px;
              margin-bottom: 22px;
            }
            .college-title {
              font-size: 21px;
              font-weight: 800;
              color: #1e3a8a;
              text-transform: uppercase;
              letter-spacing: -0.5px;
            }
            .college-subtitle {
              font-size: 11px;
              color: #64748b;
              font-weight: 600;
              text-transform: uppercase;
              margin-top: 3px;
            }
            .document-title {
              font-size: 17px;
              font-weight: 700;
              color: #0f172a;
              text-align: right;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-bottom: 20px;
            }
            .meta-item {
              font-size: 13px;
              color: #475569;
            }
            .meta-value {
              font-weight: 700;
              color: #0f172a;
            }
            .fees-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .fees-table th {
              background-color: #f8fafc;
              border-bottom: 2px solid #e2e8f0;
              padding: 10px 14px;
              font-size: 10.5px;
              font-weight: 700;
              color: #475569;
              text-transform: uppercase;
              text-align: left;
            }
            .fees-table td {
              padding: 9px 14px;
              border-bottom: 1px solid #f1f5f9;
              font-size: 12.5px;
              color: #334155;
            }
            .fees-table tr:hover {
              background-color: #f8fafc;
            }
            .total-box {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px 18px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 25px;
            }
            .total-label {
              font-size: 13px;
              font-weight: 700;
              color: #0f172a;
            }
            .total-value {
              font-size: 18px;
              font-weight: 800;
              color: #1e3a8a;
            }
            .badge {
              display: inline-block;
              font-size: 9.5px;
              font-weight: 700;
              padding: 2.5px 7px;
              border-radius: 12px;
              text-transform: uppercase;
            }
            .badge-monthly { background-color: #ecfdf5; color: #059669; }
            .badge-semester { background-color: #eff6ff; color: #2563eb; }
            .badge-yearly { background-color: #fffbeb; color: #d97706; }
            .stamp-section {
              margin-top: 30px;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              position: relative;
            }
            .stamp-container { 
              position: absolute; 
              right: 40px;
              bottom: 10px;
              opacity: 0.85; 
              pointer-events: none; 
              z-index: 50; 
            }
            .stamp { width: 3.4cm !important; height: 3.4cm !important; max-width: 3.4cm !important; max-height: 3.4cm !important; object-fit: contain; transform: rotate(-5deg); }
            .footer {
              border-top: 1px solid #e2e8f0;
              padding-top: 12px;
              font-size: 10.5px;
              color: #64748b;
              text-align: center;
              line-height: 1.45;
              margin-top: 25px;
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
              body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              button { display: none; }
              .stamp-container { opacity: 1 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
          <div class="header-container">
            <div style="display: flex; gap: 14px; align-items: center;">
              ${settings?.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" style="max-height: 52px; width: auto;" />` : ''}
              <div>
                <div class="college-title">${(settings?.schoolName || 'Breakthrough International Training College (BITC)').toUpperCase()}</div>
                <div class="college-subtitle">Pioneering Excellence in Professional & Healthcare Education</div>
              </div>
            </div>
            <div>
              <div class="document-title">OFFICIAL FEES STRUCTURE</div>
              <div style="font-size: 11px; color: #64748b; text-align: right; margin-top: 2px;">Issued on ${todayStr}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <div>Course/Program: <span class="meta-value">${className}</span></div>
              <div style="margin-top: 2px;">Structure Status: <span class="meta-value" style="color: #059669;">Approved & Active</span></div>
            </div>
            <div class="meta-item" style="text-align: right;">
              <div>Reference Code: <span class="meta-value">FST-${targetClassId.substring(0, 6).toUpperCase()}</span></div>
              <div style="margin-top: 2px;">Billing System: <span class="meta-value">Institutional Blueprint Standard</span></div>
            </div>
          </div>

          <table class="fees-table">
            <thead>
              <tr>
                <th width="40%">Fee Package / Title</th>
                <th width="20%">Fee Type</th>
                <th width="20%">Billing Cycle</th>
                <th width="20%" style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${filteredFees.map(fee => `
                <tr>
                  <td style="font-weight: 600; color: #0f172a;">${fee.title}</td>
                  <td><span style="font-size: 10px; color: #475569; text-transform: uppercase;">${fee.feeType || 'Tuition'}</span></td>
                  <td>
                    <span class="badge badge-${fee.period || 'monthly'}">
                      ${fee.period || 'monthly'}
                    </span>
                  </td>
                  <td style="font-weight: 700; text-align: right; color: #0f172a;">Ksh ${(fee.amount || 0).toLocaleString()}</td>
                </tr>
              `).join('')}
              ${filteredFees.length === 0 ? `
                <tr>
                  <td colspan="4" style="text-align: center; color: #64748b; font-style: italic; padding: 20px;">
                    No fee packages defined for this class.
                  </td>
                </tr>
              ` : ''}
            </tbody>
          </table>

          ${filteredFees.length > 0 ? `
            <div class="total-box">
              <span class="total-label">Total Cumulative Base Fees</span>
              <span class="total-value">Ksh ${totalAmount.toLocaleString()}</span>
            </div>
          ` : ''}

          <div style="margin-bottom: 25px;">
            <h4 style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 8px;">General Financial Policies</h4>
            <ul style="font-size: 11px; color: #475569; padding-left: 18px; line-height: 1.6; margin: 0;">
              <li><strong>Payment Modes:</strong> All fees are payable directly to the official college bank account:
                <div style="margin: 6px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 14px; border-radius: 6px; font-size: 11px; color: #1e293b; max-width: 600px; line-height: 1.45; display: block; font-weight: 500;">
                  <strong>A/C Name:</strong> BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE &bull; 
                  <strong>A/C. No.:</strong> 032000025240 &bull; 
                  <strong>Branch:</strong> Thika Makongeni
                </div>
                <span style="display: block; margin-top: 4px; font-weight: 600; color: #b91c1c;">Please Note: Cash payments are strictly prohibited on campus.</span>
              </li>
              <li style="margin-top: 4px;"><strong>Installment Plans:</strong> Students may request monthly installment agreements at the finance registry.</li>
              <li style="margin-top: 4px;"><strong>Access:</strong> Tuition fee clearing is required before proceeding to end-of-semester clinical attachments.</li>
            </ul>
          </div>

          <div class="stamp-section" style="margin-bottom: 20px;">
            <div>
              <p style="font-size: 12px; margin: 0; font-weight: 600; color: #475569;">Authorized Signature / Finance Office</p>
              <div style="border-bottom: 1px dashed #cbd5e1; width: 200px; height: 35px;"></div>
              <p style="font-size: 9.5px; margin-top: 6px; color: #94a3b8;">Printed on standard physical register on ${format(new Date(), 'yyyy-MM-dd HH:mm')}</p>
            </div>

            <div class="stamp-container">
              ${settings?.stampUrl 
                ? `<img src="${settings.stampUrl}" class="stamp" alt="Official Stamp" />` 
                : `<img src="${window.location.host.includes('localhost') ? '/stamp.png' : window.location.origin + '/stamp.png'}" class="stamp" alt="Official Stamp" />`
              }
            </div>
          </div>

          <div class="footer">
            <p style="margin: 0;">This is an official document of the ${settings?.schoolName || 'Breakthrough International Training College (BITC)'} Finance Office.</p>
            <p style="margin: 2px 0 0 0;">&copy; ${new Date().getFullYear()} ${settings?.schoolName || 'Breakthrough International Training College (BITC)'}. All Rights Reserved.</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintOutstandingBalances = (studentsToPrint: User[], filterType: 'all' | 'outstanding' | 'overpaid' | 'suspended') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast("Failed to open print window. Please allow popups.", "error");
      return;
    }

    const titleText = filterType === 'outstanding' 
      ? 'Outstanding Fee Balances Report' 
      : filterType === 'overpaid' 
        ? 'Prepaid Credits Report' 
        : filterType === 'suspended'
          ? 'Suspended Fee Billing Report (Absentees)'
          : 'Student Fee Balances Summary';

    // Calculate sum totals
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let totalCredits = 0;

    const tableRows = studentsToPrint.map(student => {
      const balanceObj = feeBalances.find(b => b.studentId === student.uid);
      const total = balanceObj?.totalAmount ?? 0;
      const paid = balanceObj?.paidAmount ?? 0;
      const bal = balanceObj?.balance ?? 0;

      totalInvoiced += total;
      totalPaid += paid;
      if (bal > 0) totalOutstanding += bal;
      if (bal < 0) totalCredits += Math.abs(bal);

      const enrolledClasses = classes.filter(c => student.classIds?.includes(c.id)).map(c => c.name).join(', ') || 'N/A';
      
      let balStyle = '';
      let balText = 'Cleared';
      if (bal > 0) {
        balStyle = 'color: #b91c1c; font-weight: 700;';
        balText = `Ksh ${bal.toLocaleString()}`;
      } else if (bal < 0) {
        balStyle = 'color: #15803d; font-weight: 700;';
        balText = `-Ksh ${Math.abs(bal).toLocaleString()} (Cr)`;
      } else {
        balStyle = 'color: #64748b;';
      }

      return `
        <tr>
          <td>
            <strong style="color: #0f172a; font-size: 13px;">${student.name}</strong><br/>
            <span style="font-size: 11px; color: #64748b;">${student.email}</span>
          </td>
          <td style="font-size: 12px; font-weight: 500;">${student.admissionNumber || 'N/A'}</td>
          <td style="font-size: 12px; color: #475569;">${enrolledClasses}</td>
          <td style="text-align: right; font-size: 12px;">Ksh ${total.toLocaleString()}</td>
          <td style="text-align: right; font-size: 12px; color: #16a34a; font-weight: 500;">Ksh ${paid.toLocaleString()}</td>
          <td style="text-align: right; font-size: 12px; ${balStyle}">${balText}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>${titleText}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              padding: 40px; 
              color: #1e293b; 
              line-height: 1.5; 
              background-color: #ffffff;
            }
            .report-container { 
              max-width: 900px; 
              margin: 0 auto; 
            }
            .header-flex {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 25px;
            }
            .school-info h1 {
              font-size: 24px;
              font-weight: 800;
              color: #1e3a8a;
              margin: 0;
            }
            .school-info p {
              font-size: 10px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              margin: 4px 0 0 0;
            }
            .doc-title {
              text-align: right;
            }
            .doc-title h2 {
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
              margin: 0;
              text-transform: uppercase;
            }
            .doc-title p {
              font-size: 12px;
              color: #64748b;
              margin: 4px 0 0 0;
            }
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 30px;
            }
            .metric-card {
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 12px;
              background-color: #f8fafc;
            }
            .metric-label {
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
              color: #64748b;
              margin-bottom: 4px;
            }
            .metric-value {
              font-size: 16px;
              font-weight: 800;
              color: #0f172a;
            }
            .balances-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .balances-table th {
              background-color: #f1f5f9;
              padding: 10px 12px;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              color: #475569;
              border-bottom: 2px solid #e2e8f0;
              text-align: left;
            }
            .balances-table td {
              padding: 10px 12px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 12px;
            }
            .balances-table tr:hover {
              background-color: #f8fafc;
            }
            .stamp-section {
              margin-top: 40px;
              border-top: 1px dashed #e2e8f0;
              padding-top: 24px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              position: relative;
            }
            .stamp-container { 
              position: absolute; 
              right: 20px;
              bottom: 10px;
              opacity: 0.85; 
            }
            .stamp { width: 4cm !important; height: 4cm !important; max-width: 4cm !important; max-height: 4cm !important; object-fit: contain; transform: rotate(-5deg); }
            .report-footer {
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
              margin-top: 50px;
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
              body { padding: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .no-print { display: none; }
              .stamp-container { opacity: 1 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
          <div class="report-container">
            <div class="header-flex">
              <div class="school-info">
                ${settings?.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" style="max-height: 50px; width: auto; margin-bottom: 6px;" />` : ''}
                <h1>${settings?.appTitle || 'BITC School'}</h1>
                <p>Official School Audit / Financial Office</p>
              </div>
              <div class="doc-title">
                <h2>${titleText}</h2>
                <p>Generated on ${format(new Date(), 'MMMM dd, yyyy')}</p>
              </div>
            </div>

            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Invoiced Tuition</div>
                <div class="metric-value">Ksh ${totalInvoiced.toLocaleString()}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label" style="color: #10b981;">Total Collected</div>
                <div class="metric-value" style="color: #047857;">Ksh ${totalPaid.toLocaleString()}</div>
              </div>
              <div class="metric-card" style="border-left: 3px solid #f43f5e;">
                <div class="metric-label" style="color: #f43f5e;">Total Outstanding</div>
                <div class="metric-value" style="color: #be123c;">Ksh ${totalOutstanding.toLocaleString()}</div>
              </div>
              <div class="metric-card" style="border-left: 3px solid #10b981;">
                <div class="metric-label" style="color: #059669;">Prepaid Credits</div>
                <div class="metric-value" style="color: #047857;">Ksh ${totalCredits.toLocaleString()}</div>
              </div>
            </div>

            <h3 style="font-size: 13px; font-weight: 700; margin-bottom: 12px; color: #334155; text-transform: uppercase; border-left: 3px solid #1e3a8a; padding-left: 8px;">Students Ledger Summary</h3>
            <table class="balances-table">
              <thead>
                <tr>
                  <th width="30%">Student</th>
                  <th width="15%">Admission No.</th>
                  <th width="20%">Class</th>
                  <th width="12%" style="text-align: right;">Total Fee</th>
                  <th width="12%" style="text-align: right;">Total Paid</th>
                  <th width="11%" style="text-align: right;">Net Balance</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
                ${studentsToPrint.length === 0 ? `
                  <tr>
                    <td colspan="6" style="text-align: center; color: #94a3b8; padding: 30px; font-style: italic;">
                      No student records found matching the current query.
                    </td>
                  </tr>
                ` : ''}
              </tbody>
            </table>

            <div class="stamp-section">
              <div>
                <p style="font-size: 11px; margin: 0; font-weight: 600; color: #475569;">Finance Office Authorized Signoff</p>
                <div style="border-bottom: 1px dashed #cbd5e1; width: 220px; height: 35px;"></div>
                <p style="font-size: 10px; margin-top: 4px; color: #94a3b8;">Printed: ${format(new Date(), 'yyyy-MM-dd HH:mm')}</p>
              </div>

              <div class="stamp-container">
                ${settings?.stampUrl 
                  ? `<img src="${settings.stampUrl}" class="stamp" alt="Official Stamp" />` 
                  : `<img src="${window.location.host.includes('localhost') ? '/stamp.png' : window.location.origin + '/stamp.png'}" class="stamp" alt="Official Stamp" />`
                }
              </div>
            </div>

            <div class="report-footer">
              <p>Breakthrough International Smart Finance Ledger Tool • Automated Print Spooler</p>
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

  const handlePrintReceipt = (student: User, payment: { amount: number, date: string, description: string }, balance: { total: number, paid: number, remaining: number }) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Fee Receipt - ${student.name}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #333; line-height: 1.4; font-size: 12px; }
            .receipt-container { max-width: 500px; margin: 0 auto; border: 1px solid #eee; padding: 15px; border-radius: 10px; }
            .header { text-align: center; border-bottom: 2px solid #2563EB; padding-bottom: 10px; margin-bottom: 15px; }
            .header h1 { font-size: 18px; color: #2563EB; margin: 0; }
            .header p { color: #6b7280; font-size: 11px; margin: 3px 0 0 0; }
            .receipt-info { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 11px; }
            .student-details { margin-bottom: 15px; }
            .student-details h3 { font-size: 12px; margin-bottom: 4px; color: #111827; }
            .student-details p { margin: 2px 0; color: #4b5563; font-size: 11px; }
            .payment-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .payment-table th { text-align: left; background: #f9fafb; padding: 6px; font-size: 10px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
            .payment-table td { padding: 6px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
            .summary { margin-left: auto; max-width: 200px; }
            .summary-item { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
            .summary-item.total { border-top: 2px solid #eee; margin-top: 6px; padding-top: 6px; font-weight: bold; color: #111827; }
            .footer { margin-top: 25px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #eee; padding-top: 10px; position: relative; }
            .stamp-container { 
              position: absolute; 
              bottom: 2px; 
              ${settings?.stampPosition === 'left' ? 'left: 10px;' : settings?.stampPosition === 'center' ? 'left: 50%; transform: translateX(-50%);' : 'right: 10px;'}
              opacity: 0.85; 
              pointer-events: none; 
              z-index: 5; 
            }
            .stamp { width: 5.0cm !important; height: 5.0cm !important; max-width: 5.0cm !important; max-height: 5.0cm !important; object-fit: contain; transform: rotate(-8deg); mix-blend-mode: multiply; }
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
              width: 10cm;
              height: 10cm;
              max-width: 10cm;
              max-height: 10cm;
              object-fit: contain;
              filter: grayscale(100%);
            }
            .watermark-text {
              font-size: 30pt;
              font-weight: 900;
              font-family: 'Inter', sans-serif;
              color: #1e3a8a;
              transform: rotate(-30deg);
              text-align: center;
              white-space: nowrap;
              letter-spacing: 4px;
            }

            @media print {
              .no-print { display: none; }
              body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .receipt-container { border: none; }
              .stamp-container { opacity: 1 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .watermark-container { opacity: 0.14 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              @page { size: portrait; margin: 0.4in; }
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
          <div class="receipt-container">
            <div class="header">
              ${settings?.logoUrl ? `<img src="${settings.logoUrl}" alt="School Logo" style="max-height: 80px; width: auto; margin-bottom: 10px;" />` : ''}
              <h1 style="font-size: 16px; font-weight: 800; text-transform: uppercase;">${settings?.schoolName || 'Breakthrough International Training College'}</h1>
              <p style="font-weight: bold; color: #2563EB; margin-top: 5px;">SCHOOL FINANCE RECEIPT</p>
              <p>Official Payment Confirmation</p>
            </div>
            <div class="receipt-info">
              <div>
                <strong>Receipt No:</strong> #${Math.floor(100000 + Math.random() * 900000)}
              </div>
              <div>
                <strong>Date:</strong> ${format(new Date(payment.date), 'MMM dd, yyyy HH:mm')}
              </div>
            </div>
            <div class="student-details">
              <h3>Student Details</h3>
              <p><strong>Name:</strong> ${student.name}</p>
              <p><strong>Email:</strong> ${student.email}</p>
              ${student.admissionNumber ? `<p><strong>Admission No:</strong> ${student.admissionNumber}</p>` : ''}
            </div>
            <table class="payment-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${payment.description}</td>
                  <td style="text-align: right;">Ksh ${payment.amount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            <div class="summary">
              <div class="summary-item">
                <span>Account Balance:</span>
                <span>Ksh ${balance.remaining.toLocaleString()}</span>
              </div>
              <div class="summary-item total">
                <span>Paid Amount:</span>
                <span>Ksh ${payment.amount.toLocaleString()}</span>
              </div>
            </div>

            <div style="margin-top: 25px; border-top: 1px solid #eee; padding-top: 15px; display: flex; gap: 20px; justify-content: space-between; align-items: flex-end; position: relative;">
              <!-- Left Column: Bank Details & Terms -->
              <div style="flex: 1; min-width: 0; text-align: left; z-index: 10;">
                <div style="border: 1px dashed #cbd5e1; padding: 10px; border-radius: 8px; background-color: #f8fafc; margin-bottom: 15px; position: relative; z-index: 20;">
                  <p style="margin: 0 0 4px 0; font-size: 10px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.05em;">Official Institution Bank Details:</p>
                  <p style="margin: 0; font-size: 10px; color: #475569; line-height: 1.45;">
                    <strong>Bank A/C Name:</strong> BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE<br />
                    <strong>Account Number (A/C. No.):</strong> 032000025240 &bull; <strong>Branch:</strong> Thika Makongeni
                  </p>
                </div>
                
                <div style="font-size: 10px; color: #9ca3af; line-height: 1.45;">
                  <p style="margin: 0 0 4px 0;">Thank you for your payment.</p>
                  <p style="margin: 0 0 4px 0;">This is a computer generated receipt and does not require a physical signature.</p>
                  <p style="margin: 0; font-weight: bold;">(c) ${new Date().getFullYear()} ${settings?.schoolName || 'Breakthrough International Training College'}</p>
                </div>
              </div>

              <!-- Right Column: Dedicated 5cm Stamp Area -->
              <div style="width: 5.0cm; height: 5.0cm; position: relative; flex-shrink: 0; display: flex; align-items: flex-end; justify-content: flex-end;">
                <div class="stamp-container" style="position: absolute; bottom: 0; right: 0;">
                  ${settings?.stampUrl 
                    ? `<img src="${settings.stampUrl}" class="stamp" alt="Official Stamp" style="width: 5.0cm !important; height: 5.0cm !important; max-width: 5.0cm !important; max-height: 5.0cm !important;" />` 
                    : `<img src="${window.location.host.includes('localhost') ? '/stamp.png' : window.location.origin + '/stamp.png'}" class="stamp" alt="Official Stamp" style="width: 5.0cm !important; height: 5.0cm !important; max-width: 5.0cm !important; max-height: 5.0cm !important;" />`
                  }
                </div>
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

  const handlePrintReport = (stats: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Financial Report - BITC</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #374151; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #2563EB; padding-bottom: 20px; }
            .header img { max-height: 80px; margin-bottom: 15px; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 700; color: #2563EB; }
            .header p { margin: 5px 0 0; color: #6b7280; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; }
            
            .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
            .stat-card { border: 1px solid #e5e7eb; padding: 20px; border-radius: 12px; }
            .stat-label { font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; margin-bottom: 5px; }
            .stat-value { font-size: 20px; font-weight: 700; color: #111827; }
            
            h2 { font-size: 14px; font-weight: 900; text-transform: uppercase; color: #2563EB; border-left: 4px solid #2563EB; padding-left: 10px; margin: 30px 0 15px; }
            
            .page-break { page-break-before: always; border-top: 2px dashed #eee; padding-top: 40px; margin-top: 40px; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #f3f4f6; }
            th { text-align: left; background: #f9fafb; padding: 12px; font-size: 11px; font-weight: 800; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb; }
            td { padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
            
            .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #eee; padding-top: 20px; }
            
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
              body { padding: 20px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .no-print { display: none; }
              .watermark-container { opacity: 0.14 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              @page { margin: 0; }
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
            ${settings?.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" />` : ''}
            <h1>BREAKTHROUGH INTERNATIONAL</h1>
            <p>Financial Summary Report - ${format(new Date(), 'MMMM yyyy')}</p>
          </div>
          
        <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Money Paid (This Month)</div>
              <div class="stat-value" style="color: #059669;">Ksh ${stats.monthCollected.toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">On-Time Paid (Days 1-5)</div>
              <div class="stat-value" style="color: #0d9488;">Ksh ${stats.monthCollectedOnTime.toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Money Over Paid (Prepaid)</div>
              <div class="stat-value" style="color: #0284c7;">Ksh ${stats.totalPrepaidCredits.toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Money Not Paid (Outstanding)</div>
              <div class="stat-value" style="color: #dc2626;">Ksh ${stats.totalOutstandingDue.toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Expenses (This Month)</div>
              <div class="stat-value" style="color: #e11d48;">Ksh ${stats.monthExpenses.toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Net Balance (Monthly)</div>
              <div class="stat-value" style="color: ${(stats.monthCollected - stats.monthExpenses) >= 0 ? '#059669' : '#dc2626'};">Ksh ${(stats.monthCollected - stats.monthExpenses).toLocaleString()}</div>
            </div>
          </div>
          
          <h2>Class Monthly Financial Summary (${format(new Date(), 'MMMM yyyy')})</h2>
          <table>
            <thead>
              <tr>
                <th>Class Name</th>
                <th style="text-align: center;">Students</th>
                <th>Est. Monthly Rate/Std</th>
                <th>Expected Revenue (Month)</th>
                <th>Invoiced (This Month)</th>
                <th>Paid (This Month)</th>
                <th style="color: #dc2626;">Balance Left (This Month)</th>
              </tr>
            </thead>
            <tbody>
              ${stats.classBreakdown.map((cls: any) => {
                const classUnits = units.filter(s => s.classId === cls.id).map(s => s.name).join(', ');
                const monthlyBal = cls.monthCharged - cls.monthCollected;
                return `
                <tr>
                  <td>
                    <strong>${cls.name}</strong>
                    ${classUnits ? `<div style="font-size: 9px; color: #6b7280; font-weight: normal; margin-top: 2px;">Units: ${classUnits}</div>` : ''}
                  </td>
                  <td style="text-align: center;">${cls.count}</td>
                  <td>Ksh ${cls.monthlyRate.toLocaleString()}</td>
                  <td style="font-weight: bold; color: #2563EB;">Ksh ${cls.projected.toLocaleString()}</td>
                  <td>Ksh ${cls.monthCharged.toLocaleString()}</td>
                  <td style="color: #059669; font-weight: bold;">Ksh ${cls.monthCollected.toLocaleString()}</td>
                  <td style="color: ${monthlyBal > 0 ? '#dc2626' : '#059669'}; font-weight: 700;">Ksh ${monthlyBal.toLocaleString()}</td>
                </tr>
              `;}).join('')}
            </tbody>
          </table>

          ${stats.classBreakdown.filter((c: any) => c.count > 0).map((cls: any) => `
            <div class="page-break">
              <h2>${cls.name} - Monthly Fee Balance List</h2>
              <div style="margin-bottom: 15px; display: flex; gap: 20px;">
                <div style="font-size: 11px; font-weight: bold; color: #6b7280;">Total Students: <span style="color: #111827;">${cls.count}</span></div>
                <div style="font-size: 11px; font-weight: bold; color: #6b7280;">Month's Bal Left: <span style="color: ${(cls.monthCharged - cls.monthCollected) > 0 ? '#dc2626' : '#059669'}; font-weight: bold;">Ksh ${(cls.monthCharged - cls.monthCollected).toLocaleString()}</span></div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>ADM No</th>
                    <th>Student Name</th>
                    <th style="text-align: right;">Invoiced</th>
                    <th style="text-align: right;">Paid</th>
                    <th style="text-align: right;">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  ${cls.studentBalances.map((s: any) => `
                    <tr>
                      <td style="font-family: monospace; font-weight: bold;">${s.admNo}</td>
                      <td>${s.name}</td>
                      <td style="text-align: right;">Ksh ${s.total.toLocaleString()}</td>
                      <td style="text-align: right; color: #059669;">Ksh ${s.paid.toLocaleString()}</td>
                      <td style="text-align: right; color: ${s.balance > 0 ? '#dc2626' : '#059669'}; font-weight: 700;">Ksh ${s.balance.toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
          
          <div class="page-break">
            <h2>Recent Financial Activity (Last 20 Payments)</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Description</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${stats.allPayments.slice(0, 20).map((p: any) => `
                  <tr>
                    <td>${format(new Date(p.date), 'MMM dd, yyyy')}</td>
                    <td>${p.studentName}</td>
                    <td>${p.description}</td>
                    <td style="text-align: right; font-weight: bold; color: #059669;">Ksh ${p.amount.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="footer">
            <p>Generated by BITC School Management System on ${new Date().toLocaleString()}</p>
            <p>This report is for internal administrative use only.</p>
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

  const getClassStats = (classId: string) => {
    const classStudents = students.filter(s => (s.classIds || []).includes(classId));
    const activeFeeBalances = feeBalances.filter(fb => classStudents.some(s => s.uid === fb.studentId));

    let paidCount = 0;
    let unpaidCount = 0;
    let overpaidCount = 0;
    let paidThisMonthCount = 0;

    let totalOutstanding = 0;
    let totalPrepaid = 0;
    let totalInvoiced = 0;
    let totalPaid = 0;

    const studentsDetails = classStudents.map(student => {
      const balObj = feeBalances.find(fb => fb.studentId === student.uid);
      const balance = balObj ? Number(balObj.balance) || 0 : 0;
      const totalAmount = balObj ? Number(balObj.totalAmount) || 0 : 0;
      const paidAmount = balObj ? Number(balObj.paidAmount) || 0 : 0;

      totalInvoiced += totalAmount;
      totalPaid += paidAmount;

      const hasPaidThisMonth = balObj?.history?.some(h => {
        if (h.type !== 'payment') return false;
        const d = new Date(h.date);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }) || false;

      if (hasPaidThisMonth) {
        paidThisMonthCount++;
      }

      let status: 'paid' | 'unpaid' | 'overpaid' = 'paid';
      if (balance > 0) {
        status = 'unpaid';
        unpaidCount++;
        totalOutstanding += balance;
      } else if (balance < 0) {
        status = 'overpaid';
        overpaidCount++;
        totalPrepaid += Math.abs(balance);
      } else {
        status = 'paid';
        paidCount++;
      }

      return {
        uid: student.uid,
        name: student.name,
        email: student.email,
        admNo: student.admissionNumber || student.email.split('@')[0].toUpperCase(),
        totalAmount,
        paidAmount,
        balance,
        status,
        paidThisMonth: hasPaidThisMonth
      };
    });

    return {
      totalStudents: classStudents.length,
      paidCount,
      unpaidCount,
      overpaidCount,
      paidThisMonthCount,
      totalOutstanding,
      totalPrepaid,
      totalInvoiced,
      totalPaid,
      studentsDetails
    };
  };

  const handlePrintClassReport = (cls: any, stats: any, currentFilter: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reportTitle = cls.name + " - Class Fees Report";
    const dateStr = format(new Date(), 'MMMM dd, yyyy');

    const filteredStudents = stats.studentsDetails.filter((s: any) => {
      if (currentFilter === 'paid') return s.status === 'paid';
      if (currentFilter === 'unpaid') return s.status === 'unpaid';
      if (currentFilter === 'overpaid') return s.status === 'overpaid';
      return true;
    });

    const paidPct = stats.totalStudents > 0 ? ((stats.paidCount / stats.totalStudents) * 100).toFixed(0) : '0';
    const unpaidPct = stats.totalStudents > 0 ? ((stats.unpaidCount / stats.totalStudents) * 100).toFixed(0) : '0';
    const overpaidPct = stats.totalStudents > 0 ? ((stats.overpaidCount / stats.totalStudents) * 100).toFixed(0) : '0';

    let studentRowsHtml = '';
    for (let i = 0; i < filteredStudents.length; i++) {
      const s = filteredStudents[i];
      const balColor = s.balance > 0 ? '#991b1b' : s.balance < 0 ? '#0284c7' : '#475569';
      const badgeCls = s.status === 'paid' ? 'badge-paid' : s.status === 'unpaid' ? 'badge-unpaid' : 'badge-overpaid';
      const badgeLbl = s.status === 'paid' ? 'Cleared' : s.status === 'unpaid' ? 'Outstanding' : 'Prepaid Credit';

      studentRowsHtml += '<tr>' +
        '<td style="font-family: monospace; font-weight: bold; color: #475569;">' + s.admNo + '</td>' +
        '<td style="font-weight: 600;">' + s.name + '</td>' +
        '<td style="text-align: right;">Ksh ' + s.totalAmount.toLocaleString() + '</td>' +
        '<td style="text-align: right; color: #166534; font-weight: 600;">Ksh ' + s.paidAmount.toLocaleString() + '</td>' +
        '<td style="text-align: right; font-weight: 700; color: ' + balColor + ';">Ksh ' + s.balance.toLocaleString() + '</td>' +
        '<td><span class="badge ' + badgeCls + '">' + badgeLbl + '</span></td>' +
      '</tr>';
    }

    if (filteredStudents.length === 0) {
      studentRowsHtml = '<tr><td colspan="6" style="text-align: center; color: #64748b; font-style: italic; padding: 24px;">No student records found matching the active filter.</td></tr>';
    }

    const html = `
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #7c3aed; padding-bottom: 20px; }
            .header h1 { margin: 0; font-size: 26px; font-weight: 900; color: #7c3aed; text-transform: uppercase; letter-spacing: -0.02em; }
            .header p { margin: 5px 0 0; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; font-size: 11px; }
            
            .summary-title { font-size: 14px; font-weight: 900; text-transform: uppercase; color: #1e293b; letter-spacing: 0.05em; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
            
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 35px; }
            .stat-card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; background: #fff; text-align: center; }
            .stat-label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.05em; }
            .stat-value { font-size: 18px; font-weight: 800; color: #0f172a; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; background: #f8fafc; padding: 10px 12px; font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; border-top: 1px solid #e2e8f0; }
            td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #334155; }
            .badge { display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: 800; border-radius: 6px; text-transform: uppercase; }
            .badge-paid { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
            .badge-unpaid { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
            .badge-overpaid { background: #f0f9ff; color: #075985; border: 1px solid #bae6fd; }

            .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
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
              body { padding: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .watermark-container { opacity: 0.14 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              @page { margin: 1.5cm; }
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
            <h1>${reportTitle}</h1>
            <p>Generated on ${dateStr} • Filter: ${currentFilter.toUpperCase()}</p>
          </div>

          <div class="summary-title">Class Performance Summary</div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Students</div>
              <div class="stat-value">${stats.totalStudents}</div>
            </div>
            <div class="stat-card" style="border-top: 3px solid #166534;">
              <div class="stat-label" style="color: #166534;">Paid (Cleared)</div>
              <div class="stat-value" style="color: #166534;">${stats.paidCount} <span style="font-size: 11px; font-weight: normal; color: #64748b;">(${paidPct}%)</span></div>
            </div>
            <div class="stat-card" style="border-top: 3px solid #991b1b;">
              <div class="stat-label" style="color: #991b1b;">Unpaid (Outstanding)</div>
              <div class="stat-value" style="color: #991b1b;">${stats.unpaidCount} <span style="font-size: 11px; font-weight: normal; color: #64748b;">(${unpaidPct}%)</span></div>
            </div>
            <div class="stat-card" style="border-top: 3px solid #075985;">
              <div class="stat-label" style="color: #075985;">Overpaid (Credits)</div>
              <div class="stat-value" style="color: #075985;">${stats.overpaidCount} <span style="font-size: 11px; font-weight: normal; color: #64748b;">(${overpaidPct}%)</span></div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Invoiced Dues</div>
              <div class="stat-value">Ksh ${stats.totalInvoiced.toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Amount Paid</div>
              <div class="stat-value" style="color: #166534;">Ksh ${stats.totalPaid.toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Outstanding Arrears</div>
              <div class="stat-value" style="color: #991b1b;">Ksh ${stats.totalOutstanding.toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Prepaid Credits</div>
              <div class="stat-value" style="color: #075985;">Ksh ${stats.totalPrepaid.toLocaleString()}</div>
            </div>
          </div>

          <div class="summary-title">Class Student Roster</div>
          <table>
            <thead>
              <tr>
                <th>ADM No</th>
                <th>Student Name</th>
                <th style="text-align: right;">Total Billed</th>
                <th style="text-align: right;">Total Paid</th>
                <th style="text-align: right;">Running Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${studentRowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <p>Breakthrough International - Comprehensive Class Financial System Report</p>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const [isRunningMonthlyBilling, setIsRunningMonthlyBilling] = useState(false);

  const handleRunMonthlyBilling = async () => {
    setIsRunningMonthlyBilling(true);
    try {
      const absoluteUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/api/fees/auto-apply`
        : '/api/fees/auto-apply';
      const response = await fetch(absoluteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (data.success && data.result) {
        const { configsCount, appliedCount, skippedCount, suspendedCount } = data.result;
        await loadFeesData(true);
        addToast(
          `Monthly Billing complete! Processed ${configsCount} configs. Applied to ${appliedCount} students. Skipped ${skippedCount} duplicates.${suspendedCount ? ` Suspended billing for ${suspendedCount} student(s) due to 2-month absence.` : ''}`,
          "success"
        );
      } else {
        addToast(data.error || "Failed to execute monthly billing automation.", "error");
      }
    } catch (err: any) {
      console.error("Failed to trigger monthly billing automation:", err);
      addToast(err.message || "An error occurred while running monthly billing.", "error");
    } finally {
      setIsRunningMonthlyBilling(false);
    }
  };

  const [isLoading, setIsLoading] = useState(false);

  const loadFeesData = async (fullLoad = false) => {
    if (!user) return;
    if (fullLoad) setIsLoading(true);
    try {
      if (isAdminView) {
        // Load all balances
        const feesSnap = await getDocs(collection(db, 'fees'));
        const allBalances = feesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeeBalance));
        
        const dedupedMap = new Map<string, FeeBalance>();
        const sorted = [...allBalances].sort((a, b) => (a.lastUpdated || '').localeCompare(b.lastUpdated || ''));
        
        sorted.forEach(bal => {
          if (!bal.studentId) return;
          const sId = String(bal.studentId).trim();
          const existing = dedupedMap.get(sId);
          if (!existing) {
            dedupedMap.set(sId, bal);
            return;
          }
          const balIsUidMatch = bal.id === sId;
          const existingIsUidMatch = existing.id === sId;
          if (balIsUidMatch && !existingIsUidMatch) {
            dedupedMap.set(sId, bal);
          } else if (balIsUidMatch === existingIsUidMatch) {
            if ((bal.lastUpdated || '') >= (existing.lastUpdated || '')) {
              dedupedMap.set(sId, bal);
            }
          }
        });
        setFeeBalances(Array.from(dedupedMap.values()));

        // Load all students
        const usersSnap = await getDocs(collection(db, 'users'));
        const allUsers = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
        const filteredStudents = allUsers.filter(u => String(u.role).toLowerCase() === 'student');
        setStudents(filteredStudents);

        // Determine students with suspended monthly fees due to 2-month absence (60 days)
        try {
          const sixtyDaysAgo = new Date();
          sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
          const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

          const attendanceSnap = await getDocs(collection(db, 'attendance'));

          const studentPresenceCount: { [studentId: string]: number } = {};

          attendanceSnap.docs.forEach(doc => {
            const data = doc.data();
            const date = data.date;
            if (date && date >= sixtyDaysAgoStr) {
              const records = data.records || {};
              for (const [studentId, status] of Object.entries(records)) {
                if (status === 'present' || status === 'late' || status === 'excused') {
                  studentPresenceCount[studentId] = (studentPresenceCount[studentId] || 0) + 1;
                }
              }
            }
          });

          const now = new Date();
          const suspended = new Set<string>();

          filteredStudents.forEach(student => {
            const sUid = student.uid;
            
            // Skip check for new students registered in the last 30 days
            const createdAtStr = student.createdAt || (student as any).admissionDate;
            const createdDate = createdAtStr ? new Date(createdAtStr) : null;
            const isNewStudent = createdDate && (now.getTime() - createdDate.getTime()) < 30 * 24 * 60 * 60 * 1000;

            if (!isNewStudent) {
              const presenceCount = studentPresenceCount[sUid] || 0;

              if (presenceCount === 0) {
                suspended.add(sUid);
              }
            }
          });

          setSuspendedStudentIds(suspended);
        } catch (err) {
          console.error("Error determining suspended students on client side:", err);
        }
      }

      if (fullLoad || !isAdminView) {
        // Load classes
        const classesSnap = await getDocs(collection(db, 'classes'));
        setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));

        // Load fee configs
        const configsSnap = await getDocs(collection(db, 'feeConfigs'));
        setClassFees(configsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassFee)));

        // Load units
        const unitsSnap = await getDocs(collection(db, 'units'));
        setUnits(unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));

        // Load fee types
        const typesSnap = await getDocs(collection(db, 'feeTypes'));
        setFeeTypes(typesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeeType)));

        // Load fee groups
        const groupsSnap = await getDocs(collection(db, 'feeGroups'));
        setFeeGroups(groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeeGroup)));

        if (isAdminView) {
          // Load expenses
          const expensesSnap = await getDocs(collection(db, 'expenses'));
          setExpenses(expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
        }
      }
    } catch (error) {
      console.error("Load fees data error:", error);
      addToast("Failed to load school fees data", "error");
    } finally {
      if (fullLoad) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    let unsubMyFees: (() => void) | undefined;

    try {
      if (isAdminView) {
        loadFeesData(true);
      } else {
        loadFeesData(true);
        // Student/Parent sees only the selected child's balance - listen live to see balance update live
        const targetStudentId = studentContext?.uid || user.uid;
        const q = query(collection(db, 'fees'), where('studentId', '==', targetStudentId));
        unsubMyFees = onSnapshot(q, (snap) => {
          if (!snap.empty) {
            const balances = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeeBalance));
            const studentUid = String(targetStudentId).trim();
            const sorted = balances.sort((a, b) => {
              const aMatch = String(a.id).trim() === studentUid ? 1 : 0;
              const bMatch = String(b.id).trim() === studentUid ? 1 : 0;
              if (aMatch !== bMatch) return bMatch - aMatch;
              return (b.lastUpdated || '').localeCompare(a.lastUpdated || '');
            });
            setMyBalance(sorted[0]);
          } else {
            setMyBalance(null);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'fees-student');
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'fees-data-registration');
    }

    return () => {
      if (unsubMyFees) unsubMyFees();
    };
  }, [user, isAdminView, studentContext?.uid]);

  useEffect(() => {
    if (settings) {
      if (settings.isPenaltyEnabled !== undefined) setIsPenaltyEnabled(!!settings.isPenaltyEnabled);
      if (settings.penaltyDay !== undefined) setPenaltyDay(Number(settings.penaltyDay));
      if (settings.penaltyAmount !== undefined) setPenaltyAmount(Number(settings.penaltyAmount));
    }
  }, [settings]);

  const handleSavePenaltySettings = async () => {
    setIsSavingPenaltySettings(true);
    try {
      await updateDoc(doc(db, 'settings', 'global'), {
        isPenaltyEnabled,
        penaltyDay: Number(penaltyDay),
        penaltyAmount: Number(penaltyAmount)
      });
      addToast("Penalty settings saved successfully!", "success");
    } catch (error) {
      console.error("Failed to save penalty settings:", error);
      addToast("Failed to save penalty settings.", "error");
    } finally {
      setIsSavingPenaltySettings(false);
    }
  };

  const handleApplyLatePaymentPenalties = async (bypassDayCheck = false) => {
    setIsApplyingPenalties(true);
    try {
      const absoluteUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/api/fees/apply-penalties`
        : '/api/fees/apply-penalties';
      const response = await fetch(absoluteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bypassDayCheck })
      });
      const data = await response.json();
      if (data.success && data.result) {
        const { appliedCount, skippedCount, suspendedCount, penaltyAmount: amt, penaltyDay: day } = data.result;
        await loadFeesData(true);
        addToast(
          `Late penalties applied! Charged Ksh ${amt} to ${appliedCount} students. Skipped ${skippedCount} students.${suspendedCount ? ` Suspended for ${suspendedCount} student(s) due to absence.` : ''}`,
          "success"
        );
      } else {
        addToast(data.error || "Failed to calculate/apply penalties.", "error");
      }
    } catch (err: any) {
      console.error("Failed to trigger penalty application:", err);
      addToast(err.message || "An error occurred while calculating penalties.", "error");
    } finally {
      setIsApplyingPenalties(false);
    }
  };

  const handleEditHistoryItem = (student: User, item: any, index: number) => {
    setSelectedStudent(student);
    setEditingHistoryIndex(index);
    setUpdateForm({
      amount: item.amount,
      type: item.type,
      description: item.description,
      file: null
    });
    setIsUpdating(true);
  };

  const handleUpdateBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || (updateMode === 'transaction' && !updateForm.amount)) return;

    setIsUpdating(true);

    try {
      if (updateMode === 'direct') {
        const existingBalance = feeBalances.find(b => b.studentId === selectedStudent.uid);
        const now = new Date().toISOString();
        const newTotal = parseFloat(String(directForm.totalAmount)) || 0;
        const newPaid = parseFloat(String(directForm.paidAmount)) || 0;
        const reason = directForm.reason || 'Manual ledger modification';

        const oldTotal = existingBalance ? parseFloat(String(existingBalance.totalAmount || 0)) : 0;
        const oldPaid = existingBalance ? parseFloat(String(existingBalance.paidAmount || 0)) : 0;

        const diffTotal = newTotal - oldTotal;
        const diffPaid = newPaid - oldPaid;

        const newHistory = existingBalance ? [...(existingBalance.history || [])] : [];

        if (diffTotal !== 0) {
          newHistory.push({
            date: now,
            amount: Math.abs(diffTotal),
            type: diffTotal > 0 ? 'charge' : 'payment',
            description: `Direct Invoice Adjustment: ${reason}`
          });
        }

        if (diffPaid !== 0) {
          newHistory.push({
            date: now,
            amount: Math.abs(diffPaid),
            type: diffPaid > 0 ? 'payment' : 'charge',
            description: `Direct Payment Adjustment: ${reason}`
          });
        }

        if (existingBalance) {
          await updateDoc(doc(db, 'fees', existingBalance.id), {
            totalAmount: newTotal,
            paidAmount: newPaid,
            balance: newTotal - newPaid,
            lastUpdated: now,
            history: newHistory
          });

          try {
            await setDoc(doc(db, 'fee_balances', existingBalance.studentId || existingBalance.id), {
              studentId: existingBalance.studentId || existingBalance.id,
              totalAmount: newTotal,
              paidAmount: newPaid,
              balance: newTotal - newPaid,
              lastUpdated: now
            }, { merge: true });
          } catch (e) {
            console.error("error updating fee_balances:", e);
          }
        } else {
          await setDoc(doc(db, 'fees', selectedStudent.uid), {
            studentId: selectedStudent.uid,
            totalAmount: newTotal,
            paidAmount: newPaid,
            balance: newTotal - newPaid,
            lastUpdated: now,
            history: newHistory.length > 0 ? newHistory : [{
              date: now,
              amount: newTotal,
              type: 'charge',
              description: `Initial Tuition Invoiced (${reason})`
            }, {
              date: now,
              amount: newPaid,
              type: 'payment',
              description: `Initial Payment Recorded (${reason})`
            }].filter(item => item.amount > 0)
          });

          try {
            await setDoc(doc(db, 'fee_balances', selectedStudent.uid), {
              studentId: selectedStudent.uid,
              totalAmount: newTotal,
              paidAmount: newPaid,
              balance: newTotal - newPaid,
              lastUpdated: now
            }, { merge: true });
          } catch (e) {
            console.error("error setting fee_balances:", e);
          }
        }

        await loadFeesData();

        // Notify student
        await addDoc(collection(db, 'notifications'), {
          userId: selectedStudent.uid,
          title: 'Fee Ledger Adjusted',
          message: `Your fee balance details have been manually adjusted. New Balance: Ksh ${(newTotal - newPaid).toLocaleString()}`,
          type: 'fee',
          read: false,
          createdAt: now,
          link: '/fees'
        });

        setIsUpdating(false);
        setSelectedStudent(null);
        setUpdateForm({ amount: 0, type: 'payment', description: '', file: null });
        addToast("Fee balance directly adjusted successfully!");
        return;
      }

      let attachmentUrl = '';
      let attachmentName = '';

      if (updateForm.file) {
        const formData = new FormData();
        formData.append('file', updateForm.file);
        
        try {
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          const uploadData = await uploadRes.json();
          if (uploadData.success) {
            attachmentUrl = uploadData.url;
            attachmentName = uploadData.filename;
          }
        } catch (uploadError) {
          console.error("File upload failed, continuing without attachment:", uploadError);
          addToast("File upload failed, recording transaction without attachment", "error");
        }
      }

      const existingBalance = feeBalances.find(b => b.studentId === selectedStudent.uid);
      const now = new Date().toISOString();
      const historyItem = {
        date: editingHistoryIndex !== null && existingBalance ? existingBalance.history[editingHistoryIndex].date : now,
        amount: parseFloat(String(updateForm.amount)),
        type: updateForm.type,
        description: updateForm.description || (updateForm.type === 'payment' ? 'Fee Payment' : 'Fee Charge'),
        attachmentUrl: attachmentUrl || (editingHistoryIndex !== null && existingBalance ? existingBalance.history[editingHistoryIndex].attachmentUrl : ''),
        attachmentName: attachmentName || (editingHistoryIndex !== null && existingBalance ? existingBalance.history[editingHistoryIndex].attachmentName : '')
      };

      if (existingBalance) {
        const newHistory = [...(existingBalance.history || [])];
        let newTotal = parseFloat(String(existingBalance.totalAmount || 0));
        let newPaid = parseFloat(String(existingBalance.paidAmount || 0));

        if (editingHistoryIndex !== null) {
          // Editing existing item: Undo old effect first
          const oldItem = newHistory[editingHistoryIndex];
          const oldAmount = parseFloat(String(oldItem.amount));
          
          if (oldItem.type === 'payment') {
            newPaid -= oldAmount;
          } else {
            newTotal -= oldAmount;
          }
          
          // Replace with new item
          newHistory[editingHistoryIndex] = historyItem;
        } else {
          // Adding new item
          newHistory.push(historyItem);
        }

        // Apply new item effect (always do this, even for edit)
        const amountNum = parseFloat(String(historyItem.amount));
        if (historyItem.type === 'payment') {
          newPaid += amountNum;
        } else {
          newTotal += amountNum;
        }
        
        await updateDoc(doc(db, 'fees', existingBalance.id), {
          totalAmount: newTotal,
          paidAmount: newPaid,
          balance: newTotal - newPaid,
          lastUpdated: now,
          history: newHistory
        });

        // Sync with fee_balances collection
        try {
          await setDoc(doc(db, 'fee_balances', existingBalance.studentId || existingBalance.id), {
            studentId: existingBalance.studentId || existingBalance.id,
            totalAmount: newTotal,
            paidAmount: newPaid,
            balance: newTotal - newPaid,
            lastUpdated: now
          }, { merge: true });
        } catch (e) {
          console.error("error updating fee_balances:", e);
        }
      } else if (editingHistoryIndex === null) {
        // Only allow creating if not editing (though shouldn't happen if student selected)
        const amountNum = parseFloat(String(updateForm.amount));
        const total = updateForm.type === 'charge' ? amountNum : 0;
        const paid = updateForm.type === 'payment' ? amountNum : 0;
        
        await setDoc(doc(db, 'fees', selectedStudent.uid), {
          studentId: selectedStudent.uid,
          totalAmount: total,
          paidAmount: paid,
          balance: total - paid,
          lastUpdated: now,
          history: [historyItem]
        });

        // Sync with fee_balances collection
        try {
          await setDoc(doc(db, 'fee_balances', selectedStudent.uid), {
            studentId: selectedStudent.uid,
            totalAmount: total,
            paidAmount: paid,
            balance: total - paid,
            lastUpdated: now
          }, { merge: true });
        } catch (e) {
          console.error("error setting fee_balances:", e);
        }
      }

      await loadFeesData();

      // Notify student (maybe only for new ones or if amount changed significantly? Let's notify for all updates)
      await addDoc(collection(db, 'notifications'), {
        userId: selectedStudent.uid,
        title: editingHistoryIndex !== null ? 'Fee Record Updated' : (updateForm.type === 'payment' ? 'Payment Received' : 'New Fee Charge'),
        message: editingHistoryIndex !== null 
          ? `A previous fee record has been edited. New amount: Ksh ${updateForm.amount}.`
          : `Your fee balance has been updated. ${updateForm.type === 'payment' ? 'Payment of' : 'Charge of'} Ksh ${updateForm.amount} recorded.`,
        type: 'fee',
        read: false,
        createdAt: now,
        link: '/fees'
      });

      setIsUpdating(false);
      setSelectedStudent(null);
      setEditingHistoryIndex(null);
      setUpdateForm({ amount: 0, type: 'payment', description: '', file: null });
      addToast(editingHistoryIndex !== null ? "Transaction updated successfully!" : "Fee balance updated successfully!");

      // Automatic print prompt for success (new or edited payment)
      if (updateForm.type === 'payment') {
        const amountNum = parseFloat(String(updateForm.amount));
        const finalBalance = {
          total: parseFloat(String(existingBalance?.totalAmount || 0)),
          paid: parseFloat(String(existingBalance?.paidAmount || 0)), // This will be the new paid amount after the updateDoc finishes but we want immediate feel
          remaining: 0
        };
        
        // Re-calculating for print prompt
        if (editingHistoryIndex !== null && existingBalance) {
           const oldItem = existingBalance.history[editingHistoryIndex];
           if (oldItem.type === 'payment') finalBalance.paid -= parseFloat(String(oldItem.amount));
        }
        finalBalance.paid += amountNum;
        finalBalance.remaining = finalBalance.total - finalBalance.paid;
        
        setPrintConfirm({
          student: selectedStudent,
          item: historyItem,
          balance: finalBalance
        });
      }
    } catch (error: any) {
      console.error("Update fee balance error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update balance";
      addToast(errorMessage, "error");
      handleFirestoreError(error, OperationType.UPDATE, 'fees');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateClassFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classFeeForm.classId || !classFeeForm.amount) return;

    try {
      if (editingFeeId) {
        await updateDoc(doc(db, 'feeConfigs', editingFeeId), {
          ...classFeeForm,
          updatedAt: new Date().toISOString()
        });
        addToast("Fee configuration updated!");
      } else {
        await addDoc(collection(db, 'feeConfigs'), {
          ...classFeeForm,
          createdAt: new Date().toISOString()
        });
        addToast("Class fee configuration created!");
      }
      await loadFeesData(true);
      setIsAddingClassFee(false);
      setEditingFeeId(null);
      setClassFeeForm({ classId: '', title: '', amount: 0, period: 'monthly', feeType: '', feeGroup: '' });
    } catch (error) {
      handleFirestoreError(error, editingFeeId ? OperationType.UPDATE : OperationType.CREATE, 'feeConfigs');
    }
  };

  const handleCreateFeeType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeeTypeName.trim()) return;
    try {
      if (editingFeeTypeId) {
        await updateDoc(doc(db, 'feeTypes', editingFeeTypeId), {
          name: newFeeTypeName.trim(),
          updatedAt: new Date().toISOString()
        });
        addToast("Fee type updated!");
        setEditingFeeTypeId(null);
      } else {
        await addDoc(collection(db, 'feeTypes'), {
          name: newFeeTypeName.trim(),
          createdAt: new Date().toISOString()
        });
        addToast("Fee type added!");
      }
      await loadFeesData(true);
      setNewFeeTypeName('');
      setIsAddingFeeType(false);
    } catch (error) {
      handleFirestoreError(error, editingFeeTypeId ? OperationType.UPDATE : OperationType.CREATE, 'feeTypes');
    }
  };

  const handleCreateFeeGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeeGroupName.trim()) return;
    try {
      if (editingFeeGroupId) {
        await updateDoc(doc(db, 'feeGroups', editingFeeGroupId), {
          name: newFeeGroupName.trim(),
          updatedAt: new Date().toISOString()
        });
        addToast("Fee group updated!");
        setEditingFeeGroupId(null);
      } else {
        await addDoc(collection(db, 'feeGroups'), {
          name: newFeeGroupName.trim(),
          createdAt: new Date().toISOString()
        });
        addToast("Fee group added!");
      }
      await loadFeesData(true);
      setNewFeeGroupName('');
      setIsAddingFeeGroup(false);
    } catch (error) {
      handleFirestoreError(error, editingFeeGroupId ? OperationType.UPDATE : OperationType.CREATE, 'feeGroups');
    }
  };

  const handleDeleteFeeType = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteDoc(doc(db, 'feeTypes', id));
      await loadFeesData(true);
      addToast("Fee type deleted");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'feeTypes');
    }
  };

  const handleDeleteFeeGroup = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteDoc(doc(db, 'feeGroups', id));
      await loadFeesData(true);
      addToast("Fee group deleted");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'feeGroups');
    }
  };

  const handleDeleteClassFee = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fee package? This will not remove fees already applied to students, but will stop any future automated applications for this package.")) return;
    
    try {
      await deleteDoc(doc(db, 'feeConfigs', id));
      await loadFeesData(true);
      addToast("Fee package deleted successfully", "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'feeConfigs');
    }
  };

  const handleApplyClassFee = async (fee: ClassFee, specificClassId?: string) => {
    // Defense: Ensure we have students and a valid fee
    if (!students.length) {
      addToast("No student records loaded yet", "error");
      return;
    }

    // Normalizing classId comparison
    const targetClassId = specificClassId || fee.classId;
    const isAll = targetClassId === 'all';
    // Ensure we comparison matches types (convert all to string)
    const classIdToMatch = String(targetClassId);
    
    // For duplicate prevention
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const nowObj = new Date();
    const currentMonthYear = `${monthNames[nowObj.getMonth()]} ${nowObj.getFullYear()}`;
    const monthlyDescription = `Monthly Fee: ${fee.title} (${currentMonthYear})`;
    const genericDailyCheck = `Charge: ${fee.title} - ${format(nowObj, 'yyyy-MM-dd')}`;

    const targetStudents = isAll 
      ? students 
      : students.filter(s => {
          const sClassIds = (s.classIds || []).map(id => String(id).trim());
          const target = classIdToMatch.trim();
          return sClassIds.includes(target);
        });
    
    if (targetStudents.length === 0) {
      const className = isAll ? 'the school' : (classes.find(c => String(c.id).trim() === classIdToMatch.trim())?.name || 'this class');
      addToast(`No students are currently assigned to ${className}`, "error");
      return;
    }

    const appliedToName = isAll ? 'all students' : classes.find(c => String(c.id) === classIdToMatch)?.name || 'selected class';
    if (!confirm(`Apply charge of Ksh ${fee.amount} ("${fee.title}") to ${targetStudents.length} students enrolled in ${appliedToName}?`)) {
       return;
    }

    setIsApplyingFee(true);
    let appliedCount = 0;
    let skippedCount = 0;
    try {
      const now = new Date().toISOString();
      const CHUNK_SIZE = 100; // Smaller chunks for better reliability
      
      console.log(`Starting bulk apply for "${fee.title}" to ${targetStudents.length} students...`);

      for (let i = 0; i < targetStudents.length; i += CHUNK_SIZE) {
        const chunk = targetStudents.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        let operationsInBatch = 0;

        for (const student of chunk) {
          const sUid = String(student.uid).trim();
          const existingBalance = feeBalances.find(b => String(b.studentId).trim() === sUid || String(b.id).trim() === sUid);
          
          let description = fee.period === 'monthly' ? monthlyDescription : `Charge: ${fee.title} (${fee.period})`;
          if (fee.period !== 'semester' && fee.period !== 'yearly' && fee.period !== 'monthly') {
             description = `Charge: ${fee.title}`;
          }

          // Robust Duplicate Prevention:
          // 1. If monthly, check this month's entry
          // 2. If already applied TODAY (by title and amount), skip
          const isDuplicate = existingBalance?.history?.some(h => {
             if (h.type !== 'charge') return false;
             
             // Check precise monthly description
             if (fee.period === 'monthly' && h.description === monthlyDescription) return true;
             
             // Check if same title and amount was added in the last 24 hours
             const chargeDate = new Date(h.date);
             const diffHours = (nowObj.getTime() - chargeDate.getTime()) / (1000 * 60 * 60);
             if (h.amount === Number(fee.amount) && h.description.includes(fee.title) && diffHours < 24) return true;
             
             return false;
          });

          if (isDuplicate) {
            skippedCount++;
            continue;
          }

          appliedCount++;
          const historyItem = {
            date: now,
            amount: Number(fee.amount),
            type: 'charge' as const,
            description
          };

          const currentPaid = existingBalance ? Number(existingBalance.paidAmount || 0) : 0;
          let currentTotal = Number(fee.amount);

          if (existingBalance) {
            currentTotal = Number(existingBalance.totalAmount || 0) + Number(fee.amount);
            batch.update(doc(db, 'fees', existingBalance.id), {
              totalAmount: currentTotal,
              balance: currentTotal - currentPaid,
              lastUpdated: now,
              history: [...(existingBalance.history || []), historyItem]
            });
          } else {
            const feeRef = doc(db, 'fees', sUid);
            batch.set(feeRef, {
              studentId: sUid,
              totalAmount: currentTotal,
              paidAmount: 0,
              balance: currentTotal,
              lastUpdated: now,
              history: [historyItem]
            });
          }

          // Concurrently update fee_balances to keep them 100% in sync
          const feeBalRef = doc(db, 'fee_balances', sUid);
          batch.set(feeBalRef, {
            studentId: sUid,
            totalAmount: currentTotal,
            paidAmount: currentPaid,
            balance: currentTotal - currentPaid,
            lastUpdated: now
          }, { merge: true });

          // Add notification
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            userId: student.uid,
            title: 'Fee Applied',
            message: `${fee.title}: A charge of Ksh ${fee.amount} has been added to your account.`,
            type: 'fee',
            read: false,
            createdAt: now,
            link: '/fees'
          });

          // Trigger Push Notification via API
          fetch('/api/notifications/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: student.uid,
              title: 'Fee Applied',
              body: `${fee.title}: A charge of Ksh ${fee.amount} has been added.`,
              link: '/#/fees'
            })
          }).catch(err => console.error('Push trigger failed:', err));
          
          operationsInBatch++;
        }

        if (operationsInBatch > 0) {
          console.log(`Committing batch chunk ${i / CHUNK_SIZE + 1}...`);
          await batch.commit();
        }
      }

      await loadFeesData();

      if (appliedCount > 0) {
        addToast(`Successfully applied fee to ${appliedCount} students!${skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : ''}`, "success");
      } else if (skippedCount > 0) {
        addToast(`Fee already applied to target students in the last 24 hours.`, "success");
      } else {
        addToast("No actions were taken.", "success");
      }
    } catch (error: any) {
      console.error("Batch apply error:", error);
      const message = error.message || "Failed to apply fee";
      addToast(message, "error");
      handleFirestoreError(error, OperationType.WRITE, 'fees/batch');
    } finally {
      setIsApplyingFee(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    if (!confirm("This will merge duplicate fee records for all students. This cannot be undone. Proceed?")) return;
    
    setIsCleaning(true);
    try {
      console.log("Starting fee cleanup process...");
      const snap = await getDocs(collection(db, 'fees'));
      const allFees = snap.docs.map(d => ({ id: d.id, ...d.data() } as FeeBalance));
      console.log(`Fetched ${allFees.length} total fee records.`);
      
      const studentGroups = new Map<string, FeeBalance[]>();
      allFees.forEach(f => {
        const studentId = f.studentId ? String(f.studentId).trim() : null;
        if (!studentId) {
             // Try to use ID if it looks like a UID? Or just ignore
             console.warn("Found fee record without studentId:", f.id);
             return;
        }
        const list = studentGroups.get(studentId) || [];
        list.push(f);
        studentGroups.set(studentId, list);
      });
      
      const studentsToFix = Array.from(studentGroups.entries());
      let fixedCount = 0;
      let totalOps = 0;
      let batch = writeBatch(db);
      
      const commitIfFull = async () => {
        if (totalOps >= 450) {
          console.log("Batch limit reached, committing...");
          await batch.commit();
          batch = writeBatch(db);
          totalOps = 0;
        }
      };

      for (const [studentId, records] of studentsToFix) {
        if (records.length <= 1) {
          const primary = records[0];
          if (primary && primary.id !== studentId) {
             fixedCount++;
             const { id: oldId, ...dataToSave } = primary;
             const newRef = doc(db, 'fees', studentId);
             batch.set(newRef, {
               ...dataToSave,
               lastUpdated: new Date().toISOString()
             });
             batch.delete(doc(db, 'fees', oldId));
             totalOps += 2;
             await commitIfFull();
          }
          continue;
        }
        
        fixedCount++;
        // Merge logic
        let primary = records.find(r => r.id === studentId);
        if (!primary) {
          primary = [...records].sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''))[0];
        }
        
        const others = records.filter(r => r.id !== primary!.id);
        
        let totalAmount = Number(primary.totalAmount || 0);
        let paidAmount = Number(primary.paidAmount || 0);
        let history = [...(primary.history || [])];
        
        others.forEach(o => {
          totalAmount += Number(o.totalAmount || 0);
          paidAmount += Number(o.paidAmount || 0);
          
          o.history?.forEach(h => {
             const isDup = history.find(existing => 
               existing.date === h.date && 
               existing.amount === h.amount && 
               existing.type === h.type
             );
             if (!isDup) history.push(h);
          });
          
          batch.delete(doc(db, 'fees', o.id));
          totalOps++;
        });
        
        history.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        
        if (primary.id !== studentId) {
          const { id: oldId, ...dataToSave } = primary;
          const newPrimaryRef = doc(db, 'fees', studentId);
          batch.set(newPrimaryRef, {
            ...dataToSave,
            totalAmount,
            paidAmount,
            balance: totalAmount - paidAmount,
            history,
            lastUpdated: new Date().toISOString()
          });
          batch.delete(doc(db, 'fees', oldId));
          totalOps += 2;
        } else {
          batch.update(doc(db, 'fees', primary.id), {
            totalAmount,
            paidAmount,
            balance: totalAmount - paidAmount,
            history,
            lastUpdated: new Date().toISOString()
          });
          totalOps++;
        }
        await commitIfFull();
      }
      
      if (totalOps > 0) {
        await batch.commit();
      }

      await loadFeesData();

      if (fixedCount > 0) {
        addToast(`Cleanup complete! Merged/Migrated records for ${fixedCount} students.`, "success");
      } else {
        addToast("No duplicates or non-standard IDs found.", "success");
      }
    } catch (error: any) {
      console.error("Cleanup error:", error);
      addToast("Failed to cleanup: " + error.message, "error");
    } finally {
      setIsCleaning(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.email.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    const balanceObj = feeBalances.find(b => b.studentId === s.uid);
    const balAmt = balanceObj?.balance ?? 0;

    if (balanceFilter === 'outstanding') {
      return balAmt > 0;
    }
    if (balanceFilter === 'overpaid') {
      return balAmt < 0;
    }
    if (balanceFilter === 'suspended') {
      return suspendedStudentIds.has(s.uid);
    }
    return true;
  });

  const reportStats = React.useMemo(() => {
    if (!isAdminView) return null;
    
    // Calculate current month start/end for period-specific reporting
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const activeFeeBalances = feeBalances.filter(fb => students.some(s => s.uid === fb.studentId));
    
    // Period stats (This Month)
    let monthCollected = 0;
    let monthCharged = 0;
    let monthCollectedOnTime = 0;

    activeFeeBalances.forEach(fb => {
      (fb.history || []).forEach(h => {
        const itemDate = new Date(h.date);
        if (itemDate >= monthStart && itemDate <= monthEnd) {
          if (h.type === 'payment') {
            monthCollected += Number(h.amount) || 0;
            const dom = itemDate.getDate();
            if (dom >= 1 && dom <= 5) {
              monthCollectedOnTime += Number(h.amount) || 0;
            }
          }
          if (h.type === 'charge') monthCharged += Number(h.amount) || 0;
        }
      });
    });

    // Expenses calculation for current month
    let monthExpenses = 0;
    expenses.forEach(e => {
      const itemDate = new Date(e.date);
      if (itemDate >= monthStart && itemDate <= monthEnd) {
        monthExpenses += Number(e.amount) || 0;
      }
    });

    // Class breakdown
    const classBreakdown = classes.map(cls => {
      const classStudents = students.filter(s => (s.classIds || []).includes(cls.id));
      const classBalances = activeFeeBalances.filter(fb => classStudents.some(s => s.uid === fb.studentId));
      
      const expected = classBalances.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
      const collected = classBalances.reduce((acc, curr) => acc + (Number(curr.paidAmount) || 0), 0);
      
      // Monthly for class
      let clsMonthCollected = 0;
      let clsMonthCharged = 0;
      classBalances.forEach(fb => {
        (fb.history || []).forEach(h => {
          const itemDate = new Date(h.date);
          if (itemDate >= monthStart && itemDate <= monthEnd) {
            if (h.type === 'payment') clsMonthCollected += Number(h.amount) || 0;
            if (h.type === 'charge') clsMonthCharged += Number(h.amount) || 0;
          }
        });
      });

      const monthlyRate = classFees
        .filter(f => String(f.classId) === String(cls.id) || f.classId === 'all')
        .reduce((acc, f) => {
          let amt = Number(f.amount) || 0;
          if (f.period === 'yearly') {
            return acc + (amt / 12);
          } else if (f.period === 'semester') {
            return acc + (amt / 4);
          }
          return acc + amt;
        }, 0);

      const monthlyProjected = monthlyRate * classStudents.length;
      
      const studentBalances = classStudents.map(s => {
        const bal = activeFeeBalances.find(fb => fb.studentId === s.uid);
        
        let studentMonthCollected = 0;
        let studentMonthCharged = 0;
        if (bal) {
          (bal.history || []).forEach(h => {
            const itemDate = new Date(h.date);
            if (itemDate >= monthStart && itemDate <= monthEnd) {
              if (h.type === 'payment') studentMonthCollected += Number(h.amount) || 0;
              if (h.type === 'charge') studentMonthCharged += Number(h.amount) || 0;
            }
          });
        }

        return {
          name: s.name,
          email: s.email,
          admNo: s.admissionNumber || s.email.split('@')[0].toUpperCase(),
          total: studentMonthCharged,
          paid: studentMonthCollected,
          balance: studentMonthCharged - studentMonthCollected
        };
      }).sort((a,b) => b.balance - a.balance);

      return {
        id: cls.id,
        name: cls.name,
        expected,
        collected,
        monthCollected: clsMonthCollected,
        monthCharged: clsMonthCharged,
        monthlyRate,
        projected: monthlyProjected,
        balance: expected - collected,
        count: classStudents.length,
        studentBalances
      };
    }).sort((a, b) => b.projected - a.projected);

    const totalProjected = classBreakdown.reduce((acc, curr) => acc + curr.projected, 0);

    // Recent payments log
    const allPayments = activeFeeBalances.flatMap(fb => 
      (fb.history || [])
        .filter(h => h.type === 'payment')
        .map(h => ({
          ...h,
          studentName: students.find(s => s.uid === fb.studentId)?.name || 'Unknown',
          studentId: fb.studentId
        }))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalLifetimeExpected = activeFeeBalances.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
    const totalLifetimeCollected = activeFeeBalances.reduce((acc, curr) => acc + (Number(curr.paidAmount) || 0), 0);

    // Overpayment and Prepaid Credits metrics
    const overpaidStudentsList = activeFeeBalances.filter(fb => (Number(fb.balance) || 0) < 0);
    const totalPrepaidCredits = overpaidStudentsList.reduce((acc, curr) => acc + Math.abs(Number(curr.balance) || 0), 0);
    const totalOverpaidStudentsCount = overpaidStudentsList.length;

    // Outstanding and Unpaid Credits metrics (Money Not Paid)
    const dueStudentsList = activeFeeBalances.filter(fb => (Number(fb.balance) || 0) > 0);
    const totalOutstandingDue = dueStudentsList.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);
    const totalDueStudentsCount = dueStudentsList.length;

    // Detailed Monthly Student Data for specialized reports
    const studentMonthlyData = students.map(student => {
      const balance = activeFeeBalances.find(fb => fb.studentId === student.uid);
      let studentMonthCollected = 0;
      let studentMonthCharged = 0;
      
      if (balance) {
        (balance.history || []).forEach(h => {
          const itemDate = new Date(h.date);
          if (itemDate >= monthStart && itemDate <= monthEnd) {
            if (h.type === 'payment') studentMonthCollected += Number(h.amount) || 0;
            if (h.type === 'charge') studentMonthCharged += Number(h.amount) || 0;
          }
        });
      }

      return {
        uid: student.uid,
        name: student.name,
        email: student.email,
        classNames: (student.classIds || []).map(cid => classes.find(c => c.id === cid)?.name || 'Unknown').join(', '),
        monthCharged: studentMonthCharged,
        monthCollected: studentMonthCollected,
        monthBalance: studentMonthCharged - studentMonthCollected,
        runningBalance: studentMonthCharged - studentMonthCollected
      };
    });

    return {
      totalLifetimeExpected,
      totalLifetimeCollected,
      totalBalance: totalLifetimeExpected - totalLifetimeCollected,
      totalPrepaidCredits,
      totalOverpaidStudentsCount,
      totalOutstandingDue,
      totalDueStudentsCount,
      monthCollected,
      monthCharged,
      monthCollectedOnTime,
      monthExpenses,
      totalProjected,
      monthBalance: monthCharged - monthCollected,
      collectionRate: monthCharged > 0 ? (monthCollected / monthCharged) * 100 : 0,
      classBreakdown,
      studentMonthlyData,
      allPayments: allPayments.slice(0, 50)
    };
  }, [isAdminView, feeBalances, students, classes, classFees, expenses]);

  const handleDetailedReport = (type: 'due' | 'payments' | 'balance' | 'overpaid') => {
    if (!reportStats) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reportTitle = type === 'due' 
      ? 'Fees Due Report' 
      : type === 'payments' 
        ? 'Payment Collection Report' 
        : type === 'overpaid'
          ? 'Student Overpayments & Prepaid Credits'
          : 'Monthly Balance Report';
    const monthName = format(new Date(), 'MMMM yyyy');
    
    // Sort data for the report
    let reportData = [...reportStats.studentMonthlyData];
    if (type === 'due') reportData = reportData.filter(d => d.monthCharged > 0).sort((a, b) => b.monthCharged - a.monthCharged);
    if (type === 'payments') reportData = reportData.filter(d => d.monthCollected > 0).sort((a, b) => b.monthCollected - a.monthCollected);
    if (type === 'balance') reportData = reportData.filter(d => d.monthBalance > 0 || d.runningBalance > 0).sort((a, b) => b.runningBalance - a.runningBalance);
    if (type === 'overpaid') reportData = reportData.filter(d => d.runningBalance < 0).sort((a, b) => a.runningBalance - b.runningBalance);

    const html = `
      <html>
        <head>
          <title>${reportTitle} - BITC</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #374151; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #2563EB; padding-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #2563EB; }
            .header p { margin: 5px 0 0; color: #6b7280; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; font-size: 11px; }
            
            h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #2563EB; border-left: 4px solid #2563EB; padding-left: 10px; margin: 30px 0 15px; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #f3f4f6; }
            th { text-align: left; background: #f9fafb; padding: 12px; font-size: 10px; font-weight: 800; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb; }
            td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
            
            .amount { text-align: right; font-weight: bold; font-family: 'Inter', sans-serif; }
            .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #eee; padding-top: 20px; }
            
            .total-row { background: #f9fafb; font-weight: 700; }
            
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
              body { padding: 20px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .watermark-container { opacity: 0.14 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              @page { margin: 1cm; }
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
            ${settings?.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" style="max-height: 60px; margin-bottom: 10px;" />` : ''}
            <h1>BREAKTHROUGH INTERNATIONAL</h1>
            <p>${reportTitle} - ${monthName}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th width="30%">Student Name</th>
                <th width="20%">Class</th>
                ${type === 'due' ? '<th>Description</th>' : ''}
                <th class="amount">${type === 'due' ? 'Amount Due' : type === 'payments' ? 'Amount Paid' : type === 'overpaid' ? 'Held Prepaid Credit' : 'Monthly Bal.'}</th>
                ${type === 'balance' || type === 'overpaid' ? '<th class="amount">Total Bal.</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${reportData.map(d => `
                <tr>
                  <td><strong>${d.name}</strong><br/><span style="font-size: 9px; color: #9ca3af;">${d.email}</span></td>
                  <td>${d.classNames || 'N/A'}</td>
                  ${type === 'due' ? '<td>Monthly Fees</td>' : ''}
                  <td class="amount">${type === 'overpaid' ? `Ksh ${Math.abs(d.runningBalance).toLocaleString()} Credit` : `Ksh ${(type === 'due' ? d.monthCharged : type === 'payments' ? d.monthCollected : d.monthBalance).toLocaleString()}`}</td>
                  ${type === 'balance' ? `<td class="amount" style="color: ${d.runningBalance > 0 ? '#dc2626' : '#059669'}">Ksh ${d.runningBalance.toLocaleString()}</td>` : ''}
                  ${type === 'overpaid' ? `<td class="amount" style="color: #059669">Ksh ${d.runningBalance.toLocaleString()} (Credit)</td>` : ''}
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="${type === 'due' ? 3 : 2}">TOTAL</td>
                <td class="amount">Ksh ${(type === 'due' ? reportStats.monthCharged : type === 'payments' ? reportStats.monthCollected : type === 'overpaid' ? reportStats.totalPrepaidCredits : reportStats.monthBalance).toLocaleString()}</td>
                ${type === 'balance' ? `<td class="amount">Ksh ${reportStats.totalBalance.toLocaleString()}</td>` : ''}
                ${type === 'overpaid' ? `<td class="amount" style="color: #059669">-Ksh ${reportStats.totalPrepaidCredits.toLocaleString()} (Pool)</td>` : ''}
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>BITC Financial Control System</p>
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

  const computedStudentBalance = myBalance ? (myBalance.totalAmount - myBalance.paidAmount) : 0;
  const totalPenalties = myBalance?.history?.filter(h => h.type === 'charge' && (h.description?.toLowerCase().includes('penalty') || h.description?.toLowerCase().includes('late payment'))).reduce((sum, h) => sum + h.amount, 0) || 0;

  if (!isAdminView && !myBalance) {
    return (
      <div className="p-8 text-center bg-bg-card rounded-2xl border border-white/5 shadow-xl">
        <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
          <Wallet size={32} />
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">No Fee Record Found</h2>
        <p className="text-text-secondary">You don't have any fee balance records yet. Please contact the administrator if you believe this is an error.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center text-text-primary">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Fees & Finances</h1>
          <p className="text-text-secondary">{isAdminView ? 'Manage student fee balances and payments' : 'View your fee balance and payment history'}</p>
        </div>
        {isAdminView && (
          <div className="flex gap-2">
            <button
              onClick={() => loadFeesData(true)}
              disabled={isLoading}
              className="flex items-center gap-2 bg-white/5 text-blue-500 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors border border-white/10 text-sm font-medium"
              title="Refresh ledger data"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              {isLoading ? 'Reloading...' : 'Refresh'}
            </button>
            <button
              onClick={handleCleanupDuplicates}
              disabled={isCleaning}
              className="flex items-center gap-2 bg-white/5 text-amber-500 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors border border-white/10 text-sm font-medium"
              title="Merge duplicate fee records"
            >
              <RefreshCw size={18} className={isCleaning ? 'animate-spin' : ''} />
              {isCleaning ? 'Cleaning...' : 'Cleanup Duplicates'}
            </button>
            <button
              onClick={() => {
                setSelectedStudent(null);
                setIsUpdating(true);
              }}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
            >
              <Plus size={20} />
              Update Balance
            </button>
          </div>
        )}
      </div>

      {isAdminView ? (
        <div className="space-y-6">
          <div className="flex border-b border-white/5 mb-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('individual')}
              className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'individual' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <BookOpen size={18} />
              Individual Sessions
            </button>
            <button
              onClick={() => setActiveTab('classes')}
              className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'classes' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <Layers size={18} />
              Class Configurations
            </button>
            <button
              onClick={() => setActiveTab('structure')}
              className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'structure' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <FileText size={18} />
              Fees Structure
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'reports' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <TrendingUp size={18} />
              Financial Reports
            </button>
          </div>

          {activeTab === 'individual' && (
            <>
              <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={searchTerm || ''}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-bg-card border border-white/5 rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-primary"
                  />
                </div>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center w-full lg:w-auto">
                  <div className="flex bg-[#111] p-1 rounded-xl border border-white/5 gap-1">
                    <button
                      onClick={() => setBalanceFilter('all')}
                      className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        balanceFilter === 'all'
                          ? 'bg-white/15 text-white shadow-sm border border-white/10'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setBalanceFilter('outstanding')}
                      className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        balanceFilter === 'outstanding'
                          ? 'bg-rose-500/10 text-rose-500 shadow-sm border border-rose-500/20'
                          : 'text-gray-400 hover:text-rose-400'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      Outstanding
                    </button>
                    <button
                      onClick={() => setBalanceFilter('overpaid')}
                      className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        balanceFilter === 'overpaid'
                          ? 'bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/20'
                          : 'text-gray-400 hover:text-emerald-400'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Credit / Prepaid
                    </button>
                    <button
                      onClick={() => setBalanceFilter('suspended')}
                      className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        balanceFilter === 'suspended'
                          ? 'bg-amber-500/10 text-amber-500 shadow-sm border border-amber-500/20'
                          : 'text-gray-400 hover:text-amber-500'
                      }`}
                      title="Students with billing suspended due to 2-month absence"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      Suspended ({suspendedStudentIds.size})
                    </button>
                  </div>
                  <button
                    onClick={() => handlePrintOutstandingBalances(filteredStudents, balanceFilter)}
                    className="flex items-center justify-center gap-2 bg-primary text-white hover:bg-opacity-90 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-primary/10 transition-all hover:shadow-primary/20 hover:shadow-md active:scale-95"
                    title="Print report for the current filtered list of student balances"
                  >
                    <Printer size={16} />
                    <span>Print balances</span>
                  </button>
                </div>
              </div>

          <div className="bg-bg-card rounded-2xl shadow-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white/5 border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Student</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Total Fees</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Paid</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Balance</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Last Updated</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredStudents.map((student, idx) => {
                    const balance = feeBalances.find(b => b.studentId === student.uid);
                    return (
                      <tr key={`${student.uid || 'stub'}_${idx}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                              {student.name.charAt(0)}
                            </div>
                             <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-text-primary">{student.name}</p>
                                {suspendedStudentIds.has(student.uid) && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/20" title="Billing suspended: No attendance in past 2 months">
                                    SUSPENDED
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-text-muted">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          Ksh {balance?.totalAmount?.toLocaleString() || 0}
                        </td>
                        <td className="px-6 py-4 text-sm text-green-500 font-medium">
                          Ksh {balance?.paidAmount?.toLocaleString() || 0}
                        </td>
                        <td className="px-6 py-4">
                          {balance ? (
                            balance.balance > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                Ksh {balance.balance.toLocaleString()} Due
                              </span>
                            ) : balance.balance < 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                Ksh {Math.abs(balance.balance).toLocaleString()} Credit
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-white/5 text-gray-400 border border-white/5">
                                Fully Cleared
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-gray-500 italic">No balance record</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">
                          {balance?.lastUpdated ? format(new Date(balance.lastUpdated), 'MMM dd, yyyy') : 'Never'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {(() => {
                              const bal = balance || {
                                id: student.uid || '',
                                studentId: student.uid || '',
                                totalAmount: 45000,
                                paidAmount: 0,
                                balance: 45000,
                                lastUpdated: new Date().toISOString(),
                                history: []
                              };
                              return (
                                <>
                                  <button
                                    onClick={() => handlePrintFeesInvoice(student, bal)}
                                    className="text-blue-700 hover:text-blue-800 font-bold text-sm bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 transition-colors hover:bg-blue-100 flex items-center gap-1"
                                    title="Print Fees Invoice"
                                  >
                                    <FileText size={14} />
                                    Invoice
                                  </button>
                                  <button
                                    onClick={() => handlePrintStudentStatement(student, bal)}
                                    className="text-emerald-700 hover:text-emerald-800 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 transition-colors hover:bg-emerald-100 flex items-center gap-1"
                                    title="Print Statement of Account"
                                  >
                                    <FileText size={14} />
                                    Statement
                                  </button>
                                </>
                              );
                            })()}
                            <button
                              onClick={() => {
                                setSelectedStudent(student);
                                setIsHistoryOpen(true);
                              }}
                              className="text-gray-600 hover:text-gray-900 font-bold text-sm bg-gray-50 px-3 py-1 rounded-lg border border-gray-100 transition-colors hover:bg-gray-100"
                              title="View History"
                            >
                              History
                            </button>
                            <button
                              onClick={() => {
                                setSelectedStudent(student);
                                const bal = feeBalances.find(b => b.studentId === student.uid);
                                setDirectForm({
                                  totalAmount: bal?.totalAmount || 0,
                                  paidAmount: bal?.paidAmount || 0,
                                  reason: ''
                                });
                                setUpdateForm({ amount: 0, type: 'payment', description: '', file: null });
                                setUpdateMode('transaction');
                                setIsUpdating(true);
                              }}
                              className="text-blue-600 hover:text-blue-700 font-bold text-sm bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 transition-colors hover:bg-blue-100"
                              title="Update Balance"
                            >
                              Update
                            </button>
                            {balance && (
                              <button
                                onClick={() => handleDeleteFeeBalance(balance.id)}
                                className="text-red-500 hover:text-red-600 p-2 bg-red-50 rounded-lg border border-red-100 transition-colors hover:bg-red-100"
                                title="Delete Balance Record"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-text-primary">Class Fee Packages</h2>
                <div className="flex gap-2">
                   {userData?.role === 'admin' && (
                    <button
                      onClick={handleRunMonthlyBilling}
                      disabled={isRunningMonthlyBilling}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-lg shadow-emerald-600/20"
                    >
                      <Calculator size={18} className={isRunningMonthlyBilling ? "animate-spin" : ""} />
                      {isRunningMonthlyBilling ? "Billing..." : "Run Monthly Billing"}
                    </button>
                   )}
                   <button
                    onClick={() => setIsAddingFeeType(true)}
                    className="flex items-center gap-2 bg-white/5 text-secondary px-4 py-2 rounded-lg hover:bg-white/10 transition-colors border border-white/10 text-sm font-medium"
                  >
                    <Tags size={18} />
                    Fee Types
                  </button>
                  <button
                    onClick={() => setIsAddingFeeGroup(true)}
                    className="flex items-center gap-2 bg-white/5 text-amber-500 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors border border-white/10 text-sm font-medium"
                  >
                    <Layers size={18} />
                    Fee Groups
                  </button>
                  <button
                    onClick={() => setIsAddingClassFee(true)}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
                  >
                    <Plus size={20} />
                    New Fee Package
                  </button>
                </div>
              </div>

              {userData?.role === 'admin' && (
                <div className="bg-bg-card p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden mb-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg">
                          <AlertTriangle size={18} />
                        </span>
                        <h3 className="font-extrabold text-text-primary text-base">Late Payment Penalty</h3>
                      </div>
                      <p className="text-xs text-text-muted max-w-2xl">
                        Automatically charge a penalty on or after the penalty day of each month to students who still have an outstanding school fee balance.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                        <span className="text-xs font-bold text-text-secondary uppercase">Status:</span>
                        <button
                          onClick={() => setIsPenaltyEnabled(!isPenaltyEnabled)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isPenaltyEnabled ? 'bg-rose-500' : 'bg-slate-700'}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${isPenaltyEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                          />
                        </button>
                        <span className={`text-xs font-bold ${isPenaltyEnabled ? 'text-rose-500' : 'text-slate-400'}`}>
                          {isPenaltyEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                        <span className="text-xs font-bold text-text-secondary uppercase">Date:</span>
                        <input
                          type="number"
                          min="1"
                          max="28"
                          value={penaltyDay}
                          onChange={(e) => setPenaltyDay(Math.max(1, Math.min(28, Number(e.target.value))))}
                          className="w-12 bg-transparent text-center text-xs font-extrabold text-primary border-b border-primary/20 focus:border-primary outline-none"
                        />
                        <span className="text-xs text-text-muted">th of month</span>
                      </div>

                      <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                        <span className="text-xs font-bold text-text-secondary uppercase">Amount:</span>
                        <span className="text-xs font-bold text-text-muted">Ksh</span>
                        <input
                          type="number"
                          min="0"
                          value={penaltyAmount}
                          onChange={(e) => setPenaltyAmount(Math.max(0, Number(e.target.value)))}
                          className="w-16 bg-transparent text-center text-xs font-extrabold text-primary border-b border-primary/20 focus:border-primary outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSavePenaltySettings}
                          disabled={isSavingPenaltySettings}
                          className="bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/10 cursor-pointer"
                        >
                          {isSavingPenaltySettings ? "Saving..." : "Save Settings"}
                        </button>

                        <button
                          onClick={() => handleApplyLatePaymentPenalties(false)}
                          disabled={isApplyingPenalties || !isPenaltyEnabled}
                          title="Run late penalties. This checks all students with outstanding balances and applies penalties if the grace day has passed."
                          className="bg-rose-600 hover:bg-rose-500 disabled:bg-rose-600/30 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 flex items-center gap-1.5 cursor-pointer"
                        >
                          {isApplyingPenalties ? (
                            <>
                              <RefreshCw size={12} className="animate-spin" />
                              Applying...
                            </>
                          ) : (
                            <>
                              <AlertCircle size={12} />
                              Apply Penalties
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleApplyLatePaymentPenalties(true)}
                          disabled={isApplyingPenalties}
                          title="Bypasses the current day-of-month check. Charges students immediately for testing/manual adjustments."
                          className="bg-amber-600/10 hover:bg-amber-600/20 text-amber-500 border border-amber-500/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Force Run
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classFees.map((fee, idx) => (
                  <div key={`${fee.id || 'fee'}_${idx}`} className="bg-bg-card p-6 rounded-2xl border border-white/5 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-bl-full flex items-center justify-center -mr-4 -mt-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Layers size={48} className="text-primary" />
                    </div>
                    
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-text-primary">{fee.title}</h3>
                        <p className="text-xs text-text-muted">{classes.find(c => String(c.id) === String(fee.classId))?.name || 'All Classes'}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {fee.feeType && (
                            <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded-md font-bold border border-primary/20 uppercase flex items-center gap-1">
                              <Tags size={10} /> {fee.feeType}
                            </span>
                          )}
                          {fee.feeGroup && (
                            <span className="text-xs px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded-md font-bold border border-amber-500/20 uppercase flex items-center gap-1">
                              <Layers size={10} /> {fee.feeGroup}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                          fee.period === 'yearly' ? 'bg-amber-500/10 text-amber-500' : 
                          fee.period === 'monthly' ? 'bg-success/10 text-success' :
                          'bg-primary/10 text-primary'
                        }`}>
                          {fee.period}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingFeeId(fee.id);
                              setClassFeeForm({
                                classId: fee.classId,
                                title: fee.title,
                                amount: fee.amount,
                                period: fee.period,
                                feeType: fee.feeType || '',
                                feeGroup: fee.feeGroup || ''
                              });
                              setIsAddingClassFee(true);
                            }}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Edit Package"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteClassFee(fee.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Package"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {fee.period === 'monthly' && (
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md w-fit">
                        <CheckCircle2 size={12} />
                        AUTO-APPLIED MONTHLY
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-6">
                      <Users size={16} className="text-gray-400" />
                      <p className="text-sm text-gray-600 font-medium">
                        {fee.classId === 'all' 
                          ? students.length 
                          : students.filter(s => (s.classIds || []).map(String).includes(String(fee.classId))).length
                        } students assigned
                      </p>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div>
                        <p className="text-3xl font-bold text-gray-900">
                          Ksh {fee.period === 'yearly' ? (Number(fee.amount) / 12).toLocaleString() : fee.period === 'semester' ? (Number(fee.amount) / 4).toLocaleString() : Number(fee.amount).toLocaleString()}
                          <span className="text-sm font-semibold text-gray-400">/month</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {fee.period === 'yearly' ? `Billed as Ksh ${Number(fee.amount).toLocaleString()} annually` : fee.period === 'semester' ? `Billed as Ksh ${Number(fee.amount).toLocaleString()} per semester` : 'Monthly installment rate'}
                        </p>
                      </div>

                      {fee.classId === 'all' && (
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Apply to Specific Class (Optional)</label>
                          <select 
                            id={`target-class-${fee.id}`}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            onChange={(e) => {
                              const val = e.target.value;
                              // We use a data attribute or similar to store temporary selection if needed, 
                              // but here we can just target the element value in onClick
                            }}
                          >
                            <option value="all">All Students</option>
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        const select = document.getElementById(`target-class-${fee.id}`) as HTMLSelectElement;
                        const targetId = select ? select.value : fee.classId;
                        handleApplyClassFee(fee, targetId);
                      }}
                      disabled={isApplyingFee}
                      className="w-full bg-blue-600 text-white font-bold py-2 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
                    >
                      {isApplyingFee ? 'Applying...' : (
                        <>
                          <CheckCircle2 size={18} />
                          {fee.classId === 'all' ? 'Apply Charges' : 'Apply to Class'}
                        </>
                      )}
                    </button>
                  </div>
                ))}
                {classFees.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <Layers size={48} className="text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">No class fee configurations yet.</p>
                    <p className="text-sm text-gray-400">Define standard fees for each class to apply them in bulk.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'structure' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-950 to-indigo-950 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl border border-white/5 shadow-blue-950/20">
                <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-5 flex items-center justify-center pointer-events-none">
                  <Layers size={200} className="text-white" />
                </div>
                <div className="relative z-10 max-w-2xl">
                  <span className="bg-blue-500/15 border border-blue-500/20 text-blue-400 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-widest mb-4 inline-block">
                    Finance Office Blueprint
                  </span>
                  <h2 className="text-3xl font-extrabold tracking-tight mb-2">College Fee Structures</h2>
                  <p className="text-blue-200/80 text-sm leading-relaxed">
                    Review official institutional billing rates, program configurations, and print official fee structures.
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-stretch justify-between bg-bg-card p-6 rounded-2xl border border-white/5 shadow-sm">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
                    Academic Course / Program
                  </label>
                  <select
                    value={structureClassId}
                    onChange={(e) => setStructureClassId(e.target.value)}
                    className="w-full bg-[#111] border border-white/5 rounded-xl px-4 py-3 text-sm font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="all">🌐 All College Course Packages</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => handlePrintFeeStructure(structureClassId)}
                    className="w-full md:w-auto bg-[#1e3a8a] text-white hover:bg-[#1e40af] transition-all px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-white/5 shadow-lg active:scale-[0.98] cursor-pointer"
                  >
                    <Printer size={16} />
                    Print Structure PDF
                  </button>
                </div>
              </div>

              {(() => {
                const filtered = classFees.filter(fee => 
                  structureClassId === 'all' || String(fee.classId) === String(structureClassId) || String(fee.classId) === 'all'
                );
                
                const activeClassName = structureClassId === 'all' 
                  ? 'All College Programs' 
                  : (classes.find(c => String(c.id) === String(structureClassId))?.name || 'Selected Class');

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-md font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                          <BookOpen size={18} className="text-primary" />
                          Fee Packages for {activeClassName}
                        </h3>
                        <span className="text-xs font-bold text-text-muted bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                          {filtered.length} Packages Found
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filtered.map((fee, idx) => (
                          <div key={fee.id || idx} className="bg-bg-card p-6 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden flex flex-col justify-between hover:border-white/15 transition-all">
                            <div>
                              <div className="flex justify-between items-start gap-4 mb-2">
                                <h4 className="font-bold text-text-primary text-sm leading-tight">{fee.title}</h4>
                                <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                  fee.period === 'yearly' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                  fee.period === 'semester' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}>
                                  {fee.period}
                                </span>
                              </div>
                              <p className="text-xs text-text-muted mb-4">
                                {classes.find(c => String(c.id) === String(fee.classId))?.name || 'All Programs'}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mb-4">
                                {fee.feeType && (
                                  <span className="text-[10px] font-bold text-text-muted bg-white/5 border border-white/5 px-2 py-0.5 rounded uppercase">
                                    Type: {fee.feeType}
                                  </span>
                                )}
                                {fee.feeGroup && (
                                  <span className="text-[10px] font-bold text-text-muted bg-white/5 border border-white/5 px-2 py-0.5 rounded uppercase">
                                    Group: {fee.feeGroup}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="border-t border-white/5 pt-4 flex items-baseline justify-between mt-auto">
                              <span className="text-xs text-text-muted">Approved Amount:</span>
                              <span className="text-xl font-black text-primary">
                                Ksh {fee.amount?.toLocaleString() || 0}
                              </span>
                            </div>
                          </div>
                        ))}
                        {filtered.length === 0 && (
                          <div className="col-span-full bg-bg-card border border-white/5 rounded-3xl p-12 text-center text-text-muted italic">
                            No approved fee structures found for this program.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                      <div className="bg-bg-card p-6 rounded-2xl border border-white/5 shadow-sm">
                        <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
                          <Sparkles size={16} className="text-primary" />
                          Finance Guidelines
                        </h3>
                        <div className="space-y-4 text-xs text-text-muted leading-relaxed">
                          <div>
                            <p className="font-bold text-text-secondary uppercase tracking-wider text-[10px] mb-1">📅 Installment Arrangements</p>
                            <p>Tuition fees can be subdivided into custom monthly installments upon authorization. Approved plans are added automatically to student portal ledgers.</p>
                          </div>
                          <div>
                            <p className="font-bold text-text-secondary uppercase tracking-wider text-[10px] mb-1">🏦 Direct Bank Deposits</p>
                            <div className="bg-bg-card border border-white/5 p-4 rounded-2xl space-y-1.5 my-2 text-text-primary shadow-inner">
                              <p className="font-black text-xs text-primary tracking-wide">BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-bold text-text-muted">A/C No:</span>
                                <span className="font-mono text-sm font-black text-text-primary bg-white/5 border border-white/5 px-2 py-0.5 rounded-lg select-all">032000025240</span>
                              </div>
                              <p className="text-[10px] font-bold text-text-muted">Branch: Thika Makongeni</p>
                            </div>
                            <p className="mt-2">Direct bank payments require the official Admission Number as the payment reference. Hand-delivered cash is strictly prohibited on campus grounds.</p>
                          </div>
                          <div>
                            <p className="font-bold text-text-secondary uppercase tracking-wider text-[10px] mb-1">🛡️ Clinical Attachments</p>
                            <p>All institutional core fee modules must be fully resolved before student clearance for clinical attachments or evaluation sessions.</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-6 text-amber-200">
                        <div className="flex gap-3">
                          <span className="text-2xl mt-0.5">💡</span>
                          <div>
                            <h4 className="font-bold text-sm text-amber-300 mb-1">Instalment Calculation</h4>
                            <p className="text-xs text-amber-200/80 leading-relaxed">
                              If students clear their tuition fee in smaller custom increments, they are immediately logged on their statement ledger under transaction history.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'reports' && reportStats && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-wrap gap-4 mb-6">
                <button 
                  onClick={() => handlePrintReport(reportStats)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest"
                >
                  <Printer size={16} /> Financial Summary
                </button>
                <button 
                  onClick={() => handleDetailedReport('due')}
                  className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold text-xs shadow-sm hover:bg-gray-50 transition-all uppercase tracking-widest"
                >
                  <BookOpen size={16} className="text-blue-500" /> Fees Due Report
                </button>
                <button 
                  onClick={() => handleDetailedReport('payments')}
                  className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold text-xs shadow-sm hover:bg-gray-50 transition-all uppercase tracking-widest"
                >
                  <CreditCard size={16} className="text-emerald-500" /> Payment Report
                </button>
                <button 
                  onClick={() => handleDetailedReport('balance')}
                  className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold text-xs shadow-sm hover:bg-gray-50 transition-all uppercase tracking-widest"
                >
                  <Wallet size={16} className="text-amber-500" /> Balance Report
                </button>
                <button 
                  onClick={() => handleDetailedReport('overpaid')}
                  className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl font-bold text-xs shadow-sm hover:bg-emerald-100 transition-all uppercase tracking-widest flex-shrink-0"
                  title="Students who have paid more than required"
                >
                  <Sparkles size={16} className="text-emerald-600" /> Prepayments Report
                </button>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {/* 1. Money Paid */}
                <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Money Paid (This Month)</p>
                    <h3 className="text-2xl font-bold text-emerald-600">Ksh {reportStats.monthCollected.toLocaleString()}</h3>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-50 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-teal-600 text-xs font-bold">
                      <CheckCircle2 size={14} />
                      <span>On-Time (Days 1-5): Ksh {reportStats.monthCollectedOnTime.toLocaleString()}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold">
                      {reportStats.monthCollected > 0 ? ((reportStats.monthCollectedOnTime / reportStats.monthCollected) * 100).toFixed(0) : 0}% of collections made on-time (1st-5th)
                    </span>
                  </div>
                </div>

                {/* 2. Money Overpaid */}
                <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Money Overpaid (Prepaid)</p>
                    <h3 className="text-2xl font-bold text-blue-600">Ksh {reportStats.totalPrepaidCredits.toLocaleString()}</h3>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 text-blue-500">
                    <Sparkles size={16} />
                    <span className="text-xs font-bold">{reportStats.totalOverpaidStudentsCount} Accounts with Credits</span>
                  </div>
                </div>

                {/* 3. Money Not Paid */}
                <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Money Not Paid (Outstanding)</p>
                    <h3 className="text-2xl font-bold text-red-500">Ksh {reportStats.totalOutstandingDue.toLocaleString()}</h3>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 text-red-500">
                    <XCircle size={16} />
                    <span className="text-xs font-bold">{reportStats.totalDueStudentsCount} Students with Arrears</span>
                  </div>
                </div>

                {/* 4. Expenses */}
                <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Expenses (This Month)</p>
                    <h3 className="text-2xl font-bold text-rose-500">Ksh {reportStats.monthExpenses.toLocaleString()}</h3>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 text-rose-500">
                    <ArrowUpRight size={16} />
                    <span className="text-xs font-bold">Total operational outflows</span>
                  </div>
                </div>

                {/* 5. Net Profit / Cash Position */}
                <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Net Cash Position</p>
                    <h3 className={`text-2xl font-bold ${(reportStats.monthCollected - reportStats.monthExpenses) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      Ksh {(reportStats.monthCollected - reportStats.monthExpenses).toLocaleString()}
                    </h3>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 text-gray-500">
                    <TrendingUp size={16} className={(reportStats.monthCollected - reportStats.monthExpenses) >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                    <span className="text-xs font-bold">Net Cash Flow (Paid - Expenses)</span>
                  </div>
                </div>
              </div>

              {/* BRAND NEW CLASS FEES REPORT SECTION (REQUESTED BY USER) */}
              <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
                  <div>
                    <span className="text-[10px] bg-purple-50 text-purple-600 font-extrabold uppercase px-2.5 py-1 rounded-md tracking-wider">
                      Dynamic Class-by-Class Fees Ledger
                    </span>
                    <h2 className="text-xl font-extrabold text-gray-900 tracking-tight mt-1.5">
                      Class Fees Audit Reports
                    </h2>
                    <p className="text-xs text-gray-400 font-medium">
                      Select or search for any of our {classes.length} classes, such as <b>Cosmetology</b>, to immediately audit current overall paid, unpaid, and overpaid statistics with detailed student records.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search classes..."
                        value={auditSearchQuery}
                        onChange={(e) => setAuditSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2.5 w-60 border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder-gray-400 bg-gray-50/50"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {classes
                    .filter(cls => !auditSearchQuery ? true : cls.name.toLowerCase().includes(auditSearchQuery.toLowerCase()))
                    .map(cls => {
                      const stats = getClassStats(cls.id);
                      const isExpanded = auditSelectedClassId === cls.id;
                      
                      // Percentages
                      const paidPct = stats.totalStudents > 0 ? (stats.paidCount / stats.totalStudents) * 100 : 0;
                      const unpaidPct = stats.totalStudents > 0 ? (stats.unpaidCount / stats.totalStudents) * 100 : 0;
                      const overpaidPct = stats.totalStudents > 0 ? (stats.overpaidCount / stats.totalStudents) * 100 : 0;

                      return (
                        <div 
                          key={cls.id}
                          className={`group rounded-2xl border transition-all duration-300 ${
                            isExpanded 
                              ? 'border-purple-200 bg-purple-50/10 shadow-md ring-1 ring-purple-100' 
                              : 'border-slate-100 hover:border-purple-200 hover:shadow-md hover:bg-slate-50/30'
                          }`}
                        >
                          {/* Card Front details */}
                          <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-bold text-slate-800 text-xs sm:text-sm group-hover:text-purple-600 transition-colors uppercase tracking-tight">
                                  {cls.name}
                                </h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{stats.totalStudents} Registered Students</p>
                              </div>
                              <button
                                onClick={() => {
                                  setAuditSelectedClassId(isExpanded ? null : cls.id);
                                }}
                                className={`p-2 rounded-xl transition-all ${
                                  isExpanded 
                                    ? 'bg-purple-600 text-white' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                                }`}
                                title="Expand Details"
                              >
                                {isExpanded ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>

                            {/* 3 Status mini counters */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-100">
                                <p className="text-[9px] font-black text-emerald-800 uppercase tracking-widest leading-none">Paid</p>
                                <p className="text-sm font-extrabold text-emerald-600 mt-1">{stats.paidCount}</p>
                                <p className="text-[9px] text-emerald-700/80 font-bold mt-0.5">{paidPct.toFixed(0)}%</p>
                              </div>
                              <div className="bg-rose-50 rounded-xl p-2 border border-rose-100">
                                <p className="text-[9px] font-black text-rose-800 uppercase tracking-widest leading-none">Unpaid</p>
                                <p className="text-sm font-extrabold text-rose-500 mt-1">{stats.unpaidCount}</p>
                                <p className="text-[9px] text-rose-700/80 font-bold mt-0.5">{unpaidPct.toFixed(0)}%</p>
                              </div>
                              <div className="bg-sky-50 rounded-xl p-2 border border-sky-100">
                                <p className="text-[9px] font-black text-sky-800 uppercase tracking-widest leading-none">Overpaid</p>
                                <p className="text-sm font-extrabold text-sky-600 mt-1">{stats.overpaidCount}</p>
                                <p className="text-[9px] text-sky-700/80 font-bold mt-0.5">{overpaidPct.toFixed(0)}%</p>
                              </div>
                            </div>

                            {/* Dynamic visual progress strip */}
                            <div className="h-2 rounded-full bg-slate-100 flex overflow-hidden">
                              <div className="bg-emerald-500" style={{ width: `${paidPct}%` }} title={`Paid: ${paidPct.toFixed(0)}%`} />
                              <div className="bg-rose-500" style={{ width: `${unpaidPct}%` }} title={`Unpaid: ${unpaidPct.toFixed(0)}%`} />
                              <div className="bg-sky-500" style={{ width: `${overpaidPct}%` }} title={`Overpaid: ${overpaidPct.toFixed(0)}%`} />
                            </div>

                            {/* Summaries of money volumes */}
                            <div className="space-y-1.5 pt-1 text-xs font-semibold text-slate-500">
                              <div className="flex justify-between">
                                <span>Unpaid Arrears:</span>
                                <span className="text-rose-500 font-extrabold">Ksh {stats.totalOutstanding.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Prepaid Credits:</span>
                                <span className="text-sky-600 font-extrabold">Ksh {stats.totalPrepaid.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action footer */}
                          <div className="bg-slate-50/80 px-6 py-3.5 border-t border-slate-100 rounded-b-2xl flex items-center justify-between">
                            <button
                              onClick={() => handlePrintClassReport(cls, stats, 'all')}
                              className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider flex items-center gap-1 hover:text-purple-700 hover:underline cursor-pointer"
                            >
                              <Printer size={13} /> Print Class Summary
                            </button>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                              Ksh {stats.totalPaid.toLocaleString()} collected
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  {classes.filter(cls => !auditSearchQuery ? true : cls.name.toLowerCase().includes(auditSearchQuery.toLowerCase())).length === 0 && (
                    <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border border-gray-150 border-dashed">
                      <p className="text-sm font-bold text-gray-400">No classes found matching the query.</p>
                    </div>
                  )}
                </div>

                {/* Expanded class details table */}
                {auditSelectedClassId && (() => {
                  const targetClass = classes.find(c => c.id === auditSelectedClassId);
                  if (!targetClass) return null;
                  
                  const stats = getClassStats(targetClass.id);
                  const filteredStudents = stats.studentsDetails.filter((s: any) => {
                    if (auditStatusFilter === 'paid') return s.status === 'paid';
                    if (auditStatusFilter === 'unpaid') return s.status === 'unpaid';
                    if (auditStatusFilter === 'overpaid') return s.status === 'overpaid';
                    if (auditStatusFilter === 'paid_this_month') return s.paidThisMonth;
                    return true;
                  });

                  return (
                    <div className="bg-slate-50/50 rounded-3xl p-6 sm:p-8 space-y-6 border border-purple-100 animate-in fade-in duration-300">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-purple-600 font-extrabold text-white uppercase px-2.5 py-0.5 rounded-full">
                              Active Audit focus
                            </span>
                            <span className="text-xs text-gray-400 font-bold">
                              {stats.totalStudents} total students
                            </span>
                          </div>
                          <h3 className="text-lg font-black text-slate-800 uppercase mt-1 tracking-tight">
                            {targetClass.name} Ledger Details
                          </h3>
                        </div>

                        {/* Filter toolbar inside expander */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setAuditStatusFilter('all')}
                            className="px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border cursor-pointer bg-slate-800 text-white border-slate-800 shadow-sm"
                          >
                            All ({stats.totalStudents})
                          </button>
                          <button
                            onClick={() => setAuditStatusFilter('paid_this_month')}
                            className="px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border cursor-pointer bg-teal-600 text-white border-teal-600 shadow-sm"
                          >
                            Paid This Month ({stats.paidThisMonthCount || 0})
                          </button>
                          <button
                            onClick={() => setAuditStatusFilter('paid')}
                            className="px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border cursor-pointer bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          >
                            Paid / Cleared ({stats.paidCount})
                          </button>
                          <button
                            onClick={() => setAuditStatusFilter('unpaid')}
                            className="px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border cursor-pointer bg-rose-500 text-white border-rose-500 shadow-sm"
                          >
                            Unpaid ({stats.unpaidCount})
                          </button>
                          <button
                            onClick={() => setAuditStatusFilter('overpaid')}
                            className="px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border cursor-pointer bg-sky-500 text-white border-sky-500 shadow-sm"
                          >
                            Overpaid ({stats.overpaidCount})
                          </button>
                          
                          <button
                            onClick={() => handlePrintClassReport(targetClass, stats, auditStatusFilter)}
                            className="bg-white hover:bg-purple-50 text-purple-600 border border-purple-200 px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm ml-auto cursor-pointer"
                          >
                            <Printer size={14} /> Print Detailed PDF
                          </button>
                        </div>
                      </div>

                      {/* Actual Table */}
                      <div className="overflow-hidden border border-slate-100 bg-white shadow-xs rounded-2xl">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                              <tr>
                                <th className="px-6 py-4">Student Info</th>
                                <th className="px-6 py-4 text-right">Lifetime Billed</th>
                                <th className="px-6 py-4 text-right">Total Payments Made</th>
                                <th className="px-6 py-4 text-right">Account Balance</th>
                                <th className="px-8 py-4 text-right">Status & Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredStudents.map((s) => (
                                <tr key={s.uid} className="hover:bg-slate-50/40 transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                                        {s.name.charAt(0)}
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold text-slate-800 leading-tight">{s.name}</p>
                                        <p className="text-[10px] text-gray-400 font-bold mt-0.5">ADM: <span className="font-mono text-slate-600">{s.admNo}</span></p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right text-xs font-bold text-slate-700">
                                    Ksh {s.totalAmount.toLocaleString()}
                                  </td>
                                  <td className="px-6 py-4 text-right text-xs font-bold text-emerald-600">
                                    Ksh {s.paidAmount.toLocaleString()}
                                  </td>
                                  <td className="px-6 py-4 text-right text-xs font-extrabold">
                                    <span className={
                                      s.balance > 0 
                                        ? 'text-rose-500' 
                                        : s.balance < 0 
                                          ? 'text-sky-600' 
                                          : 'text-slate-500'
                                    }>
                                      Ksh {s.balance.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="px-8 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {s.paidThisMonth && (
                                        <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-100">
                                          Paid This Month
                                        </span>
                                      )}
                                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${
                                        s.status === 'paid' 
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                          : s.status === 'unpaid' 
                                            ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                                            : 'bg-sky-50 text-sky-700 border border-sky-100'
                                      }`}>
                                        {s.status === 'paid' ? 'Cleared' : s.status === 'unpaid' ? 'Outstanding' : 'Prepaid Credit'}
                                      </span>
                                      <button 
                                        onClick={() => {
                                          const userObj = students.find(stud => stud.uid === s.uid);
                                          if (userObj) {
                                            setSelectedStudent(userObj);
                                            // Select Individual tab to manage their statement
                                            setActiveTab('individual');
                                          }
                                        }}
                                        className="text-[10px] font-black text-purple-600 uppercase tracking-widest hover:text-purple-700 hover:underline cursor-pointer"
                                      >
                                        Inspect
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {filteredStudents.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                                    No student records found matching the active filter.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                        <Wallet size={20} />
                      </div>
                      <h3 className="font-bold text-gray-900 uppercase tracking-tight text-sm">Class Monthly Expected Revenue</h3>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <tr>
                          <th className="px-6 py-4">Class</th>
                          <th className="px-6 py-4">Monthly Rate / Student</th>
                          <th className="px-6 py-4">Expected Monthly Billing</th>
                          <th className="px-6 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {reportStats.classBreakdown.sort((a,b) => b.projected - a.projected).map((cls, idx) => (
                          <tr key={`${cls.id || 'cls'}_${idx}`} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-gray-900">{cls.name}</p>
                              <p className="text-xs text-gray-400 font-bold uppercase tracking-tight">{cls.count} Students</p>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-gray-900">
                              Ksh {cls.monthlyRate.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-indigo-600">
                              Ksh {cls.projected.toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                Active Structure
                              </span>
                            </td>
                          </tr>
                        ))}
                        {reportStats.classBreakdown.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No classes found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>   </div>

                <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 uppercase tracking-tight text-sm">Class Monthly Performance</h3>
                    <button 
                      onClick={() => handlePrintReport(reportStats)}
                      className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:underline"
                    >
                      <Printer size={14} /> Print Monthly Report
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <tr>
                          <th className="px-6 py-4">Class</th>
                          <th className="px-6 py-4">Invoiced (Month)</th>
                          <th className="px-6 py-4">Paid (Month)</th>
                          <th className="px-6 py-4">Balance (Month)</th>
                          <th className="px-12 py-4">Efficiency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {reportStats.classBreakdown.map((cls, idx) => {
                          const rate = cls.monthCharged > 0 ? (cls.monthCollected / cls.monthCharged) * 100 : 100;
                          const monthlyBal = cls.monthCharged - cls.monthCollected;
                          return (
                            <tr key={`${cls.id || 'cls'}_${idx}`} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="text-sm font-bold text-gray-900">{cls.name}</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {units.filter(s => s.classId === cls.id).map((s, sIdx) => (
                                    <span key={`${s.id || 'unit'}_${sIdx}`} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md font-bold border border-blue-100 uppercase">
                                      {s.name}
                                    </span>
                                  ))}
                                </div>
                                <p className="text-xs text-gray-400 font-bold mt-1">{cls.count} Students</p>
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-gray-900">
                                Ksh {cls.monthCharged.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-emerald-600">
                                Ksh {cls.monthCollected.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-red-600">
                                Ksh {monthlyBal.toLocaleString()}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                                    <div 
                                      className={`h-full rounded-full ${rate >= 90 ? 'bg-emerald-500' : rate > 50 ? 'bg-amber-500' : 'bg-red-500'}`} 
                                      style={{ width: `${Math.min(100, rate)}%` }} 
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-gray-500">{rate.toFixed(0)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-gray-50">
                    <h3 className="font-bold text-gray-900 uppercase tracking-tight text-sm">Recent Payments</h3>
                  </div>
                  <div className="divide-y divide-gray-50 flex-1">
                    {reportStats.allPayments.map((payment, idx) => (
                      <div key={`${payment.date}_${idx}`} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <TrendingUp size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{payment.studentName}</p>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-tight">
                              {format(new Date(payment.date), 'MMM dd, HH:mm')} • {payment.description}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <p className="text-sm font-bold text-emerald-600">Ksh {payment.amount.toLocaleString()}</p>
                            <p className="text-xs font-bold text-gray-400 uppercase">Paid</p>
                          </div>
                          <button
                            onClick={() => {
                              const student = students.find(s => s.uid === payment.studentId);
                              const balance = feeBalances.find(b => b.studentId === payment.studentId);
                              if (student && balance) {
                                handlePrintReceipt(student, payment, {
                                  total: balance.totalAmount,
                                  paid: balance.paidAmount,
                                  remaining: balance.balance
                                });
                              } else {
                                addToast("Could not retrieve full student record for printing", "error");
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Print Receipt"
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {reportStats.allPayments.length === 0 && (
                      <div className="p-12 text-center text-gray-400 italic">No recent payments recorded.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className={`p-8 rounded-3xl text-center border transition-all ${
              computedStudentBalance < 0 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-white border-gray-100 text-gray-900 shadow-sm'
            }`}>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                computedStudentBalance < 0 ? 'bg-emerald-400/20 text-emerald-400 animate-bounce' : 'bg-blue-50 text-blue-600'
              }`}>
                { computedStudentBalance < 0 ? <Sparkles size={32} /> : <Wallet size={32} /> }
              </div>
              <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${ computedStudentBalance < 0 ? 'text-emerald-400' : 'text-gray-400' }`}>
                { computedStudentBalance < 0 ? 'Available Prepaid Credit' : 'Current Balance' }
              </p>
              <h2 className={`text-4xl font-extrabold mb-3 tracking-tight ${
                computedStudentBalance > 0 
                  ? 'text-rose-500' 
                  : computedStudentBalance < 0 
                    ? 'text-emerald-400' 
                    : 'text-gray-400'
              }`}>
                Ksh { computedStudentBalance < 0 ? Math.abs(computedStudentBalance).toLocaleString() : computedStudentBalance.toLocaleString() }
              </h2>
              { computedStudentBalance < 0 && (
                <p className="text-xs text-emerald-400 font-medium mb-4 bg-emerald-500/10 py-1.5 px-3 rounded-lg inline-block border border-emerald-500/20">
                  🎉 You have pre-paid your fees! This credit covers future invoices automatically.
                </p>
              )}
              { computedStudentBalance > 0 && totalPenalties > 0 && (
                <div className="text-xs text-rose-500 font-bold mb-4 bg-rose-500/10 py-2.5 px-3 rounded-xl border border-rose-500/20 text-left flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-500" />
                  <div>
                    <span className="block font-black text-rose-600 uppercase tracking-wide text-[10px] mb-0.5">Late Penalty Charges</span>
                    <span>Your outstanding balance includes <strong className="font-extrabold text-rose-600">Ksh {totalPenalties.toLocaleString()}</strong> in late payment penalties.</span>
                  </div>
                </div>
              )}
              <div className={`grid grid-cols-2 gap-4 pt-6 border-t ${ computedStudentBalance < 0 ? 'border-emerald-500/15' : 'border-gray-50' }`}>
                <div>
                  <p className={`text-xs mb-1 ${ computedStudentBalance < 0 ? 'text-emerald-500/70' : 'text-gray-400' }`}>Total Invoiced</p>
                  <p className={`text-lg font-bold ${ computedStudentBalance < 0 ? 'text-white' : 'text-gray-800' }`}>Ksh {myBalance?.totalAmount?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className={`text-xs mb-1 ${ computedStudentBalance < 0 ? 'text-emerald-500/70' : 'text-gray-400' }`}>Total Paid</p>
                  <p className="text-lg font-bold text-green-500">Ksh {myBalance?.paidAmount?.toLocaleString() || 0}</p>
                </div>
              </div>

              {myBalance && (
                <div className="space-y-2 mt-6">
                  <button
                    onClick={() => {
                      const studentProfile = { name: studentContext?.name || 'Student', email: studentContext?.email || '', admissionNumber: studentContext?.admissionNumber, phone: studentContext?.phone, guardianName: studentContext?.guardianName, guardianPhone: studentContext?.guardianPhone, classIds: studentContext?.classIds } as User;
                      handlePrintFeesInvoice(studentProfile, myBalance);
                    }}
                    className="w-full bg-[#1e3a8a] text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-[#1e40af] transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <FileText size={16} className="text-blue-200" />
                    Print Fees Invoice
                  </button>
                  <button
                    onClick={() => {
                      const studentProfile = { name: studentContext?.name || 'Student', email: studentContext?.email || '', admissionNumber: studentContext?.admissionNumber, phone: studentContext?.phone, guardianName: studentContext?.guardianName, guardianPhone: studentContext?.guardianPhone, classIds: studentContext?.classIds } as User;
                      handlePrintStudentStatement(studentProfile, myBalance);
                    }}
                    className="w-full bg-[#111] text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-black transition-all flex items-center justify-center gap-2 border border-white/5 active:scale-[0.98]"
                  >
                    <FileText size={16} className="text-emerald-400" />
                    Print Statement of Account
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                <BookOpen size={16} className="text-blue-600" />
                Fees Breakdown
              </h3>
              <div className="space-y-3">
                {myBalance?.history?.filter(h => h.type === 'charge').reduce((acc: any[], current) => {
                  const existing = acc.find(item => item.description === current.description);
                  if (existing) {
                    existing.amount += current.amount;
                  } else {
                    acc.push({ description: current.description, amount: current.amount });
                  }
                  return acc;
                }, []).map((charge, idx) => {
                  const isChargePenalty = charge.description?.toLowerCase().includes('penalty') || charge.description?.toLowerCase().includes('late payment');
                  return (
                    <div key={idx} className={`flex justify-between items-center py-2 border-b border-gray-50 last:border-0 ${isChargePenalty ? 'bg-rose-500/5 -mx-2 px-2 rounded-lg border-l-2 border-rose-500' : ''}`}>
                      <span className="text-sm text-gray-600 flex flex-wrap items-center gap-1.5">
                        {charge.description}
                        {isChargePenalty && (
                          <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Penalty
                          </span>
                        )}
                      </span>
                      <span className={`text-sm font-bold ${isChargePenalty ? 'text-rose-600' : 'text-gray-900'}`}>Ksh {charge.amount.toLocaleString()}</span>
                    </div>
                  );
                })}
                {(!myBalance?.history || myBalance.history.filter(h => h.type === 'charge').length === 0) && (
                  <p className="text-xs text-gray-400 italic text-center py-4">No fee breakdown available.</p>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-900/10 border border-blue-500/15">
              <h3 className="text-lg font-extrabold tracking-tight mb-2">Payment Methods</h3>
              <p className="text-blue-100 text-sm mb-4">You can pay your fees via direct bank deposit or transfer:</p>
              
              <div className="bg-white/10 border border-white/20 p-4 rounded-xl space-y-2.5 shadow-inner">
                <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Official Bank Account
                </span>
                <div className="space-y-1">
                  <p className="font-extrabold text-sm tracking-tight text-white leading-tight">BREAKTHROUGH INTERNATIONAL TRAINING COLLEGE</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-bold text-blue-200 uppercase">A/C No:</span>
                    <p className="font-mono text-sm font-black text-white bg-blue-950/30 border border-white/10 px-2.5 py-1 rounded-lg select-all">032000025240</p>
                  </div>
                  <p className="text-xs font-semibold text-blue-200">Branch: Thika Makongeni</p>
                </div>
              </div>
              <p className="text-[11px] text-blue-100/95 leading-relaxed mt-4 bg-blue-700/30 p-2.5 rounded-xl border border-blue-500/10">
                ⚠️ <strong>Reference Note:</strong> Please specify your official <strong>Admission Number</strong> as the reference/narrative on all deposits. Cash payments on campus are strictly prohibited.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <History size={20} className="text-gray-400" />
              <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
            </div>
            <div className="bg-bg-card rounded-2xl shadow-xl border border-white/5 overflow-hidden">
              <div className="divide-y divide-gray-50">
                {myBalance?.history?.slice().reverse().map((item, idx) => {
                  const isPenaltyItem = item.type === 'charge' && (item.description?.toLowerCase().includes('penalty') || item.description?.toLowerCase().includes('late payment'));
                  return (
                    <div key={item.date + idx} className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${isPenaltyItem ? 'bg-rose-500/5 border-l-4 border-rose-500' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          item.type === 'payment' ? 'bg-green-50 text-green-600' : isPenaltyItem ? 'bg-rose-100 text-rose-600 font-extrabold' : 'bg-red-50 text-red-600'
                        }`}>
                          {item.type === 'payment' ? (
                            <ArrowDownLeft size={20} />
                          ) : isPenaltyItem ? (
                            <AlertCircle size={20} className="text-rose-600" />
                          ) : (
                            <ArrowUpRight size={20} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 flex flex-wrap items-center gap-1.5">
                            {item.description}
                            {isPenaltyItem && (
                              <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                LATE PENALTY
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">{format(new Date(item.date), 'MMM dd, yyyy HH:mm')}</p>
                          {item.attachmentUrl && (
                            <a 
                              href={item.attachmentUrl.startsWith('http') ? `/api/download?url=${encodeURIComponent(item.attachmentUrl)}&filename=${encodeURIComponent(item.attachmentName || 'attachment')}` : item.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline mt-1 bg-blue-50 px-2 py-0.5 rounded w-fit"
                            >
                              <FileText size={10} />
                              VIEW ATTACHMENT
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className={`text-sm font-bold ${item.type === 'payment' ? 'text-green-600' : isPenaltyItem ? 'text-rose-600' : 'text-red-600'}`}>
                            {item.type === 'payment' ? '-' : '+'}Ksh {item.amount}
                          </p>
                          <p className="text-xs text-gray-400 uppercase font-bold">{isPenaltyItem ? 'penalty' : item.type}</p>
                        </div>
                      </div>
                      {item.type === 'payment' && (
                        <button
                          onClick={() => {
                            const studentProfile = isAdminView 
                              ? students.find(s => s.uid === myBalance?.studentId) 
                              : { name: studentContext?.name || 'Student', email: studentContext?.email || '', admissionNumber: studentContext?.admissionNumber } as User;
                            
                            handlePrintReceipt(
                              studentProfile as User,
                              item,
                              {
                                total: myBalance?.totalAmount || 0,
                                paid: myBalance?.paidAmount || 0,
                                remaining: myBalance?.balance || 0
                              }
                            );
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Print Receipt"
                        >
                          <Printer size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {(!myBalance?.history || myBalance.history.length === 0) && (
                  <div className="p-12 text-center text-gray-400 italic">
                    No transactions recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isAddingClassFee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsAddingClassFee(false)}
            />
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="relative bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">{editingFeeId ? 'Edit Fee Package' : 'Define Class Fee'}</h2>
                <button 
                  onClick={() => {
                    setIsAddingClassFee(false);
                    setEditingFeeId(null);
                    setClassFeeForm({ classId: '', title: '', amount: 0, period: 'monthly', feeType: '', feeGroup: '' });
                  }} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateClassFee} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fee Type</label>
                    <div className="flex gap-2">
                      <select
                        value={classFeeForm.feeType || ''}
                        onChange={(e) => setClassFeeForm(prev => ({ ...prev, feeType: e.target.value }))}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                      >
                        <option value="">None</option>
                        {feeTypes.map(ft => (
                          <option key={ft.id} value={ft.name}>{ft.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fee Group</label>
                    <div className="flex gap-2">
                      <select
                        value={classFeeForm.feeGroup || ''}
                        onChange={(e) => setClassFeeForm(prev => ({ ...prev, feeGroup: e.target.value }))}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                      >
                        <option value="">None</option>
                        {feeGroups.map(fg => (
                          <option key={fg.id} value={fg.name}>{fg.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fee Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 2026 First Semester Tuition"
                    value={classFeeForm.title || ''}
                    onChange={(e) => setClassFeeForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Class</label>
                  <select
                    required
                    value={classFeeForm.classId || ''}
                    onChange={(e) => setClassFeeForm(prev => ({ ...prev, classId: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">Select Class</option>
                    <option value="all">Apply to All Classes</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Ksh)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      value={classFeeForm.amount || 0}
                      onChange={(e) => setClassFeeForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                    <select
                      value={classFeeForm.period || 'monthly'}
                      onChange={(e) => setClassFeeForm(prev => ({ ...prev, period: e.target.value as 'semester' | 'yearly' | 'monthly' }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="semester">Semester</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>

                {classFeeForm.period === 'monthly' && (
                  <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-xs font-medium space-y-1">
                    <p className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 size={14} />
                      Automation Active
                    </p>
                    <p>✅ This fee will be automatically applied to all target students on the 1st of every month.</p>
                    <p>✅ Duplicate charges are automatically prevented.</p>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  {editingFeeId ? <CheckCircle2 size={18} /> : <Plus size={18} />}
                  {editingFeeId ? 'Update Configuration' : 'Create Configuration'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student History Modal */}
      <AnimatePresence>
        {isHistoryOpen && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                setIsHistoryOpen(false);
                setSelectedStudent(null);
              }}
            />
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="relative bg-white rounded-2xl p-8 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
                  <p className="text-sm text-gray-500">{selectedStudent.name} ({selectedStudent.email})</p>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const studentBalance = feeBalances.find(b => b.studentId === selectedStudent.uid);
                    return studentBalance ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePrintFeesInvoice(selectedStudent, studentBalance)}
                          className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm hover:bg-blue-100 transition-all uppercase tracking-wider"
                        >
                          <Printer size={14} />
                          Print Invoice
                        </button>
                        <button
                          onClick={() => handlePrintStudentStatement(selectedStudent, studentBalance)}
                          className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm hover:bg-emerald-100 transition-all uppercase tracking-wider"
                        >
                          <Printer size={14} />
                          Print Statement
                        </button>
                      </div>
                    ) : null;
                  })()}
                  <button 
                    onClick={() => {
                      setIsHistoryOpen(false);
                      setSelectedStudent(null);
                    }} 
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 shadow-inner bg-gray-50/30 rounded-xl">
                {(() => {
                  const studentBalance = feeBalances.find(b => b.studentId === selectedStudent.uid);
                  if (!studentBalance || !studentBalance.history || studentBalance.history.length === 0) {
                    return <div className="text-center py-12 text-gray-400 italic">No transactions found for this student.</div>;
                  }

                  const studentPenalties = studentBalance.history?.filter(h => h.type === 'charge' && (h.description?.toLowerCase().includes('penalty') || h.description?.toLowerCase().includes('late payment'))).reduce((sum, h) => sum + h.amount, 0) || 0;

                  return (
                    <div className="p-1 space-y-4">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Invoiced</p>
                          <p className="text-lg font-bold text-gray-900">Ksh {studentBalance.totalAmount.toLocaleString()}</p>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm text-emerald-600">
                          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Total Paid</p>
                          <p className="text-lg font-bold">Ksh {studentBalance.paidAmount.toLocaleString()}</p>
                        </div>
                        <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 shadow-sm text-rose-600">
                          <p className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-1">Penalties Charged</p>
                          <p className="text-lg font-bold">Ksh {studentPenalties.toLocaleString()}</p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm text-red-600">
                          <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1">Balance</p>
                          <p className="text-lg font-bold">Ksh {(studentBalance.totalAmount - studentBalance.paidAmount).toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-white/5 border-b border-white/5">
                            <tr>
                              <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Date</th>
                              <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Description</th>
                              <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-right">Amount</th>
                              <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {studentBalance.history.slice().reverse().map((item, id) => {
                              // Calculate original index because we sliced and reversed
                              const originalIdx = studentBalance.history.length - 1 - id;
                              const isPenaltyItem = item.type === 'charge' && (item.description?.toLowerCase().includes('penalty') || item.description?.toLowerCase().includes('late payment'));
                              return (
                                <tr key={item.date + originalIdx} className={`hover:bg-gray-50 transition-colors ${isPenaltyItem ? 'bg-rose-500/5' : ''}`}>
                                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                                    {format(new Date(item.date), 'MMM dd, yyyy')}
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="font-bold text-gray-900 leading-none flex items-center gap-1.5 flex-wrap">
                                      {item.description}
                                      {isPenaltyItem && (
                                        <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                          Penalty
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-xs text-gray-400 uppercase font-bold mt-1">{isPenaltyItem ? 'penalty' : item.type}</p>
                                  </td>
                                  <td className={`px-4 py-3 text-right font-bold ${item.type === 'payment' ? 'text-emerald-600' : isPenaltyItem ? 'text-rose-600' : 'text-red-600'}`}>
                                    {item.type === 'payment' ? '-' : '+'}Ksh {item.amount.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => handleEditHistoryItem(selectedStudent, item, originalIdx)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Edit Transaction"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteHistoryItem(selectedStudent.uid, originalIdx)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Transaction"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                      {item.type === 'payment' && (
                                        <button
                                          onClick={() => handlePrintReceipt(selectedStudent, item, {
                                            total: studentBalance.totalAmount,
                                            paid: studentBalance.paidAmount,
                                            remaining: studentBalance.balance
                                          })}
                                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-1 border border-transparent hover:border-emerald-100"
                                          title="Print Receipt"
                                        >
                                          <Printer size={14} />
                                          <span className="text-[10px] font-bold uppercase">Receipt</span>
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Update Balance Modal */}
      <AnimatePresence>
        {isUpdating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                setIsUpdating(false);
                setSelectedStudent(null);
              }}
            />
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="relative bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl animate-fade-in"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingHistoryIndex !== null 
                    ? 'Edit Transaction' 
                    : updateMode === 'direct' 
                      ? 'Edit Individual Student Fees' 
                      : 'Update Fee Balance'}
                </h2>
                <button 
                  onClick={() => {
                    setIsUpdating(false);
                    setSelectedStudent(null);
                    setEditingHistoryIndex(null);
                  }} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle size={24} />
                </button>
              </div>

              {editingHistoryIndex === null && (
                <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                  <button
                    type="button"
                    onClick={() => setUpdateMode('transaction')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                      updateMode === 'transaction'
                        ? 'bg-white text-gray-900 shadow-sm border border-black/5'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Log Transaction
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateMode('direct')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                      updateMode === 'direct'
                        ? 'bg-white text-gray-900 shadow-sm border border-black/5'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Direct Edit Totals
                  </button>
                </div>
              )}

              <form onSubmit={handleUpdateBalance} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                  {selectedStudent ? (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                        {selectedStudent.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{selectedStudent.name}</span>
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedStudent?.uid || ''}
                      onChange={(e) => setSelectedStudent(students.find(s => s.uid === e.target.value) || null)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="">Select Student</option>
                      {students.map((s, idx) => (
                        <option key={`${s.uid || 's'}_${idx}`} value={s.uid}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                  )}
                </div>

                {updateMode === 'transaction' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select
                          value={updateForm.type || 'payment'}
                          onChange={(e) => setUpdateForm(prev => ({ ...prev, type: e.target.value as 'payment' | 'charge' }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        >
                          <option value="payment">Payment</option>
                          <option value="charge">Charge</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Ksh)</label>
                        <input
                          type="number"
                          required
                          min="1"
                          step="0.01"
                          value={updateForm.amount || 0}
                          onChange={(e) => setUpdateForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <input
                        type="text"
                        placeholder="e.g., Term 2 Fees, Library Fine"
                        value={updateForm.description || ''}
                        onChange={(e) => setUpdateForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Attach Receipt/Document (Optional)</label>
                      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all">
                        <Plus size={20} className="text-gray-400" />
                        <span className="text-sm text-gray-600 font-medium">{updateForm.file ? updateForm.file.name : 'Upload File'}</span>
                        <input type="file" className="hidden" onChange={(e) => setUpdateForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))} />
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Fees Invoiced</label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={directForm.totalAmount}
                          onChange={(e) => setDirectForm(prev => ({ ...prev, totalAmount: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Fees Paid</label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={directForm.paidAmount}
                          onChange={(e) => setDirectForm(prev => ({ ...prev, paidAmount: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50/50 border border-blue-100/50 rounded-xl">
                      <p className="text-xs text-blue-700">
                        <strong>Calculated Balance:</strong> Ksh {(directForm.totalAmount - directForm.paidAmount).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Adjustment</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Scholarship scholarship, manual reconciliation"
                        value={directForm.reason}
                        onChange={(e) => setDirectForm(prev => ({ ...prev, reason: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  {editingHistoryIndex !== null 
                    ? 'Save Changes' 
                    : updateMode === 'direct' 
                      ? 'Save Direct Adjustments' 
                      : 'Confirm Update'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingFeeType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsAddingFeeType(false)}
            />
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="relative bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Manage Fee Types</h2>
                <button onClick={() => setIsAddingFeeType(false)} className="text-gray-400 hover:text-gray-600">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateFeeType} className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{editingFeeTypeId ? 'Edit' : 'New'} Fee Type Name</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="e.g., Admission, Tuition"
                      value={newFeeTypeName || ''}
                      onChange={(e) => setNewFeeTypeName(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <button type="submit" className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors">
                      {editingFeeTypeId ? <CheckCircle2 size={20} /> : <Plus size={20} />}
                    </button>
                    {editingFeeTypeId && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingFeeTypeId(null);
                          setNewFeeTypeName('');
                        }}
                        className="bg-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        <XCircle size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </form>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {feeTypes.map((ft, idx) => (
                  <div key={`${ft.id || 'ft'}_${idx}`} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg group">
                    <span className="font-medium text-gray-900">{ft.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingFeeTypeId(ft.id);
                          setNewFeeTypeName(ft.name);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Edit Type"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteFeeType(ft.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete Type"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {feeTypes.length === 0 && <p className="text-center text-gray-500 py-4 italic text-sm">No types defined yet.</p>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingFeeGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsAddingFeeGroup(false)}
            />
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="relative bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Manage Fee Groups</h2>
                <button onClick={() => setIsAddingFeeGroup(false)} className="text-gray-400 hover:text-gray-600">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateFeeGroup} className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{editingFeeGroupId ? 'Edit' : 'New'} Fee Group Name</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="e.g., Primary, Secondary"
                      value={newFeeGroupName || ''}
                      onChange={(e) => setNewFeeGroupName(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <button type="submit" className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors">
                      {editingFeeGroupId ? <CheckCircle2 size={20} /> : <Plus size={20} />}
                    </button>
                    {editingFeeGroupId && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingFeeGroupId(null);
                          setNewFeeGroupName('');
                        }}
                        className="bg-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        <XCircle size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </form>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {feeGroups.map((fg, idx) => (
                  <div key={`${fg.id || 'fg'}_${idx}`} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg group">
                    <span className="font-medium text-gray-900">{fg.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingFeeGroupId(fg.id);
                          setNewFeeGroupName(fg.name);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Edit Group"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteFeeGroup(fg.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete Group"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {feeGroups.length === 0 && <p className="text-center text-gray-500 py-4 italic text-sm">No groups defined yet.</p>}
              </div>
            </motion.div>
          </div>
        )}

        {printConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setPrintConfirm(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[40px] p-10 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-blue-50 rounded-[32px] flex items-center justify-center mx-auto mb-8 text-blue-600 shadow-inner">
                <FileText size={40} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2 uppercase tracking-tight">Print Receipt?</h3>
              <p className="text-sm font-medium text-gray-500 mb-10 uppercase tracking-widest leading-relaxed">Payment recorded successfully. Would you like to generate an official PDF receipt for this transaction?</p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setPrintConfirm(null)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-all active:scale-95"
                >
                  Skip
                </button>
                <button 
                  onClick={() => {
                    handlePrintReceipt(printConfirm.student, printConfirm.item, printConfirm.balance);
                    setPrintConfirm(null);
                  }}
                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-primary-hover shadow-xl shadow-primary/20 transition-all active:scale-95"
                >
                  Print PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
};
