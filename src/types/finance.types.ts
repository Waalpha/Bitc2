export interface FeeBalance {
  id: string;
  schoolId?: string;
  studentId: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  lastUpdated: string;
  installmentPlanTotal?: number;
  installmentPlanRate?: number;
  history?: { 
    date: string; 
    amount: number; 
    type: 'payment' | 'charge'; 
    description: string;
    attachmentUrl?: string;
    attachmentName?: string;
  }[];
}

export interface FeeType {
  id: string;
  schoolId?: string;
  name: string;
  description?: string;
}

export interface FeeGroup {
  id: string;
  schoolId?: string;
  name: string;
  description?: string;
}

export interface ClassFee {
  id: string;
  schoolId?: string;
  classId: string;
  title: string;
  amount: number;
  period: 'semester' | 'yearly' | 'monthly';
  feeType?: string;
  feeGroup?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  schoolId?: string;
  title: string;
  amount: number;
  category: 'Office' | 'Utilities' | 'Maintenance' | 'Transport' | 'Payroll' | 'Purchases' | 'Department' | string;
  date: string;
  description?: string;
  recordedBy: string;
  departmentId?: string;
  attachmentUrl?: string;
  status?: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Paid';
  approvedBy?: string;
  approvalDate?: string;
}

export interface PaymentAllocation {
  itemCategory: 'Tuition' | 'Library' | 'Examination' | 'Accommodation' | 'Medical' | 'Registration' | string;
  amountAllocated: number;
}

export interface Payment {
  id: string;
  schoolId?: string;
  studentId: string;
  amount: number;
  paymentMethod: 'mpesa' | 'bank_transfer' | 'cash' | 'cheque' | 'card' | 'bank' | 'manual' | 'online' | 'other';
  mpesaReference?: string;
  bankReference?: string;
  chequeNumber?: string;
  receiptNumber?: string;
  receivedBy?: string;
  date: string;
  description?: string;
  invoiceId?: string;
  allocations?: PaymentAllocation[];
  status?: 'completed' | 'pending' | 'failed' | 'reversed';
}

export interface FeeStructureItem {
  category: 'Tuition' | 'Library' | 'Examination' | 'Accommodation' | 'Medical' | 'Registration' | string;
  amount: number;
  description?: string;
}

export interface EnterpriseFeeStructure {
  id: string;
  schoolId?: string;
  academicYear: string;
  semester: string;
  departmentId?: string;
  courseId?: string;
  programLevel?: string;
  studentCategory?: 'Regular' | 'Parallel' | 'International' | 'Self-Sponsored' | string;
  items: FeeStructureItem[];
  totalAmount: number;
  createdAt?: string;
}

export interface InvoiceItem {
  description: string;
  amount: number;
  category: string;
}

export interface Invoice {
  id: string;
  schoolId?: string;
  invoiceNumber: string;
  studentId: string;
  studentName?: string;
  regNo?: string;
  academicYear?: string;
  semester?: string;
  items: InvoiceItem[];
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  issueDate: string;
  dueDate: string;
  status: 'Draft' | 'Pending' | 'Paid' | 'Partially Paid' | 'Overdue' | 'Cancelled';
  createdAt?: string;
}

export interface ScholarshipOrDiscount {
  id: string;
  schoolId?: string;
  studentId: string;
  studentName?: string;
  type: 'Percentage Discount' | 'Fixed Discount' | 'Scholarship' | 'Bursary' | 'Fee Waiver' | 'Sponsor Payment';
  name: string;
  amountOrPercentage: number;
  isPercentage: boolean;
  appliedAmount: number;
  sponsorName?: string;
  academicYear?: string;
  status: 'Active' | 'Revoked' | 'Exhausted';
}

export interface InstallmentSchedule {
  id: string;
  schoolId?: string;
  studentId: string;
  invoiceId?: string;
  totalAmount: number;
  outstandingAmount: number;
  installments: Array<{
    dueDate: string;
    amount: number;
    paidAmount: number;
    status: 'Pending' | 'Paid' | 'Partially Paid' | 'Overdue';
  }>;
}

export interface Budget {
  id: string;
  schoolId?: string;
  academicYear: string;
  departmentId?: string;
  departmentName?: string;
  category: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
}

export interface CreditDebitNote {
  id: string;
  schoolId?: string;
  studentId: string;
  studentName?: string;
  type: 'Credit Note' | 'Debit Note';
  noteNumber: string;
  amount: number;
  reason: string;
  issueDate: string;
  issuedBy: string;
}

export interface FinancialSummary {
  expectedRevenue: number;
  collectedRevenue: number;
  outstandingBalances: number;
  totalExpenses: number;
  netIncome: number;
  monthlyTrends: Array<{ month: string; income: number; expenses: number }>;
}

