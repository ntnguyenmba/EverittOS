export const CALENDAR_IMPORT_SOURCE = 'calendar_import';
export const CALENDAR_IMPORT_LABEL = 'Calendar Import';

export type ParsedCalendarEvent = {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  /** Wall-clock local datetime, e.g. 2026-08-14T14:10:00 */
  dtStart: string | null;
  dtEnd: string | null;
  startDate: string | null;
  endDate: string | null;
  timezone: string | null;
  lastModified: string | null;
  status: string | null;
  allDay: boolean;
};

export type CalendarImportConnection = {
  id: string;
  organization_id: string;
  label: string | null;
  feed_url: string;
  sync_enabled: boolean;
  default_customer_id: string | null;
  default_property_id: string | null;
  default_revenue_amount: number | null;
  last_sync_at: string | null;
  last_sync_error: string | null;
  created_by: string | null;
};

export type CalendarImportStatus = {
  connected: boolean;
  label: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
};

export type CalendarImportCounts = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

export type CalendarImportResult = CalendarImportStatus & CalendarImportCounts;

export type CalendarImportJobRow = {
  id: string;
  title: string;
  notes: string | null;
  address: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  timezone: string | null;
  assigned_to: string | null;
  assigned_email: string | null;
  revenue_amount: number | null;
  property_id: string | null;
  customer_id: string | null;
  external_source: string | null;
  external_uid: string | null;
  external_last_modified: string | null;
  completed_at?: string | null;
};

export type CalendarImportPropertyRow = {
  id: string;
  customer_id: string;
  name: string;
  address: string | null;
  formatted_address: string | null;
  timezone: string | null;
  is_archived?: boolean | null;
};
