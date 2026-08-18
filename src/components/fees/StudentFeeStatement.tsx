import React from 'react';
import { User, FeeBalance } from '../../types';
import { useAuth } from '../AuthProvider';
import { Printer, Download, X, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface StudentFeeStatementProps {
  student: User;
  balance: FeeBalance;
  onClose: () => void;
}

export const StudentFeeStatement: React.FC<StudentFeeStatementProps> = ({
  student,
  balance,
  onClose
}) => {
  const { settings } = useAuth();

  const totalFees = Number(balance?.totalAmount || 0);
  const paidAmount = Number(balance?.paidAmount || 0);
  const currentBalance = totalFees - paidAmount;
  const history = balance?.history || [];

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('printable-fee-statement');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Fee_Statement_${student.admissionNumber || student.id}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        
        {/* Modal Header Controls */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between flex-shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Official Student Fee Statement</h3>
              <p className="text-xs text-slate-400">Statement for {student.name} ({student.admissionNumber || 'N/A'})</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            >
              <Download size={14} />
              Export PDF
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            >
              <Printer size={14} />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Statement Document Content */}
        <div className="p-8 sm:p-12 overflow-y-auto custom-scrollbar flex-1 bg-white" id="printable-fee-statement">
          {/* Institution Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-b-2 border-slate-900 pb-6 mb-8 text-center sm:text-left">
            <div className="flex items-center gap-4">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Institution Logo" className="h-16 w-auto object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-16 h-16 bg-indigo-900 text-white font-black text-2xl rounded-2xl flex items-center justify-center">
                  {(settings?.appTitle || 'BITC').charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{settings?.appTitle || 'Breakthrough International College'}</h1>
                <p className="text-xs text-slate-600 font-medium">{settings?.publicEmail || 'info@bitc.ac.ke'} • {settings?.publicPhone || '+254 700 000 000'}</p>
                <p className="text-xs text-slate-500 font-medium">Smart Learning Management System • Fee Ledger Statement</p>
              </div>
            </div>

            <div className="text-center sm:text-right bg-slate-50 p-4 rounded-2xl border border-slate-200 min-w-[200px]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Statement Date</p>
              <p className="text-sm font-black text-slate-900">{new Date().toLocaleDateString('en-KE', { dateStyle: 'medium' })}</p>
              <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                <ShieldCheck size={12} /> Verified System Record
              </div>
            </div>
          </div>

          {/* Student Info Box */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-xs">
            <div>
              <p className="text-slate-400 font-bold uppercase text-[10px]">Student Name</p>
              <p className="font-extrabold text-slate-900 text-sm mt-0.5">{student.name}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase text-[10px]">Admission No.</p>
              <p className="font-mono font-extrabold text-slate-900 text-sm mt-0.5">{student.admissionNumber || student.id}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase text-[10px]">Course / Program</p>
              <p className="font-extrabold text-slate-900 text-xs mt-0.5 truncate">{student.course || 'Diploma Studies'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase text-[10px]">Academic Term</p>
              <p className="font-extrabold text-slate-900 text-xs mt-0.5">{settings?.activeSession || '2025/2026 Semester 1'}</p>
            </div>
          </div>

          {/* Account Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-8 text-center">
            <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Billed Fees</p>
              <p className="text-xl font-black text-slate-900 mt-1">KES {totalFees.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Total Paid Amount</p>
              <p className="text-xl font-black text-emerald-700 mt-1">KES {paidAmount.toLocaleString()}</p>
            </div>
            <div className={`p-4 rounded-2xl border ${
              currentBalance > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <p className="text-[10px] font-bold uppercase tracking-wider">
                {currentBalance > 0 ? 'Outstanding Balance' : 'Clear / Overpaid'}
              </p>
              <p className="text-xl font-black mt-1">KES {Math.abs(currentBalance).toLocaleString()}</p>
            </div>
          </div>

          {/* Detailed Transaction History Table */}
          <div className="space-y-4">
            <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider border-b border-slate-200 pb-2">
              Itemized Payment & Fee Transaction History
            </h3>

            {history.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center italic">No transaction entries found for this student account.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 uppercase text-[10px]">
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Receipt / Ref No.</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Method</th>
                      <th className="py-3 px-3">Description</th>
                      <th className="py-3 px-3 text-right">Amount (KES)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {history.map((tx: any, idx: number) => {
                      const isPay = tx.type === 'payment' || (tx.amount > 0 && !tx.type);
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-mono">
                            {tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {tx.receiptNo || tx.ref || `RCP-${idx + 1001}`}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isPay ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'
                            }`}>
                              {isPay ? 'Payment' : 'Charge'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-medium capitalize">
                            {tx.method || 'M-Pesa / Cash'}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {tx.description || 'Tuition / Fee Payment'}
                          </td>
                          <td className={`py-3 px-3 text-right font-bold ${
                            isPay ? 'text-emerald-700' : 'text-slate-900'
                          }`}>
                            {isPay ? '-' : '+'}{Number(tx.amount || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Statement Footer Signatures */}
          <div className="mt-12 pt-8 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500">
            <div>
              <p className="font-bold text-slate-800 uppercase text-[10px]">Accounts Department Signature</p>
              <div className="w-48 border-b-2 border-slate-400 mt-8"></div>
              <p className="text-[10px] text-slate-400 mt-1">Authorized Institution Bursar</p>
            </div>

            <div className="text-center sm:text-right">
              <p className="text-[10px] italic">This is an official computer-generated fee statement from {settings?.appTitle || 'BITC'}.</p>
              <p className="text-[10px] font-bold text-slate-600 mt-1">{(settings as any)?.copyrightText || '© 2026 Breakthrough International Training College (BITC)'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
