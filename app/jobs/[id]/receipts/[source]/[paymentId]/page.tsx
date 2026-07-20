import { notFound } from 'next/navigation';
import { ReceiptActions } from '@/components/receipt-actions';
import { fetchJobPaymentHistory } from '@/lib/finance/job-payments';
import { fetchJobProfitability } from '@/lib/finance-server';
import { formatCurrency } from '@/lib/finance-format';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { isValid