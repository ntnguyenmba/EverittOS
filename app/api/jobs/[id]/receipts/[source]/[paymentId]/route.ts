import { NextResponse } from 'next/server';
import { CUSTOMER_ADDRESS_FIELDS } from '@/lib/customer-record';
import { fetchJobPaymentHistory } from '@/lib/finance/job-payments';
import { fetchJobProfitability } from '@/lib/finance-server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { isValidUuid } from '@/lib/input-validation';
import { buildPaymentReceiptView } from '@/lib/payment-receipt';
import { createSimplePdf } from '@/lib/simple-pdf';

type RouteContext = {
  params: Promise<{ id: string; source: string; payment