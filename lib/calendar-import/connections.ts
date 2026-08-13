import type { SupabaseClient } from '@supabase/supabase-js';
import { CALENDAR_IMPORT_LABEL, type CalendarImportConnection } from '@/lib/calendar-import/types';

const CONNECTION_WRITE_COLUMNS =
  'id, organization_id, label, feed_url, sync_enabled, default_customer_id, default_property_id, default_revenue_amount, last_sync_at, last_sync_error, created_by, created_at, updated_at';

const CONNECTION_STATUS_COLUMNS =
  'id, organization_id, label, sync_enabled, last_sync_at, last_sync_error, created_at, updated_at';

export async function listEnabledCalendarImportConnections(
  admin: SupabaseClient,
  limit = 5
): Promise<CalendarImportConnection[]> {
  const { data, error } = await admin
    .from('calendar_import_connections')
    .select(CONNECTION_WRITE_COLUMNS)
    .eq('sync_enabled', true)
    .order('last_sync_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) throw new Error('Could not load calendar import connections.');
  return (data || []) as CalendarImportConnection[];
}

export async function getPrimaryCalendarImportConnection(
  admin: SupabaseClient,
  organizationId: string,
  options?: { includeFeedUrl?: boolean }
): Promise<CalendarImportConnection | null> {
  const columns = options?.includeFeedUrl ? CONNECTION_WRITE_COLUMNS : CONNECTION_STATUS_COLUMNS;
  const { data, error } = await admin
    .from('calendar_import_connections')
    .select(columns)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error('Could not load calendar import status.');
  return (data as CalendarImportConnection | null) || null;
}

export async function saveCalendarImportConnection(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    feedUrl: string;
    createdBy: string;
    defaultRevenueAmount?: number | null;
    defaultCustomerId?: string | null;
    defaultPropertyId?: string | null;
    label?: string;
  }
): Promise<CalendarImportConnection> {
  const existing = await getPrimaryCalendarImportConnection(admin, input.organizationId, { includeFeedUrl: true });
  const now = new Date().toISOString();
  const payload = {
    organization_id: input.organizationId,
    label: input.label?.trim() || CALENDAR_IMPORT_LABEL,
    feed_url: input.feedUrl,
    sync_enabled: true,
    default_customer_id: input.defaultCustomerId || null,
    default_property_id: input.defaultPropertyId || null,
    default_revenue_amount:
      input.defaultRevenueAmount === undefined || input.defaultRevenueAmount === null
        ? existing?.default_revenue_amount ?? null
        : input.defaultRevenueAmount,
    last_sync_error: null,
    created_by: existing?.created_by || input.createdBy,
    updated_at: now
  };

  if (existing) {
    const { data, error } = await admin
      .from('calendar_import_connections')
      .update(payload)
      .eq('id', existing.id)
      .select(CONNECTION_WRITE_COLUMNS)
      .single();
    if (error || !data) throw new Error('Could not save the calendar connection.');
    return data as CalendarImportConnection;
  }

  const { data, error } = await admin
    .from('calendar_import_connections')
    .insert({ ...payload, created_by: input.createdBy })
    .select(CONNECTION_WRITE_COLUMNS)
    .single();
  if (error || !data) throw new Error('Could not save the calendar connection.');
  return data as CalendarImportConnection;
}

export async function updateCalendarImportSyncState(
  admin: SupabaseClient,
  connectionId: string,
  patch: { last_sync_at?: string | null; last_sync_error?: string | null }
): Promise<void> {
  const { error } = await admin
    .from('calendar_import_connections')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', connectionId);
  if (error) throw new Error('Could not update calendar import sync state.');
}

export async function disconnectCalendarImport(
  admin: SupabaseClient,
  organizationId: string
): Promise<void> {
  const { error } = await admin.from('calendar_import_connections').delete().eq('organization_id', organizationId);
  if (error) throw new Error('Could not disconnect calendar import.');
}
