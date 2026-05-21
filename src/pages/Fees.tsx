import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, setDoc, addDoc, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { FeeBalance, User, Class, ClassFee, Unit, FeeType, FeeGroup } from '../types';
import { Wallet, Plus, History, Send, Search, Filter, CreditCard, ArrowUpRight, ArrowDownLeft, XCircle, BookOpen, Layers, CheckCircle2, Users, RefreshCw, Edit2, Trash2, Printer, TrendingUp, Tags, FileText, Sparkles, Calculator, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Toast, ToastMessage } from '../components/Toast';

export const Fees: React.FC = () => {
  const { user, userData, hasPermission, settings } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [activeTab, setActiveTab] = useState<'individual' | 'classes' | 'reports' | 'installments'>('individual');
  const [installmentStudentId, setInstallmentStudentId] = useState<string>('');
  const [courseFeeTotal, setCourseFeeTotal] = useState<number>(70000);
  const [monthlyInstalment, setMonthlyInstalment] = useState<number>(4500);
  const [installmentClassId, setInstallmentClassId] = useState<string>('');
  const [customScheduleMonths, setCustomScheduleMonths] = useState<number>(16);
  const [feeBalances, setFeeBalances] = useState<FeeBalance[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [classFees, setClassFees] = useState<ClassFee[]>([]);
  const [myBalance, setMyBalance] = useState<FeeBalance | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'outstanding' | 'overpaid'>('all');
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
  const [feeGroups, setFeeGroups] = useState<FeeGroup[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [classFeeForm, setClassFeeForm] = useState({ classId: '', title: '', amount: 0, period: 'monthly' as 'semester' | 'yearly' | 'monthly', feeType: '', feeGroup: '' });
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editingFeeTypeId, setEditingFeeTypeId] = useState<string | null>(null);
  const [editingFeeGroupId, setEditingFeeGroupId] = useState<string | null>(null);
  const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [printConfirm, setPrintConfirm] = useState<{ student: User, item: any, balance: any } | null>(null);

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
      addToast("Student fee record deleted successfully");
    } catch (error) {
      console.error("Delete fee balance error:", error);
      addToast("Failed to delete record", "error");
    }
  };

  const handlePrintStudentStatement = (student: User, balance: FeeBalance) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

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
              padding: 40px; 
              color: #1e293b; 
              line-height: 1.5; 
              background-color: #ffffff;
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
              padding-bottom: 24px;
              margin-bottom: 30px;
            }
            .school-info h1 {
              font-size: 26px;
              font-weight: 800;
              color: #1e3a8a;
              margin: 0;
              letter-spacing: -0.02em;
            }
            .school-info p {
              font-size: 11px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.15em;
              margin: 4px 0 0 0;
            }
            .doc-title {
              text-align: right;
            }
            .doc-title h2 {
              font-size: 20px;
              font-weight: 900;
              color: #0f172a;
              margin: 0;
              letter-spacing: -0.01em;
              text-transform: uppercase;
            }
            .doc-title p {
              font-size: 12px;
              color: #64748b;
              margin: 4px 0 0 0;
            }
            .profile-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 30px;
              background: #f8fafc;
              padding: 20px;
              border-radius: 16px;
              border: 1px solid #f1f5f9;
            }
            .profile-block h3 {
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.05em;
              margin: 0 0 10px 0;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 6px;
            }
            .profile-block p {
              margin: 4px 0;
              font-size: 13px;
              color: #334155;
            }
            .profile-block p strong {
              color: #0f172a;
              font-weight: 600;
            }
            .summary-cards {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
              margin-bottom: 35px;
            }
            .summary-card {
              padding: 16px;
              border-radius: 14px;
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
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              color: #64748b;
              letter-spacing: 0.05em;
              margin-bottom: 6px;
            }
            .summary-card.accent-due .card-label {
              color: #ef4444;
            }
            .summary-card.accent-credit .card-label {
              color: #10b981;
            }
            .card-value {
              font-size: 20px;
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
              font-size: 11px;
              font-weight: 700;
              margin-top: 4px;
              display: inline-block;
            }
            .ledger-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 40px;
            }
            .ledger-table th {
              background-color: #f1f5f9;
              padding: 12px 16px;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.05em;
              border-bottom: 2px solid #e2e8f0;
              text-align: left;
            }
            .ledger-table td {
              padding: 12px 16px;
              font-size: 13px;
              border-bottom: 1px solid #f1f5f9;
              color: #334155;
            }
            .ledger-table tr:hover {
              background-color: #f8fafc;
            }
            .badge {
              display: inline-flex;
              align-items: center;
              padding: 2px 8px;
              border-radius: 6px;
              font-size: 10px;
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
              margin-top: 50px;
              border-top: 1px solid #e2e8f0;
              padding-top: 30px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              position: relative;
            }
            .stamp-container { 
              position: absolute; 
              right: 40px;
              bottom: 20px;
              opacity: 0.85; 
              pointer-events: none; 
              z-index: 50; 
            }
            .stamp { width: 110px; height: 110px; object-fit: contain; transform: rotate(-5deg); }
            .statement-footer {
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              margin-top: 60px;
              font-weight: 500;
            }
            @media print {
              .no-print { display: none; }
              body { padding: 20px; background-color: #ffffff; }
              .stamp-container { opacity: 1 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
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
              <div class="summary-card ${balance.balance > 0 ? 'accent-due' : 'accent-credit'}" style="border-left: 3px solid ${balance.balance > 0 ? '#ef4444' : '#10b981'};">
                <div class="card-label">${balance.balance > 0 ? 'Outstanding Balance' : 'Prepaid Credit Status'}</div>
                <div class="card-value">
                  Ksh ${Math.abs(balance.balance).toLocaleString()}
                </div>
                <div class="card-status" style="color: ${balance.balance > 0 ? '#b91c1c' : '#047857'};">
                  ${balance.balance > 0 ? '⚠️ Payment Outstanding' : '🎉 Account Fully Paid / Credit Held'}
                </div>
              </div>
            </div>

            <h3>Detailed Ledger Transactions</h3>
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

  const handlePrintReceipt = (student: User, payment: { amount: number, date: string, description: string }, balance: { total: number, paid: number, remaining: number }) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Fee Receipt - ${student.name}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .receipt-container { max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px; }
            .header { text-align: center; border-bottom: 2px solid #2563EB; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { font-size: 24px; color: #2563EB; margin: 0; }
            .header p { color: #6b7280; font-size: 14px; margin: 5px 0 0 0; }
            .receipt-info { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; }
            .student-details { margin-bottom: 30px; }
            .student-details h3 { font-size: 16px; margin-bottom: 10px; color: #111827; }
            .student-details p { margin: 2px 0; color: #4b5563; }
            .payment-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .payment-table th { text-align: left; background: #f9fafb; padding: 12px; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
            .payment-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
            .summary { margin-left: auto; max-width: 250px; }
            .summary-item { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; }
            .summary-item.total { border-top: 2px solid #eee; margin-top: 10px; padding-top: 10px; font-weight: bold; color: #111827; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #eee; padding-top: 20px; position: relative; }
            .stamp-container { 
              position: absolute; 
              bottom: 60px; 
              ${settings?.stampPosition === 'left' ? 'left: 20px;' : settings?.stampPosition === 'center' ? 'left: 50%; transform: translateX(-50%);' : 'right: 20px;'}
              opacity: 1; 
              pointer-events: none; 
              z-index: 50; 
            }
            .stamp { width: 100px; height: 100px; object-fit: contain; transform: rotate(-6deg); }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
              .receipt-container { border: none; }
              .stamp-container { opacity: 1 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              ${settings?.logoUrl ? `<img src="${settings.logoUrl}" alt="School Logo" style="max-height: 80px; width: auto; margin-bottom: 10px;" />` : ''}
              <h1>BITC</h1>
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
            <div class="footer">
              <div class="stamp-container">
                ${settings?.stampUrl 
                  ? `<img src="${settings.stampUrl}" class="stamp" alt="Official Stamp" />` 
                  : `<img src="${window.location.host.includes('localhost') ? '/stamp.png' : window.location.origin + '/stamp.png'}" class="stamp" alt="Official Stamp" />`
                }
              </div>
              <p>Thank you for your payment.</p>
              <p>This is a computer generated receipt and does not require a physical signature.</p>
              <p style="margin-top: 10px; font-weight: bold;">(c) ${new Date().getFullYear()} BITC School Management System</p>
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
            
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
              @page { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${settings?.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" />` : ''}
            <h1>BREAKTHROUGH INTERNATIONAL</h1>
            <p>Financial Summary Report - ${format(new Date(), 'MMMM yyyy')}</p>
          </div>
          
                <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Monthly Collections (${format(new Date(), 'MMMM')})</div>
              <div class="stat-value" style="color: #059669;">Ksh ${stats.monthCollected.toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Monthly Invoices</div>
              <div class="stat-value" style="color: #2563EB;">Ksh ${stats.monthCharged.toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Net Monthly Balance</div>
              <div class="stat-value" style="color: ${stats.monthBalance > 0 ? '#dc2626' : '#059669'};">Ksh ${stats.monthBalance.toLocaleString()}</div>
            </div>
          </div>
          
          <h2>Class Financial Summary (Total & Monthly)</h2>
          <table>
            <thead>
              <tr>
                <th>Class Name</th>
                <th style="text-align: center;">Students</th>
                <th>Total Invoiced</th>
                <th>Total Paid</th>
                <th style="color: #dc2626;">Total Balance</th>
                <th>Invoiced (${format(new Date(), 'MMM')})</th>
                <th>Paid (${format(new Date(), 'MMM')})</th>
              </tr>
            </thead>
            <tbody>
              ${stats.classBreakdown.map((cls: any) => {
                const classUnits = units.filter(s => s.classId === cls.id).map(s => s.name).join(', ');
                const totalBal = cls.expected - cls.collected;
                return `
                <tr>
                  <td>
                    <strong>${cls.name}</strong>
                    ${classUnits ? `<div style="font-size: 9px; color: #6b7280; font-weight: normal; margin-top: 2px;">Units: ${classUnits}</div>` : ''}
                  </td>
                  <td style="text-align: center;">${cls.count}</td>
                  <td style="font-weight: bold;">Ksh ${cls.expected.toLocaleString()}</td>
                  <td style="color: #059669; font-weight: bold;">Ksh ${cls.collected.toLocaleString()}</td>
                  <td style="color: ${totalBal > 0 ? '#dc2626' : '#059669'}; font-weight: 700;">Ksh ${totalBal.toLocaleString()}</td>
                  <td>Ksh ${cls.monthCharged.toLocaleString()}</td>
                  <td style="color: #059669;">Ksh ${cls.monthCollected.toLocaleString()}</td>
                </tr>
              `;}).join('')}
            </tbody>
          </table>

          ${stats.classBreakdown.filter((c: any) => c.count > 0).map((cls: any) => `
            <div class="page-break">
              <h2>${cls.name} - Fee Balance List</h2>
              <div style="margin-bottom: 15px; display: flex; gap: 20px;">
                <div style="font-size: 11px; font-weight: bold; color: #6b7280;">Total Students: <span style="color: #111827;">${cls.count}</span></div>
                <div style="font-size: 11px; font-weight: bold; color: #6b7280;">Class Bal: <span style="color: ${cls.balance > 0 ? '#dc2626' : '#059669'};">Ksh ${cls.balance.toLocaleString()}</span></div>
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

  useEffect(() => {
    if (!user) return;

    const fetchFeesData = async () => {
      try {
        if (isAdminView) {
          // Admin sees all balances and all students
          const snapBalances = await getDocs(collection(db, 'fees'));
          const allBalances = snapBalances.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeeBalance));
          
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

          const snapUsers = await getDocs(collection(db, 'users'));
          const allUsers = snapUsers.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
          setStudents(allUsers.filter(u => String(u.role).toLowerCase() === 'student'));

          const snapClasses = await getDocs(collection(db, 'classes'));
          setClasses(snapClasses.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));

          const snapFeeConfigs = await getDocs(collection(db, 'feeConfigs'));
          setClassFees(snapFeeConfigs.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassFee)));

          const snapUnits = await getDocs(collection(db, 'units'));
          setUnits(snapUnits.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));

          const snapFeeTypes = await getDocs(collection(db, 'feeTypes'));
          setFeeTypes(snapFeeTypes.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeeType)));

          const snapFeeGroups = await getDocs(collection(db, 'feeGroups'));
          setFeeGroups(snapFeeGroups.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeeGroup)));
        } else {
          // Student sees only their own balance
          const q = query(collection(db, 'fees'), where('studentId', '==', user.uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const balances = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeeBalance));
            const studentUid = String(user.uid).trim();
            const sorted = balances.sort((a, b) => {
              const aMatch = String(a.id).trim() === studentUid ? 1 : 0;
              const bMatch = String(b.id).trim() === studentUid ? 1 : 0;
              if (aMatch !== bMatch) return bMatch - aMatch;
              return (b.lastUpdated || '').localeCompare(a.lastUpdated || '');
            });
            setMyBalance(sorted[0]);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'fees-data');
      }
    };

    fetchFeesData();
  }, [user, isAdminView]);

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
    if (!selectedStudent || !updateForm.amount) return;

    setIsUpdating(true);

    try {
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
      }

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
      addToast("Fee type deleted");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'feeTypes');
    }
  };

  const handleDeleteFeeGroup = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteDoc(doc(db, 'feeGroups', id));
      addToast("Fee group deleted");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'feeGroups');
    }
  };

  const handleDeleteClassFee = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fee package? This will not remove fees already applied to students, but will stop any future automated applications for this package.")) return;
    
    try {
      await deleteDoc(doc(db, 'feeConfigs', id));
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

          if (existingBalance) {
            const newTotal = Number(existingBalance.totalAmount || 0) + Number(fee.amount);
            batch.update(doc(db, 'fees', existingBalance.id), {
              totalAmount: newTotal,
              balance: newTotal - Number(existingBalance.paidAmount || 0),
              lastUpdated: now,
              history: [...(existingBalance.history || []), historyItem]
            });
          } else {
            const feeRef = doc(db, 'fees', sUid);
            batch.set(feeRef, {
              studentId: sUid,
              totalAmount: Number(fee.amount),
              paidAmount: 0,
              balance: Number(fee.amount),
              lastUpdated: now,
              history: [historyItem]
            });
          }

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

    activeFeeBalances.forEach(fb => {
      (fb.history || []).forEach(h => {
        const itemDate = new Date(h.date);
        if (itemDate >= monthStart && itemDate <= monthEnd) {
          if (h.type === 'payment') monthCollected += Number(h.amount) || 0;
          if (h.type === 'charge') monthCharged += Number(h.amount) || 0;
        }
      });
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
      
      const studentBalances = classStudents.map(s => {
        const bal = activeFeeBalances.find(fb => fb.studentId === s.uid);
        return {
          name: s.name,
          email: s.email,
          admNo: s.admissionNumber || s.email.split('@')[0].toUpperCase(),
          total: bal?.totalAmount || 0,
          paid: bal?.paidAmount || 0,
          balance: (bal?.totalAmount || 0) - (bal?.paidAmount || 0)
        };
      }).sort((a,b) => b.balance - a.balance);

      return {
        id: cls.id,
        name: cls.name,
        expected,
        collected,
        monthCollected: clsMonthCollected,
        monthCharged: clsMonthCharged,
        projected: (classFees.filter(f => f.classId === cls.id).reduce((acc, f) => acc + (Number(f.amount) || 0), 0)) * classStudents.length,
        balance: expected - collected,
        count: classStudents.length,
        studentBalances
      };
    }).sort((a, b) => b.projected - a.expected);

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
        runningBalance: balance?.balance || 0
      };
    });

    return {
      totalLifetimeExpected,
      totalLifetimeCollected,
      totalBalance: totalLifetimeExpected - totalLifetimeCollected,
      totalPrepaidCredits,
      totalOverpaidStudentsCount,
      monthCollected,
      monthCharged,
      totalProjected,
      monthBalance: monthCharged - monthCollected,
      collectionRate: monthCharged > 0 ? (monthCollected / monthCharged) * 100 : 0,
      classBreakdown,
      studentMonthlyData,
      allPayments: allPayments.slice(0, 50)
    };
  }, [isAdminView, feeBalances, students, classes, classFees]);

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
            
            @media print {
              body { padding: 20px; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
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
              onClick={() => setActiveTab('reports')}
              className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'reports' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <TrendingUp size={18} />
              Financial Reports
            </button>
            <button
              onClick={() => setActiveTab('installments')}
              className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'installments' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <Calculator size={18} />
              Installment Planner
            </button>
          </div>

          {activeTab === 'individual' && (
            <>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={searchTerm || ''}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-bg-card border border-white/5 rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-primary"
                  />
                </div>
                <div className="flex bg-[#111] p-1 rounded-xl border border-white/5 self-start sm:self-auto gap-1">
                  <button
                    onClick={() => setBalanceFilter('all')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      balanceFilter === 'all'
                        ? 'bg-white/15 text-white shadow-sm border border-white/10'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setBalanceFilter('outstanding')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
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
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      balanceFilter === 'overpaid'
                        ? 'bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/20'
                        : 'text-gray-400 hover:text-emerald-400'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Credit / Prepaid
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
                  {filteredStudents.map((student) => {
                    const balance = feeBalances.find(b => b.studentId === student.uid);
                    return (
                      <tr key={student.uid} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-text-primary">{student.name}</p>
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
                            {balance && (
                              <button
                                onClick={() => handlePrintStudentStatement(student, balance)}
                                className="text-emerald-700 hover:text-emerald-800 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 transition-colors hover:bg-emerald-100 flex items-center gap-1"
                                title="Print Statement of Account"
                              >
                                <FileText size={14} />
                                Statement
                              </button>
                            )}
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classFees.map(fee => (
                  <div key={fee.id} className="bg-bg-card p-6 rounded-2xl border border-white/5 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group">
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
                        <p className="text-3xl font-bold text-gray-900">Ksh {fee.amount}</p>
                        <p className="text-xs text-gray-400 mt-1">Amount to be charged</p>
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Invoiced This Month</p>
                    <h3 className="text-2xl font-bold text-gray-900">Ksh {reportStats.monthCharged.toLocaleString()}</h3>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-blue-600">
                    <BookOpen size={16} />
                    <span className="text-xs font-bold">Total Fees Applied in {format(new Date(), 'MMM')}</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Collections (This Month)</p>
                    <h3 className="text-2xl font-bold text-emerald-600">Ksh {reportStats.monthCollected.toLocaleString()}</h3>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-emerald-600">
                    <TrendingUp size={16} />
                    <span className="text-xs font-bold">{reportStats.monthCharged > 0 ? ((reportStats.monthCollected / reportStats.monthCharged) * 100).toFixed(1) : '100'}% Monthly Target</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Monthly Balance</p>
                    <h3 className="text-2xl font-bold text-amber-600">Ksh {reportStats.monthBalance.toLocaleString()}</h3>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-amber-600">
                    <History size={16} />
                    <span className="text-xs font-bold">Outstanding from {format(new Date(), 'MMMM')}</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Standard Term Expected</p>
                    <h3 className="text-2xl font-bold text-indigo-600">Ksh {reportStats.totalProjected.toLocaleString()}</h3>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-indigo-600">
                    <Users size={16} />
                    <span className="text-xs font-bold">Projected for Current Term</span>
                  </div>
                </div>

                <div className="bg-emerald-50/40 p-6 rounded-[24px] border border-emerald-100/50 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Prepaid Credits Pool</p>
                    <h3 className="text-2xl font-bold text-emerald-700">Ksh {reportStats.totalPrepaidCredits.toLocaleString()}</h3>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-emerald-600">
                    <Sparkles size={16} className="animate-pulse" />
                    <span className="text-xs font-bold">Overpayments across {reportStats.totalOverpaidStudentsCount} students</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-red-50 p-2 rounded-xl text-red-600">
                        <Wallet size={20} />
                      </div>
                      <h3 className="font-bold text-gray-900 uppercase tracking-tight text-sm">Class Outstanding Balances</h3>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <tr>
                          <th className="px-6 py-4">Class</th>
                          <th className="px-6 py-4">Total Fee Assets</th>
                          <th className="px-6 py-4">Total Collected</th>
                          <th className="px-6 py-4">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {reportStats.classBreakdown.filter(c => c.balance > 0).sort((a,b) => b.balance - a.balance).map(cls => (
                          <tr key={cls.id} className="hover:bg-red-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-gray-900">{cls.name}</p>
                              <p className="text-xs text-gray-400 font-bold uppercase tracking-tight">{cls.count} Students</p>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-gray-900">
                              Ksh {cls.expected.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-emerald-600">
                              Ksh {cls.collected.toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                                Ksh {cls.balance.toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {reportStats.classBreakdown.filter(c => c.balance > 0).length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No outstanding balances found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

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
                        {reportStats.classBreakdown.map(cls => {
                          const rate = cls.monthCharged > 0 ? (cls.monthCollected / cls.monthCharged) * 100 : 100;
                          const monthlyBal = cls.monthCharged - cls.monthCollected;
                          return (
                            <tr key={cls.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="text-sm font-bold text-gray-900">{cls.name}</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {units.filter(s => s.classId === cls.id).map(s => (
                                    <span key={s.id} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md font-bold border border-blue-100 uppercase">
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

          {activeTab === 'installments' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Heading Card with customized info */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-8 rounded-3xl border border-white/10 text-white relative overflow-hidden shadow-xl">
                <div className="absolute top-[-40%] right-[-10%] w-[300px] h-[300px] bg-primary/20 rounded-full blur-[80px]" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 bg-white/10 rounded-xl text-primary">
                      <Calculator size={24} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Administrative Tools</span>
                  </div>
                  <h2 className="text-3xl font-extrabold tracking-tight">Fee Installment Plan & Deduction Tracker</h2>
                  <p className="text-white/70 text-sm mt-2 max-w-2xl leading-relaxed">
                    Set up course-specific structures and projection profiles. Deduct installment premiums (such as <strong>Ksh {monthlyInstalment.toLocaleString()}</strong> monthly) directly from the overall fee (such as <strong>Ksh {courseFeeTotal.toLocaleString()}</strong>) manually or at the end of the month.
                  </p>
                </div>
              </div>

              {/* Grid with 2 Main Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Section: Plan Configuration & Simulator (col-span-5) */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-[#111] p-6 rounded-3xl border border-white/5 space-y-6 shadow-sm">
                    <div className="border-b border-white/5 pb-4">
                      <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                        <Layers size={18} className="text-primary" />
                        Simulation & Presets
                      </h3>
                      <p className="text-xs text-text-muted mt-1">Configure parameters to simulate the monthly deduction schedule.</p>
                    </div>

                    <div className="space-y-4">
                      {/* Course Fee Input */}
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Course Fee Amount (Ksh)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">Ksh</span>
                          <input
                            type="number"
                            value={courseFeeTotal}
                            onChange={(e) => setCourseFeeTotal(Math.max(0, parseFloat(e.target.value) || 0))}
                            placeholder="70,000"
                            className="w-full pl-14 pr-4 py-3 bg-[#111115] border border-white/5 rounded-2xl focus:ring-2 focus:ring-primary outline-none text-text-primary font-bold"
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1.5 ml-1">Standard preset default is 70,000</p>
                      </div>

                      {/* Monthly Installment Premium */}
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Monthly Installment Premium (Ksh)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">Ksh</span>
                          <input
                            type="number"
                            value={monthlyInstalment}
                            onChange={(e) => setMonthlyInstalment(Math.max(1, parseFloat(e.target.value) || 0))}
                            placeholder="4,500"
                            className="w-full pl-14 pr-4 py-3 bg-[#111115] border border-white/5 rounded-2xl focus:ring-2 focus:ring-primary outline-none text-text-primary font-bold"
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1.5 ml-1">Standard preset installment is 4,500</p>
                      </div>

                      {/* Display calculations summary */}
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Total Simulated Term:</span>
                          <span className="font-bold text-text-primary">
                            {Math.ceil(courseFeeTotal / Math.max(1, monthlyInstalment))} Months
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Final Month Premium:</span>
                          <span className="font-bold text-text-primary">
                            Ksh {(courseFeeTotal % Math.max(1, monthlyInstalment) || Math.max(1, monthlyInstalment)).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Amortization Target:</span>
                          <span className="font-bold text-emerald-400">Clears to Ksh 0</span>
                        </div>
                      </div>

                      {/* Simulator Schedule List */}
                      <div className="pt-4 border-t border-white/5">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Simulated Deduction Breakdown</label>
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 rounded-xl">
                          {Array.from({ length: Math.ceil(courseFeeTotal / Math.max(1, monthlyInstalment)) }).map((_, index) => {
                            const monthNum = index + 1;
                            const begBal = courseFeeTotal - (index * monthlyInstalment);
                            const deduction = Math.min(begBal, monthlyInstalment);
                            const endBal = Math.max(0, begBal - deduction);
                            return (
                              <div key={index} className="flex justify-between items-center bg-[#18181b]/30 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all text-xs">
                                <div>
                                  <span className="font-bold text-white uppercase text-[10px] tracking-wide bg-white/5 px-2 py-0.5 rounded mr-2">Month {monthNum}</span>
                                  <span className="text-gray-400 font-medium">Rem: Ksh {begBal.toLocaleString()}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-rose-400 font-extrabold mr-2">-Ksh {deduction.toLocaleString()}</span>
                                  <span className="font-bold text-emerald-400">→ Ksh {endBal.toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          })}
                          {courseFeeTotal <= 0 && (
                            <p className="text-center text-gray-500 py-4 italic text-xs">Please configure a course fee amount to view the breakdown table.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Section: Active Plans & Live Deduction Application (col-span-7) */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-[#111] p-6 rounded-3xl border border-white/5 space-y-6 shadow-sm">
                    <div className="border-b border-white/5 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                          <Users size={18} className="text-primary" />
                          Student Plan & Quick Deductions
                        </h3>
                        <p className="text-xs text-text-muted mt-1">Select an enrolled student to view and record monthly installment payments.</p>
                      </div>
                    </div>

                    {/* Student Selection Dropdown List */}
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Select Enrolled Student Profile</label>
                      <select
                        value={installmentStudentId}
                        onChange={(e) => setInstallmentStudentId(e.target.value)}
                        className="w-full px-4 py-3 bg-[#111115] border border-white/10 rounded-2xl focus:ring-2 focus:ring-primary outline-none font-bold text-text-primary text-sm shadow-inner"
                      >
                        <option value="">-- Choose a Student --</option>
                        {students.map(s => {
                          const balanceObj = feeBalances.find(b => b.studentId === s.uid);
                          const balanceAmount = balanceObj?.balance ?? 0;
                          return (
                            <option key={s.uid} value={s.uid}>
                              {s.name} ({s.admissionNumber || s.email.split('@')[0].toUpperCase()}) — Bal: Ksh {balanceAmount.toLocaleString()}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Live Student Enrollment Card */}
                    {(() => {
                      const student = students.find(s => s.uid === installmentStudentId);
                      if (!student) {
                        return (
                          <div className="p-8 text-center bg-[#111115]/40 rounded-3xl border border-dashed border-white/5">
                            <Users size={36} className="text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">No Student Selected</p>
                            <p className="text-xs text-gray-500 mt-1">Please select an enrolled student to manage real deductions and statements.</p>
                          </div>
                        );
                      }

                      const balanceObj = feeBalances.find(b => b.studentId === student.uid);
                      const currentBal = balanceObj?.balance ?? 0;
                      const paidToDate = balanceObj?.paidAmount ?? 0;
                      const originalTotal = balanceObj?.totalAmount ?? courseFeeTotal; // Uses recorded total, fallback is simulated total (70,000)

                      // Trigger Deduction Action Function
                      const triggerInstallmentDeduction = async () => {
                        const description = `Monthly Plan Payment: ${format(new Date(), 'MMMM yyyy')} Installment`;
                        const now = new Date().toISOString();
                        
                        // We check if student already paid this month
                        const monthName = format(new Date(), 'MMMM');
                        const isDuplicate = balanceObj?.history?.some(h => 
                          h.type === 'payment' && h.description.includes(monthName) && h.description.includes('Installment')
                        );

                        if (isDuplicate) {
                          if (!confirm(`Warning: Student "${student.name}" has already completed an installment payment containing "${monthName}" in their history. Continue anyway?`)) {
                            return;
                          }
                        } else {
                          if (!confirm(`Are you sure you want to record an end-of-month deduction payment of Ksh ${monthlyInstalment.toLocaleString()} for ${student.name}? This will update the student's ledger balance.`)) {
                            return;
                          }
                        }

                        // Write to Firebase
                        setIsUpdating(true);
                        try {
                          const historyItem = {
                            date: now,
                            amount: Number(monthlyInstalment),
                            type: 'payment' as const,
                            description,
                            attachmentUrl: '',
                            attachmentName: ''
                          };

                          if (balanceObj) {
                            const newPaid = Number(balanceObj.paidAmount || 0) + Number(monthlyInstalment);
                            const newHistory = [...(balanceObj.history || []), historyItem];
                            await updateDoc(doc(db, 'fees', balanceObj.id), {
                              paidAmount: newPaid,
                              balance: Number(balanceObj.totalAmount || 0) - newPaid,
                              lastUpdated: now,
                              history: newHistory
                            });
                          } else {
                            // If no record exists, build a proper ledger based on Course Fee (70,000) minus first payment
                            await setDoc(doc(db, 'fees', student.uid), {
                              studentId: student.uid,
                              totalAmount: Number(courseFeeTotal),
                              paidAmount: Number(monthlyInstalment),
                              balance: Number(courseFeeTotal) - Number(monthlyInstalment),
                              lastUpdated: now,
                              history: [historyItem]
                            });
                          }

                          // Trigger notification
                          await addDoc(collection(db, 'notifications'), {
                            userId: student.uid,
                            title: 'Installment Deduction Applied',
                            message: `End-of-month installment premium payment of Ksh ${monthlyInstalment.toLocaleString()} has been received and deducted successfully.`,
                            type: 'fee',
                            read: false,
                            createdAt: now,
                            link: '/fees'
                          });

                          addToast(`Successfully recorded end-of-month deduction of Ksh ${monthlyInstalment.toLocaleString()} for ${student.name}!`, 'success');
                        } catch (err: any) {
                          console.error(err);
                          addToast(err.message || "Failed to record transaction", 'error');
                        } finally {
                          setIsUpdating(false);
                        }
                      };

                      // Display Student Details and personalized projection
                      return (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          
                          {/* Live Ledger Card */}
                          <div className="bg-[#111115]/70 p-6 rounded-3xl border border-white/5 space-y-4">
                            <div className="flex justify-between items-start border-b border-white/5 pb-4">
                              <div>
                                <h4 className="text-base font-bold text-white leading-none">{student.name}</h4>
                                <p className="text-xs text-text-muted mt-1.5 font-bold uppercase tracking-wider">
                                  ADM: {student.admissionNumber || student.email.split('@')[0].toUpperCase()}
                                </p>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                currentBal > 0 
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {currentBal > 0 ? 'Billing Active' : 'Fully Clear'}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Course Fee</span>
                                <span className="block text-sm font-extrabold text-white mt-1">Ksh {originalTotal.toLocaleString()}</span>
                              </div>
                              <div className="bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/10">
                                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Amount Paid</span>
                                <span className="block text-sm font-extrabold text-emerald-400 mt-1">Ksh {paidToDate.toLocaleString()}</span>
                              </div>
                              <div className="bg-rose-500/5 p-3 rounded-2xl border border-rose-500/10 font-bold">
                                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Outstanding Balance</span>
                                <span className="block text-sm font-extrabold text-rose-400 mt-1">Ksh {currentBal.toLocaleString()}</span>
                              </div>
                            </div>

                            {/* Bullet Actions */}
                            <div className="pt-2 flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={triggerInstallmentDeduction}
                                disabled={isUpdating || currentBal <= 0}
                                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 transition-all mt-2"
                              >
                                <CreditCard size={16} />
                                Apply End-Of-Month Ksh {monthlyInstalment.toLocaleString()} Deduction
                              </button>
                            </div>
                          </div>

                          {/* Personal Dynamic Projection Schedule */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-black text-text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                              <Calendar size={14} className="text-primary" />
                              Personal Payment Projection List
                            </h4>
                            
                            {currentBal <= 0 ? (
                              <div className="p-6 text-center bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                                <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                                <p className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Plan Completed</p>
                                <p className="text-xs text-gray-500 mt-1">Student has paid the full course amount. No outstanding deductions remain.</p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                {Array.from({ length: Math.ceil(currentBal / Math.max(1, monthlyInstalment)) }).map((_, idx) => {
                                  const index = idx + 1;
                                  const startAmt = currentBal - (idx * monthlyInstalment);
                                  const deduct = Math.min(startAmt, monthlyInstalment);
                                  const resultingAmt = startAmt - deduct;
                                  
                                  const futureDateObj = new Date();
                                  futureDateObj.setMonth(futureDateObj.getMonth() + idx);
                                  
                                  return (
                                    <div key={idx} className="flex justify-between items-center bg-[#111115]/30 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all text-xs">
                                      <div>
                                        <p className="font-bold text-white text-[11px] flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 w-1.5 h-1.5"></span>
                                          End {format(futureDateObj, 'MMMM yyyy')} Premium
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-0.5 ml-2.5">Outstanding Prior: Ksh {startAmt.toLocaleString()}</p>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-emerald-400 font-extrabold mr-2">-Ksh {deduct.toLocaleString()}</span>
                                        <span className="font-bold text-gray-400">→ Ksh {resultingAmt.toLocaleString()}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })()}

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
              (myBalance?.balance || 0) < 0 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-white border-gray-100 text-gray-900 shadow-sm'
            }`}>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                (myBalance?.balance || 0) < 0 ? 'bg-emerald-400/20 text-emerald-400 animate-bounce' : 'bg-blue-50 text-blue-600'
              }`}>
                { (myBalance?.balance || 0) < 0 ? <Sparkles size={32} /> : <Wallet size={32} /> }
              </div>
              <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${ (myBalance?.balance || 0) < 0 ? 'text-emerald-400' : 'text-gray-400' }`}>
                { (myBalance?.balance || 0) < 0 ? 'Available Prepaid Credit' : 'Current Balance' }
              </p>
              <h2 className={`text-4xl font-extrabold mb-3 tracking-tight ${
                (myBalance?.balance || 0) > 0 
                  ? 'text-rose-500' 
                  : (myBalance?.balance || 0) < 0 
                    ? 'text-emerald-400' 
                    : 'text-gray-400'
              }`}>
                Ksh { (myBalance?.balance || 0) < 0 ? Math.abs(myBalance.balance).toLocaleString() : (myBalance?.balance || 0).toLocaleString() }
              </h2>
              { (myBalance?.balance || 0) < 0 && (
                <p className="text-xs text-emerald-400 font-medium mb-4 bg-emerald-500/10 py-1.5 px-3 rounded-lg inline-block border border-emerald-500/20">
                  🎉 You have pre-paid your fees! This credit covers future invoices automatically.
                </p>
              )}
              <div className={`grid grid-cols-2 gap-4 pt-6 border-t ${ (myBalance?.balance || 0) < 0 ? 'border-emerald-500/15' : 'border-gray-50' }`}>
                <div>
                  <p className={`text-xs mb-1 ${ (myBalance?.balance || 0) < 0 ? 'text-emerald-500/70' : 'text-gray-400' }`}>Total Invoiced</p>
                  <p className={`text-lg font-bold ${ (myBalance?.balance || 0) < 0 ? 'text-white' : 'text-gray-800' }`}>Ksh {myBalance?.totalAmount?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className={`text-xs mb-1 ${ (myBalance?.balance || 0) < 0 ? 'text-emerald-500/70' : 'text-gray-400' }`}>Total Paid</p>
                  <p className="text-lg font-bold text-green-500">Ksh {myBalance?.paidAmount?.toLocaleString() || 0}</p>
                </div>
              </div>

              {myBalance && (
                <button
                  onClick={() => {
                    const studentProfile = { name: userData?.name || 'Student', email: userData?.email || '', admissionNumber: userData?.admissionNumber, phone: userData?.phone, guardianName: userData?.guardianName, guardianPhone: userData?.guardianPhone, classIds: userData?.classIds } as User;
                    handlePrintStudentStatement(studentProfile, myBalance);
                  }}
                  className="w-full mt-6 bg-[#111] text-white py-3 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-black transition-all flex items-center justify-center gap-2 border border-white/5 active:scale-[0.98]"
                >
                  <FileText size={16} className="text-blue-400" />
                  Print Statement of Account
                </button>
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
                }, []).map((charge, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-600">{charge.description}</span>
                    <span className="text-sm font-bold text-gray-900">Ksh {charge.amount.toLocaleString()}</span>
                  </div>
                ))}
                {(!myBalance?.history || myBalance.history.filter(h => h.type === 'charge').length === 0) && (
                  <p className="text-xs text-gray-400 italic text-center py-4">No fee breakdown available.</p>
                )}
              </div>
            </div>

            <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
              <h3 className="text-lg font-bold mb-2">Payment Methods</h3>
              <p className="text-blue-100 text-sm">You can pay your fees via bank transfer or at the school office.</p>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <History size={20} className="text-gray-400" />
              <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
            </div>
            <div className="bg-bg-card rounded-2xl shadow-xl border border-white/5 overflow-hidden">
              <div className="divide-y divide-gray-50">
                {myBalance?.history?.slice().reverse().map((item, idx) => (
                  <div key={item.date + idx} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        item.type === 'payment' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {item.type === 'payment' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{item.description}</p>
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
                            <p className={`text-sm font-bold ${item.type === 'payment' ? 'text-green-600' : 'text-red-600'}`}>
                              {item.type === 'payment' ? '-' : '+'}Ksh {item.amount}
                            </p>
                            <p className="text-xs text-gray-400 uppercase font-bold">{item.type}</p>
                          </div>
                          {item.type === 'payment' && (
                            <button
                              onClick={() => {
                                const studentProfile = isAdminView 
                                  ? students.find(s => s.uid === myBalance?.studentId) 
                                  : { name: userData?.name || 'Student', email: userData?.email || '', admissionNumber: userData?.admissionNumber } as User;
                                
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
                  </div>
                ))}
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
                      <button
                        onClick={() => handlePrintStudentStatement(selectedStudent, studentBalance)}
                        className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm hover:bg-emerald-100 transition-all uppercase tracking-wider"
                      >
                        <Printer size={14} />
                        Print Statement
                      </button>
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

                  return (
                    <div className="p-1 space-y-4">
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Invoiced</p>
                          <p className="text-lg font-bold text-gray-900">Ksh {studentBalance.totalAmount.toLocaleString()}</p>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm text-emerald-600">
                          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Total Paid</p>
                          <p className="text-lg font-bold">Ksh {studentBalance.paidAmount.toLocaleString()}</p>
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
                              return (
                                <tr key={item.date + originalIdx} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                                    {format(new Date(item.date), 'MMM dd, yyyy')}
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="font-bold text-gray-900 leading-none">{item.description}</p>
                                    <p className="text-xs text-gray-400 uppercase font-bold mt-1">{item.type}</p>
                                  </td>
                                  <td className={`px-4 py-3 text-right font-bold ${item.type === 'payment' ? 'text-emerald-600' : 'text-red-600'}`}>
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
              className="relative bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">{editingHistoryIndex !== null ? 'Edit Transaction' : 'Update Fee Balance'}</h2>
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
                      {students.map(s => (
                        <option key={s.uid} value={s.uid}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                  )}
                </div>

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

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  {editingHistoryIndex !== null ? 'Save Changes' : 'Confirm Update'}
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
                {feeTypes.map(ft => (
                  <div key={ft.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg group">
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
                {feeGroups.map(fg => (
                  <div key={fg.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg group">
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
