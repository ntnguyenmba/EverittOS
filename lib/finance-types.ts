export const EXPENSE_CATEGORIES = [
  'Fuel',
  'Supplies',
  'Materials',
  'Equipment rental',
  'Subcontractor payment',
  'Tools',
  'Vehicle',
  'Marketing',
  'Office',
  'Insurance',
  'Other'
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const MATERIAL_EXPENSE_CATEGORIES: ExpenseCategory[] = ['Materials', 'Supplies'];

export type ExpenseRecord = {
  id: string;
  organization_id: string;
  job_id: string | null;
  customer_id: string | null;
  worker_id: string | null;
  date: string;
  category: ExpenseCategory;
  vendor: string | null;
  description: string | null;
  amount: number;
  payment_method: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractorPaymentStatus = 'unpaid' | 'pending' | 'paid';

export type JobLaborRecord = {
  id: string;
  organization_id: string;
  job_id: string;
  worker_id: string | null;
  worker_name: string | null;
  hours: number;
  hourly_cost: number;
  total_cost: number;
  notes: string | null;
  payment_status: ContractorPaymentStatus;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceRecord = {
  id: string;
  organization_id: string | null;
  job_id: string | null;
  customer_id: string | null;
  amount: number;
  amount_paid: number;
  balance_due?: number | null;
  payment_status?: string | null;
  status: string;
  due_date: string | null;
  paid_at?: string | null;
  last_payment_at?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  payment_notes?: string | null;
  description: string | null;
  notes: string | null;
  invoice_date: string | null;
  created_at: string;
  updated_at: string;
};

export type JobProfitability = {
  hasInvoice: boolean;
  invoiceTotal: number;
  manualRevenue: number;
  revenueNotes: string | null;
  paymentsReceived: number;
  outstanding: number;
  laborCost: number;
  materialCost: number;
  otherExpenses: number;
  estimatedProfit: number;
  revenueBasis: number;
};

export type BusinessPerformanceSummary = {
  revenueThisMonth: number;
  paymentsThisMonth: number;
  outstandingInvoices: number;
  expensesThisMonth: number;
  estimatedProfitThisMonth: number;
  topCustomer: { name: string; revenue: number } | null;
  topWorker: { name: string; revenue: number } | null;
  mostProfitableJob: { id: string; title: string; profit: number } | null;
  revenueByMonth: { label: string; value: number }[];
  revenueByCustomer: { label: string; value: number }[];
  revenueByWorker: { label: string; value: number }[];
  expensesByCategory: { label: string; value: number }[];
  profitByJob: { label: string; value: number; jobId?: string }[];
};
