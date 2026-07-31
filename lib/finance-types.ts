export const EXPENSE_CATEGORIES = [
  'Supplies',
  'Equipment',
  'Fuel and mileage',
  'Software',
  'Advertising',
  'Insurance',
  'Office',
  'Repairs and maintenance',
  'Professional services',
  'Taxes and fees',
  'Other',
  // Legacy categories (existing rows / older forms)
  'Fuel',
  'Materials',
  'Equipment rental',
  'Tools',
  'Vehicle',
  'Marketing',
  'Subcontractor payment'
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Categories shown in the add/edit expense form (preferred labels). */
export const EXPENSE_CATEGORY_OPTIONS: ExpenseCategory[] = [
  'Supplies',
  'Equipment',
  'Fuel and mileage',
  'Software',
  'Advertising',
  'Insurance',
  'Office',
  'Repairs and maintenance',
  'Professional services',
  'Taxes and fees',
  'Other'
];

export const MATERIAL_EXPENSE_CATEGORIES: ExpenseCategory[] = ['Materials', 'Supplies'];

export type ExpenseSource = 'manual' | 'quickbooks';

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
  source?: ExpenseSource | null;
  quickbooks_expense_id?: string | null;
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
  payment_basis?: 'hourly' | 'flat' | 'visit' | null;
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

export type JobPaymentHistoryEntry = {
  id: string;
  source: 'job' | 'invoice';
  amount: number;
  paidAt: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  invoiceId: string | null;
  createdBy: string | null;
};

export type JobPaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'no_amount_set';

export type JobProfitability = {
  hasInvoice: boolean;
  invoiceTotal: number;
  manualRevenue: number;
  revenueNotes: string | null;
  /** Expected job amount (invoice total when invoiced, else manual revenue). */
  expectedAmount: number;
  /** Total confirmed client payments for this job. */
  collectedAmount: number;
  /** @deprecated Use collectedAmount */
  paymentsReceived: number;
  outstanding: number;
  paymentStatus: JobPaymentStatus;
  /** Effective contractor cost (labor when present, otherwise expected). */
  laborCost: number;
  /** Planned contractor cost from the job form. */
  expectedContractorCost?: number;
  /** Sum of job_labor totals only. */
  recordedLaborCost?: number;
  assignedTo?: string | null;
  materialCost: number;
  otherExpenses: number;
  totalExpenses: number;
  expectedProfit: number;
  collectedProfit: number;
  /** @deprecated Prefer collectedProfit or expectedProfit */
  estimatedProfit: number;
  /** @deprecated */
  revenueBasis: number;
  payments: JobPaymentHistoryEntry[];
};

export type BusinessPerformanceSummary = {
  revenueThisMonth: number;
  paymentsThisMonth: number;
  outstandingInvoices: number;
  expensesThisMonth: number;
  contractorPaymentsThisMonth?: number;
  totalPaidCostsThisMonth?: number;
  cashAfterPaidCosts?: number;
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
