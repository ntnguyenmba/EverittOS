import { ACTIVITY_EVENT_LABELS } from '@/lib/activity-server';
import { todayIso } from '@/lib/date-filters';

export type ActivityLogRow = {
  id: string;
  action: string;
  message: string | null;
  entity_type: string;
  entity_id?: string | null;
  created_at: string | null;
  actor_name?: string | null;
  metadata?: Record<string, unknown> | null;
};

const AUTH_ACTIONS = new Set(['login', 'logout', 'session_timeout']);
const NON_BUSINESS_ACTIONS = new Set(['org_switched', 'subscription_changed', 'user_created', 'user_updated', 'role_changed']);
const AUTH_ENTITY_TYPES = new Set(['auth', 'session']);

const DASHBOARD_ACTIVITY_TITLES: Record<string, string> = {
  lead_created: 'Lead created',
  customer_created: 'Customer added',
  job_created: 'Job created',
  job_updated: 'Job updated',
  job_deleted: 'Job deleted',
  job_assigned: 'Worker assigned',
  worker_assigned: 'Worker assigned',
  worker_created: 'Team member added',
  worker_updated: 'Team member updated',
  status_changed: 'Job updated',
  schedule_changed: 'Job scheduled',
  invoice_created: 'Invoice created',
  invoice_paid: 'Invoice paid',
  review_submitted: 'Review received',
  review_request_created: 'Review requested',
  proposal_sent: 'Proposal sent',
  estimate_sent: 'Estimate sent',
  message_sent: 'Message sent',
  form_created: 'Form created',
  expense_created: 'Expense recorded',
  photo_uploaded: 'Photo uploaded',
  report_generated: 'Report generated',
  report_submitted: 'Report submitted'
};

export function isSecurityActivity(row: Pick<ActivityLogRow, 'action' | 'entity_type' | 'message'>): boolean {
  if (AUTH_ACTIONS.has(row.action) || AUTH_ENTITY_TYPES.has(row.entity_type)) return true;
  if (NON_BUSINESS_ACTIONS.has(row.action)) return true;
  const msg = (row.message || '').toLowerCase();
  if (msg.includes('signed in') || msg.includes('signed out')) return true;
  return false;
}

export function isBusinessActivity(row: ActivityLogRow): boolean {
  return !isSecurityActivity(row);
}

export function filterBusinessActivity<T extends ActivityLogRow>(rows: T[]): T[] {
  return rows.filter(isBusinessActivity);
}

function activityTitle(row: ActivityLogRow): string {
  const lower = (row.message || '').toLowerCase();

  if (row.entity_type === 'member' || row.entity_type === 'invitation' || row.entity_type === 'organization') {
    if (lower.includes('invited')) return 'Team invitation sent';
    if (lower.includes('revoked')) return 'Team invitation revoked';
    if (lower.includes('role')) return 'Team role updated';
    if (lower.includes('owner')) return 'Ownership updated';
    return 'Team activity';
  }

  if (row.action === 'status_changed' && lower.includes('completed')) return 'Job completed';
  if (row.action === 'lead_created' || (row.action === 'customer_created' && lower.includes('lead'))) {
    return 'Lead created';
  }
  return DASHBOARD_ACTIVITY_TITLES[row.action] || ACTIVITY_EVENT_LABELS[row.action] || row.action.replace(/_/g, ' ');
}

function parseActivitySubtitle(message: string | null): string {
  if (!message) return '';
  const colon = message.indexOf(':');
  if (colon >= 0 && colon < message.length - 1) {
    return message.slice(colon + 1).trim();
  }
  return message.trim();
}

function formatRelativeActivityDate(iso: string | null): string {
  if (!iso) return '';
  const date = iso.slice(0, 10);
  const today = todayIso();
  if (date === today) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);
  if (date === yesterdayIso) return 'Yesterday';

  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export type DashboardActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  href: string | null;
};

function activityHref(row: ActivityLogRow): string | null {
  const id = row.entity_id;
  if (!id) return null;
  switch (row.entity_type) {
    case 'job':
      return `/jobs/${id}`;
    case 'customer':
    case 'lead':
      return `/customers/${id}`;
    case 'worker':
    case 'member':
    case 'invitation':
      return `/team`;
    case 'expense':
      return `/expenses`;
    case 'invoice':
      return `/analytics`;
    case 'form':
      return `/forms/${id}`;
    case 'review':
    case 'review_request':
      return `/reviews`;
    default:
      return null;
  }
}

export function formatDashboardActivity(row: ActivityLogRow): DashboardActivityItem {
  const title = activityTitle(row);
  const subtitle = parseActivitySubtitle(row.message);
  const amount = row.metadata?.amount;
  const amountLabel =
    typeof amount === 'number' ? `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '';
  const dateLabel = formatRelativeActivityDate(row.created_at);
  const detail = [amountLabel, dateLabel].filter(Boolean).join(' • ');

  return {
    id: row.id,
    title,
    subtitle,
    detail: detail || dateLabel,
    href: activityHref(row)
  };
}
