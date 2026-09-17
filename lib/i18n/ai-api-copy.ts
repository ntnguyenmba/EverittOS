import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  noWorkspace:string;
  planLocked:string;
  subscriptionInactive:string;
  notConfigured:(provider:string)=>string;
  serverUnavailable:string;
  permissionDenied:string;
  roleCannotUse:string;
  promptRequired:string;
  rateLimited:string;
  staffDailyLimit:string;
  staffMonthlyLimit:string;
  budgetLocked:string;
  budgetVerificationFailed:string