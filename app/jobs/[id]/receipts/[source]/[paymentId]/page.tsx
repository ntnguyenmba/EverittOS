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
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : value;
}

function textOrDash(value: string | null | undefined) {
  return value?.trim() || 'Not provided';
}

function contactLink(type: 'email' | 'phone', value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return 'Not provided';

  const href = type === 'email' ? `mailto:${trimmed}` : `tel:${trimmed.replace(/[^+\d]/g, '')}`;
  return <a href={href}>{trimmed}</a>;
}

export default async function