import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { parseMoneyInput } from '@/lib/finance-format';
import { isValidUuid } from '@/lib/input-validation';
import {
  calculateBalanceDue,
  calculateInvoicePaymentStatus
} from '@/lib/outbound/invoice-payment';

type RouteParams = { params: Promise<{ id: string }> };

function normalizePaymentDate(value: unknown): string | null {
 