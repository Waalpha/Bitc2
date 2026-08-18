import React, { useState, useMemo } from 'react';
import { User, FeeBalance, Class } from '../../types';
import { db } from '../../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Filter, 
  Search, 
  Check, 
  Layers, 
  Info, 
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import { Toast, ToastMessage } from '../Toast';

interface FeeImportExportModalProps {
  students: User[];
  feeBalances: FeeBalance[];
  classes: Class[];
  onClose: () => void;
  onRefreshData: () => Promise<void>;
}

export const FeeImportExportModal: React.FC<FeeImportExportModalProps> = ({
  students,
  feeBalances,
  classes,
  onClose,
  onRefreshData
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // EXPORT STATE
  const [exportMode, setExportMode] = useState<'summary' | 'history'>('summary');
  const [exportSearch, setExportSearch] = useState('');
  const [exportClassId, setExportClassId] = useState('all');
  const [exportStatus, setExportStatus] = useState<'all' | 'paid' | 'partial' | 'outstanding' | 'overpaid'>('all');
  const [exportTarget, setExportTarget] = useState<'all' | 'selected'>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // IMPORT STATE
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'preview' | 'summary'>('upload');
  const [parsedRawRows, setParsedRawRows] = useState<any[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<{ [key: string]: string }>({
    admissionNumber: '',
    studentName: '',
    amount: '',
    paymentDate: '',
    paymentMethod: '',
    receiptNo: '',
    semester: '',
    description: ''
  });
  const [validatedRows, setValidatedRows] = useState<Array<{
    rowNum: number;
    admissionNumber: string;
    studentName?: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    receiptNo: string;
    semester: string;
    description: string;
    isValid: boolean;
    errorReason?: string;
    studentRef?: User;
    feeBalanceRef?: FeeBalance;
  }>>([]);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; success: number; skipped: number; failed: number }>({ total: 0, success: 0, skipped: 0, failed: 0 });

  const addToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  };

  // Build Filtered Export Data
  const filteredStudentsForExport = useMemo(() => {
    return students.filter(student => {
      const balanceObj = feeBalances.find(b => b.studentId === student.id || b.studentId === student.uid || b.id === student.id);
      const totalFees = Number(balanceObj?.totalAmount || 0);
      const paid = Number(balanceObj?.paidAmount || 0);
      const rem = totalFees - paid;

      // Filter Search
      const search = exportSearch.toLowerCase();
      const matchesSearch = (student.name || '').toLowerCase().includes(search) ||
                            (student.admissionNumber || '').toLowerCase().includes(search) ||
                            (student.email || '').toLowerCase().includes(search);

      // Filter Class
      const studentClassId = (student as any).classId || student.classIds?.[0];
      const matchesClass = exportClassId === 'all' || studentClassId === exportClassId;

      // Filter Status
      let matchesStatus = true;
      if (exportStatus === 'paid') matchesStatus = totalFees > 0 && rem <= 0;
      else if (exportStatus === 'partial') matchesStatus = paid > 0 && rem > 0;
      else if (exportStatus === 'outstanding') matchesStatus = rem > 0;
      else if (exportStatus === 'overpaid') matchesStatus = rem < 0;

      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [students, feeBalances, exportSearch, exportClassId, exportStatus]);

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudentsForExport.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudentsForExport.map(s => s.id)));
    }
  };

  // DOWNLOAD TEMPLATES
  const handleDownloadExcelTemplate = () => {
    const templateData = [
      {
        "Admission Number": "BITC-1001",
        "Student Name": "John Doe",
        "Amount Paid": 15000,
        "Payment Date": new Date().toISOString().split('T')[0],
        "Payment Method": "M-Pesa",
        "Receipt Number": "RCP-98210",
        "Semester": "Semester 1",
        "Description": "Tuition Fee Payment"
      },
      {
        "Admission Number": "BITC-1002",
        "Student Name": "Jane Smith",
        "Amount Paid": 22000,
        "Payment Date": new Date().toISOString().split('T')[0],
        "Payment Method": "Bank Deposit",
        "Receipt Number": "RCP-98211",
        "Semester": "Semester 1",
        "Description": "Library & Tuition Fee"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fee Import Template");
    XLSX.writeFile(wb, "BITC_Student_Fee_Import_Template.xlsx");
    addToast("Excel Fee Import Template downloaded!", "success");
  };

  const handleDownloadCsvTemplate = () => {
    const templateData = [
      {
        "Admission Number": "BITC-1001",
        "Student Name": "John Doe",
        "Amount Paid": 15000,
        "Payment Date": new Date().toISOString().split('T')[0],
        "Payment Method": "M-Pesa",
        "Receipt Number": "RCP-98210",
        "Semester": "Semester 1",
        "Description": "Tuition Fee Payment"
      }
    ];
    const csvStr = Papa.unparse(templateData);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "BITC_Student_Fee_Import_Template.csv";
    a.click();
    addToast("CSV Fee Import Template downloaded!", "success");
  };

  // EXPORT EXCEL & CSV
  const handlePerformExport = (formatType: 'excel' | 'csv' | 'pdf' | 'print') => {
    const targetList = exportTarget === 'selected' 
      ? filteredStudentsForExport.filter(s => selectedStudentIds.has(s.id))
      : filteredStudentsForExport;

    if (targetList.length === 0) {
      addToast("No students selected for export", "warning");
      return;
    }

    if (exportMode === 'summary') {
      const rows = targetList.map(student => {
        const balanceObj = feeBalances.find(b => b.studentId === student.id || b.studentId === student.uid || b.id === student.id);
        const totalFees = Number(balanceObj?.totalAmount || 0);
        const paid = Number(balanceObj?.paidAmount || 0);
        const rem = totalFees - paid;
        const studentClassId = (student as any).classId || student.classIds?.[0];
        const className = classes.find(c => c.id === studentClassId)?.name || 'General';

        return {
          "Admission Number": student.admissionNumber || student.id,
          "Student Name": student.name,
          "Course / Program": student.course || 'N/A',
          "Class / Intake": className,
          "Total Billed Fees (KES)": totalFees,
          "Amount Paid (KES)": paid,
          "Balance Outstanding (KES)": rem,
          "Payment Status": rem <= 0 && totalFees > 0 ? "PAID IN FULL" : paid > 0 ? "PARTIAL PAYMENT" : "UNPAID"
        };
      });

      if (formatType === 'excel') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Student Fee Summaries");
        XLSX.writeFile(wb, `Student_Fee_Summaries_${new Date().toISOString().split('T')[0]}.xlsx`);
        addToast(`Exported ${rows.length} fee summary records to Excel`, "success");
      } else if (formatType === 'csv') {
        const csvStr = Papa.unparse(rows);
        const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Student_Fee_Summaries_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        addToast(`Exported ${rows.length} fee summary records to CSV`, "success");
      } else if (formatType === 'print' || formatType === 'pdf') {
        window.print();
      }
    } else {
      // History Ledger Export
      const historyRows: any[] = [];
      targetList.forEach(student => {
        const balanceObj = feeBalances.find(b => b.studentId === student.id || b.studentId === student.uid || b.id === student.id);
        const history = balanceObj?.history || [];

        history.forEach((tx: any, idx: number) => {
          historyRows.push({
            "Admission Number": student.admissionNumber || student.id,
            "Student Name": student.name,
            "Receipt / Ref No.": tx.receiptNo || tx.ref || `RCP-${idx + 1001}`,
            "Transaction Date": tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A',
            "Payment Method": tx.method || 'M-Pesa / Cash',
            "Description": tx.description || 'Fee Payment',
            "Amount Paid (KES)": Number(tx.amount || 0)
          });
        });
      });

      if (historyRows.length === 0) {
        addToast("No transaction history records found for selected students", "warning");
        return;
      }

      if (formatType === 'excel') {
        const ws = XLSX.utils.json_to_sheet(historyRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Payment Ledger History");
        XLSX.writeFile(wb, `Payment_History_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
        addToast(`Exported ${historyRows.length} payment history transactions to Excel`, "success");
      } else if (formatType === 'csv') {
        const csvStr = Papa.unparse(historyRows);
        const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Payment_History_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        addToast(`Exported ${historyRows.length} payment history transactions to CSV`, "success");
      } else {
        window.print();
      }
    }
  };

  // FILE UPLOAD PARSER
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setParsedRawRows(results.data);
            const headers = Object.keys(results.data[0]);
            setFileHeaders(headers);
            autoMapColumns(headers);
            setImportStep('mapping');
          } else {
            addToast("Uploaded CSV file is empty or corrupted", "error");
          }
        }
      });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);

          if (data && data.length > 0) {
            setParsedRawRows(data);
            const headers = Object.keys(data[0] as object);
            setFileHeaders(headers);
            autoMapColumns(headers);
            setImportStep('mapping');
          } else {
            addToast("Excel worksheet is empty", "error");
          }
        } catch (err: any) {
          addToast(`Failed to parse Excel file: ${err.message}`, "error");
        }
      };
      reader.readAsBinaryString(file);
    } else {
      addToast("Unsupported file type. Please upload an Excel (.xlsx) or CSV (.csv) file.", "error");
    }
  };

  const autoMapColumns = (headers: string[]) => {
    const map: { [key: string]: string } = {
      admissionNumber: '',
      studentName: '',
      amount: '',
      paymentDate: '',
      paymentMethod: '',
      receiptNo: '',
      semester: '',
      description: ''
    };

    headers.forEach(h => {
      const lower = h.toLowerCase().trim();
      if (lower.includes('adm') || lower.includes('admission') || lower.includes('reg') || lower.includes('student id')) {
        map.admissionNumber = h;
      } else if (lower.includes('name') || lower.includes('student')) {
        map.studentName = h;
      } else if (lower.includes('amount') || lower.includes('paid') || lower.includes('fee')) {
        map.amount = h;
      } else if (lower.includes('date')) {
        map.paymentDate = h;
      } else if (lower.includes('method') || lower.includes('mode') || lower.includes('channel')) {
        map.paymentMethod = h;
      } else if (lower.includes('receipt') || lower.includes('ref') || lower.includes('txn')) {
        map.receiptNo = h;
      } else if (lower.includes('semester') || lower.includes('term')) {
        map.semester = h;
      } else if (lower.includes('desc') || lower.includes('note') || lower.includes('remark')) {
        map.description = h;
      }
    });

    setColumnMapping(map);
  };

  // VALIDATE IMPORT ROWS
  const handleValidateMapping = () => {
    if (!columnMapping.admissionNumber || !columnMapping.amount) {
      addToast("Please map both 'Admission Number' and 'Amount Paid' fields", "error");
      return;
    }

    const validated: any[] = [];

    parsedRawRows.forEach((row, idx) => {
      const rawAdm = String(row[columnMapping.admissionNumber] || '').trim();
      const rawAmt = Number(row[columnMapping.amount]) || 0;
      const rawDate = row[columnMapping.paymentDate] ? String(row[columnMapping.paymentDate]).trim() : new Date().toISOString();
      const rawMethod = row[columnMapping.paymentMethod] ? String(row[columnMapping.paymentMethod]).trim() : 'M-Pesa';
      const rawReceipt = row[columnMapping.receiptNo] ? String(row[columnMapping.receiptNo]).trim() : `IMP-${Math.floor(100000 + Math.random() * 900000)}`;
      const rawSemester = row[columnMapping.semester] ? String(row[columnMapping.semester]).trim() : 'Semester 1';
      const rawDesc = row[columnMapping.description] ? String(row[columnMapping.description]).trim() : 'Imported Fee Payment';

      // Find student in DB
      const studentMatch = students.find(s => 
        (s.admissionNumber && String(s.admissionNumber).toLowerCase().trim() === rawAdm.toLowerCase()) ||
        s.id.toLowerCase() === rawAdm.toLowerCase()
      );

      const feeBalanceMatch = studentMatch 
        ? feeBalances.find(b => b.studentId === studentMatch.id || b.studentId === studentMatch.uid || b.id === studentMatch.id)
        : undefined;

      let isValid = true;
      let errorReason = '';

      if (!rawAdm) {
        isValid = false;
        errorReason = 'Missing Admission Number';
      } else if (!studentMatch) {
        isValid = false;
        errorReason = `Admission Number '${rawAdm}' not found in active student database`;
      } else if (rawAmt <= 0) {
        isValid = false;
        errorReason = `Invalid amount: ${rawAmt} (Must be > 0)`;
      }

      // Check for duplicate receipt in history
      if (feeBalanceMatch && feeBalanceMatch.history) {
        const isDuplicate = feeBalanceMatch.history.some((h: any) => h.receiptNo === rawReceipt || h.ref === rawReceipt);
        if (isDuplicate) {
          isValid = false;
          errorReason = `Duplicate receipt number '${rawReceipt}' already exists for this student`;
        }
      }

      validated.push({
        rowNum: idx + 1,
        admissionNumber: rawAdm,
        studentName: studentMatch?.name || row[columnMapping.studentName] || 'Unknown',
        amount: rawAmt,
        paymentDate: rawDate,
        paymentMethod: rawMethod,
        receiptNo: rawReceipt,
        semester: rawSemester,
        description: rawDesc,
        isValid,
        errorReason,
        studentRef: studentMatch,
        feeBalanceRef: feeBalanceMatch
      });
    });

    setValidatedRows(validated);
    setImportStep('preview');
  };

  // COMMIT IMPORT TO FIRESTORE
  const handleExecuteImport = async () => {
    const validRows = validatedRows.filter(r => r.isValid && r.studentRef);

    if (validRows.length === 0) {
      addToast("No valid payment rows ready to import", "error");
      return;
    }

    setIsProcessingImport(true);
    let successCount = 0;
    let failedCount = 0;

    try {
      for (const row of validRows) {
        const student = row.studentRef!;
        const balanceRecord = row.feeBalanceRef;

        const newTx = {
          date: row.paymentDate,
          amount: Number(row.amount),
          type: 'payment',
          description: row.description,
          method: row.paymentMethod,
          receiptNo: row.receiptNo,
          semester: row.semester,
          createdAt: new Date().toISOString()
        };

        const targetDocId = balanceRecord?.id || student.id;
        const currentPaid = Number(balanceRecord?.paidAmount || 0);
        const currentTotal = Number(balanceRecord?.totalAmount || 0);
        const existingHistory = balanceRecord?.history || [];

        const updatedPaid = currentPaid + Number(row.amount);
        const updatedBalance = currentTotal - updatedPaid;
        const updatedHistory = [newTx, ...existingHistory];

        await setDoc(doc(db, 'fees', targetDocId), {
          studentId: student.id,
          studentName: student.name,
          admissionNumber: student.admissionNumber || student.id,
          totalAmount: currentTotal,
          paidAmount: updatedPaid,
          balance: updatedBalance,
          history: updatedHistory,
          lastUpdated: new Date().toISOString()
        }, { merge: true });

        // Sync with fee_balances collection
        try {
          await setDoc(doc(db, 'fee_balances', student.id), {
            studentId: student.id,
            totalAmount: currentTotal,
            paidAmount: updatedPaid,
            balance: updatedBalance,
            lastUpdated: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.warn("fee_balances sync notice:", e);
        }

        successCount++;
      }

      setImportResult({
        total: validatedRows.length,
        success: successCount,
        skipped: validatedRows.length - validRows.length,
        failed: failedCount
      });

      await onRefreshData();
      setImportStep('summary');
      addToast(`Import complete! ${successCount} fee payments saved to database.`, "success");
    } catch (err: any) {
      addToast(`Import execution failed: ${err.message}`, "error");
    } finally {
      setIsProcessingImport(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Student Fees Import & Export Center</h2>
              <p className="text-xs text-slate-400">Manage Excel/CSV fee record ledgers with real-time student registry validation</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection Bar */}
        <div className="bg-slate-100 p-2 flex items-center gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'export' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download size={16} />
            Export Student Fees & Ledger
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'import' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload size={16} />
            Import Fee Payments (Excel / CSV)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          
          {/* TAB 1: EXPORT SYSTEM */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              {/* Export Mode Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setExportMode('summary')}
                  className={`p-5 rounded-2xl border text-left transition-all ${
                    exportMode === 'summary' 
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <p className="font-bold text-sm text-gray-900">Student Fee Summary Ledger</p>
                  <p className="text-xs text-gray-500 mt-1">Export student accounts showing Total Billed, Paid Amount, Balance, and Status.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setExportMode('history')}
                  className={`p-5 rounded-2xl border text-left transition-all ${
                    exportMode === 'history' 
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <p className="font-bold text-sm text-gray-900">Itemized Payment History Ledger</p>
                  <p className="text-xs text-gray-500 mt-1">Export transaction history with Receipt Numbers, Payment Dates, Methods, and Amounts.</p>
                </button>
              </div>

              {/* Filters Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Search Student / Admission</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Name or admission number..."
                      value={exportSearch}
                      onChange={e => setExportSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Filter by Class</label>
                  <select
                    value={exportClassId}
                    onChange={e => setExportClassId(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-xl bg-white outline-none"
                  >
                    <option value="all">All Classes / Intakes</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Payment Status</label>
                  <select
                    value={exportStatus}
                    onChange={e => setExportStatus(e.target.value as any)}
                    className="w-full p-2 border border-gray-300 rounded-xl bg-white outline-none"
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="paid">Fully Paid</option>
                    <option value="partial">Partially Paid</option>
                    <option value="outstanding">Has Outstanding Balance</option>
                    <option value="overpaid">Overpaid / Credit</option>
                  </select>
                </div>
              </div>

              {/* Target Selection & Preview Count */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-4 text-xs">
                  <span className="font-bold text-gray-700">Target Selection:</span>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="exportTarget"
                      checked={exportTarget === 'all'}
                      onChange={() => setExportTarget('all')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>All Matching ({filteredStudentsForExport.length})</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="exportTarget"
                      checked={exportTarget === 'selected'}
                      onChange={() => setExportTarget('selected')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Selected Students Only ({selectedStudentIds.size})</span>
                  </label>
                </div>

                {exportTarget === 'selected' && (
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    {selectedStudentIds.size === filteredStudentsForExport.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {/* Selection Table */}
              {exportTarget === 'selected' && (
                <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-3 w-10">Select</th>
                        <th className="p-3">Admission</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Class</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStudentsForExport.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.has(s.id)}
                              onChange={() => toggleSelectStudent(s.id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-3 font-mono font-bold">{s.admissionNumber || s.id}</td>
                          <td className="p-3">{s.name}</td>
                          <td className="p-3">{classes.find(c => c.id === ((s as any).classId || s.classIds?.[0]))?.name || 'General'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Action Export Buttons */}
              <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-end gap-3">
                <button
                  onClick={() => handlePerformExport('excel')}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20"
                >
                  <FileSpreadsheet size={16} />
                  Export to Excel (.xlsx)
                </button>
                <button
                  onClick={() => handlePerformExport('csv')}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20"
                >
                  <Download size={16} />
                  Export to CSV
                </button>
                <button
                  onClick={() => handlePerformExport('print')}
                  className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all"
                >
                  <Printer size={16} />
                  Print / Export PDF
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT SYSTEM */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              
              {/* STEP 1: UPLOAD & TEMPLATE */}
              {importStep === 'upload' && (
                <div className="space-y-6">
                  {/* Download Templates Banner */}
                  <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center sm:text-left">
                      <h4 className="font-bold text-sm text-indigo-900">Need a Sample Fee Import Template?</h4>
                      <p className="text-xs text-indigo-700">Download pre-formatted Excel or CSV templates with example student admission and payment columns.</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={handleDownloadExcelTemplate}
                        className="inline-flex items-center gap-1.5 bg-white hover:bg-indigo-100 text-indigo-900 px-4 py-2.5 rounded-xl border border-indigo-200 text-xs font-bold transition-all"
                      >
                        <FileSpreadsheet size={16} className="text-emerald-600" />
                        Excel Template (.xlsx)
                      </button>
                      <button
                        onClick={handleDownloadCsvTemplate}
                        className="inline-flex items-center gap-1.5 bg-white hover:bg-indigo-100 text-indigo-900 px-4 py-2.5 rounded-xl border border-indigo-200 text-xs font-bold transition-all"
                      >
                        <Download size={16} className="text-indigo-600" />
                        CSV Template
                      </button>
                    </div>
                  </div>

                  {/* Dropzone Upload Box */}
                  <div className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-3xl p-10 text-center transition-all bg-gray-50/50">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Upload size={32} />
                    </div>
                    <h3 className="font-bold text-base text-gray-900">Upload Excel or CSV Fee Payments File</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                      Select an .xlsx, .xls, or .csv spreadsheet containing student fee payment records.
                    </p>

                    <label className="mt-6 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all">
                      <FileSpreadsheet size={16} />
                      Browse & Upload Spreadsheet
                      <input
                        type="file"
                        accept=".csv, .xlsx, .xls"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 2: COLUMN MAPPING */}
              {importStep === 'mapping' && (
                <div className="space-y-6">
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                    <Info size={18} className="text-amber-600 flex-shrink-0" />
                    <span>Map your uploaded spreadsheet columns to the required student fee fields before validation.</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Admission Number Column * <span className="text-red-500">(Required)</span>
                      </label>
                      <select
                        value={columnMapping.admissionNumber}
                        onChange={e => setColumnMapping({ ...columnMapping, admissionNumber: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-xl bg-white outline-none"
                      >
                        <option value="">-- Select Column --</option>
                        {fileHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Amount Paid Column * <span className="text-red-500">(Required)</span>
                      </label>
                      <select
                        value={columnMapping.amount}
                        onChange={e => setColumnMapping({ ...columnMapping, amount: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-xl bg-white outline-none"
                      >
                        <option value="">-- Select Column --</option>
                        {fileHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Payment Date Column</label>
                      <select
                        value={columnMapping.paymentDate}
                        onChange={e => setColumnMapping({ ...columnMapping, paymentDate: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-xl bg-white outline-none"
                      >
                        <option value="">-- Select Column (Optional) --</option>
                        {fileHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Payment Method Column</label>
                      <select
                        value={columnMapping.paymentMethod}
                        onChange={e => setColumnMapping({ ...columnMapping, paymentMethod: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-xl bg-white outline-none"
                      >
                        <option value="">-- Select Column (Optional) --</option>
                        {fileHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Receipt / Ref Number Column</label>
                      <select
                        value={columnMapping.receiptNo}
                        onChange={e => setColumnMapping({ ...columnMapping, receiptNo: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-xl bg-white outline-none"
                      >
                        <option value="">-- Select Column (Optional) --</option>
                        {fileHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Description / Notes Column</label>
                      <select
                        value={columnMapping.description}
                        onChange={e => setColumnMapping({ ...columnMapping, description: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-xl bg-white outline-none"
                      >
                        <option value="">-- Select Column (Optional) --</option>
                        {fileHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setImportStep('upload')}
                      className="px-5 py-2.5 text-xs font-bold text-gray-600"
                    >
                      Back to Upload
                    </button>
                    <button
                      type="button"
                      onClick={handleValidateMapping}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      Validate Records
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: PREVIEW & VALIDATION RESULTS */}
              {importStep === 'preview' && (
                <div className="space-y-6">
                  {/* Validation Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center text-xs">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                      <span className="text-gray-400 font-bold block uppercase text-[10px]">TOTAL ROWS</span>
                      <span className="text-xl font-black text-gray-900">{validatedRows.length}</span>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900">
                      <span className="text-emerald-700 font-bold block uppercase text-[10px]">VALID & READY</span>
                      <span className="text-xl font-black text-emerald-700">
                        {validatedRows.filter(r => r.isValid).length}
                      </span>
                    </div>
                    <div className="p-4 bg-red-50 rounded-2xl border border-red-200 text-red-900 col-span-2 sm:col-span-1">
                      <span className="text-red-700 font-bold block uppercase text-[10px]">INVALID / WARNINGS</span>
                      <span className="text-xl font-black text-red-700">
                        {validatedRows.filter(r => !r.isValid).length}
                      </span>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-[10px] sticky top-0">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Admission</th>
                          <th className="p-3">Student Name</th>
                          <th className="p-3">Amount (KES)</th>
                          <th className="p-3">Receipt No.</th>
                          <th className="p-3">Validation Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {validatedRows.map((row) => (
                          <tr key={row.rowNum} className={row.isValid ? 'hover:bg-gray-50' : 'bg-red-50/50 hover:bg-red-50'}>
                            <td className="p-3 font-mono text-gray-400">{row.rowNum}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                row.isValid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {row.isValid ? 'VALID' : 'ERROR'}
                              </span>
                            </td>
                            <td className="p-3 font-mono font-bold">{row.admissionNumber}</td>
                            <td className="p-3">{row.studentName}</td>
                            <td className="p-3 font-bold text-gray-900">{row.amount.toLocaleString()}</td>
                            <td className="p-3 font-mono">{row.receiptNo}</td>
                            <td className="p-3 text-xs">
                              {row.isValid ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                  <CheckCircle size={12} /> Ready to save
                                </span>
                              ) : (
                                <span className="text-red-600 font-medium flex items-center gap-1">
                                  <AlertTriangle size={12} /> {row.errorReason}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setImportStep('mapping')}
                      className="px-5 py-2.5 text-xs font-bold text-gray-600"
                    >
                      Back to Mapping
                    </button>

                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      disabled={isProcessingImport || validatedRows.filter(r => r.isValid).length === 0}
                      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 shadow-md shadow-emerald-600/20"
                    >
                      <CheckCircle size={16} />
                      {isProcessingImport ? 'Saving Payments to DB...' : `Import ${validatedRows.filter(r => r.isValid).length} Valid Payments`}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: IMPORT SUMMARY */}
              {importStep === 'summary' && (
                <div className="p-8 text-center space-y-6">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={32} />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-gray-900">Import Completed Successfully!</h3>
                    <p className="text-xs text-gray-500">Student fee payment records have been persisted to Firestore.</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto text-xs bg-gray-50 p-4 rounded-2xl border border-gray-200">
                    <div>
                      <span className="text-gray-400 font-bold block">PROCESSED</span>
                      <span className="font-black text-gray-900 text-lg">{importResult.total}</span>
                    </div>
                    <div>
                      <span className="text-emerald-600 font-bold block">SAVED</span>
                      <span className="font-black text-emerald-600 text-lg">{importResult.success}</span>
                    </div>
                    <div>
                      <span className="text-amber-600 font-bold block">SKIPPED</span>
                      <span className="font-black text-amber-600 text-lg">{importResult.skipped}</span>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md transition-all"
                  >
                    Done & Return to Fees
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
