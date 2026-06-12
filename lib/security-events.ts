import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabase } from '@/lib/supabase-admin';

export type SecurityEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'session_timeout'
  | 'rate_limited'
  | 'password_reset'
  | 'account_disabled'
  | 'suspicious_activity'
  | 'permission_denied'
  | 'org_isolation_violation';

export type SecurityEventInput = {
  organizationId?: string | null;
  userId?: string | null;
  eventType: SecurityEventType;
  severity?: 'info' | 'warn' | 'critical';
  message: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logSecurityEvent(input: SecurityEventInput): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;

  await admin.from('security_events').insert({
    organization_id: input.organizationId || null,
    user_id: input.userId || null,
    event_type: input.eventType,
    severity: input.severity || 'info',
    message: input.message,
    ip_address: input.ipAddress || null,
    user_agent: input.userAgent || null,
    metadata: input.metadata || {}
  });
}

export function requestClientMeta(request: Request): { ipAddress: string | null; userAgent: string | null } {
  const forwarded = request.headers.get('x-forwarded-for');
  const ipAddress = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
  const userAgent = request.headers.get('user-agent');
  return { ipAddress, userAgent };
}

export const SECURITY_EVENT_LABELS: Record<SecurityEventType, string> = {
  login_success: 'Signed in',
  login_failed: 'Failed sign-in attempt',
  logout: 'Signed out',
  session_timeout: 'Session timed out',
  rate_limited: 'Rate limited',
  password_reset: 'Password reset',
  account_disabled: 'Account disabled',
  suspicious_activity: 'Suspicious activity',
  permission_denied: 'Permission denied',
  org_isolation_violation: 'Workspace isolation violation'
};

export async function fetchRecentSecurityEvents(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 50
) {
  const { data } = await supabase
    .from('security_events')
    .select('id, event_type, severity, message, user_id, created_at, metadata, user_agent, ip_address')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

export async function fetchUserSecurityEvents(
  supabase: SupabaseClient,
  userId: string,
  limit = 30
) {
  const { data } = await supabase
    .from('security_events')
    .select('id, event_type, severity, message, created_at, metadata, user_agent, ip_address')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

export function securityEventLabel(eventType: string): string {
  return SECURITY_EVENT_LABELS[eventType as SecurityEventType] || eventType.replace(/_/g, ' ');
}

export function summarizeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Unknown device';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'Apple mobile';
  if (/Android/i.test(userAgent)) return 'Android device';
  if (/Macintosh/i.test(userAgent)) return 'Mac';
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'Web browser';
}
