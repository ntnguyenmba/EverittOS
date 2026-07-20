import { notFound } from 'next/navigation';
import { ReceiptActions } from '@/components/receipt-actions';
import { fetchJobPaymentHistory } from '@/lib/finance/job-payments';
import { fetchJobProfitability } from '@/lib/finance-server';
import { formatCurrency } from '@/lib/finance-format';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { isValidUuid } from '@/lib/input-validation';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string; source: string; paymentId: string }>;
};

function formatDate(value: string) {
  const date = new Date