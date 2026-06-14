export type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no-show';

export type ServiceRecord = {
  id: string;
  organization_id: string;
  name: string;
  category: string | null;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type StaffServiceRecord = {
  id: string;
  organization_id: string;
  worker_id: string;
  service_id: string;
  created_at?: string;
};

export type StaffAvailabilityRecord = {
  id: string;
  organization_id: string;
  worker_id: string;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
  buffer_minutes: number;
  max_bookings: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type BookingRecord = {
  id: string;
  organization_id: string;
  service_id: string;
  worker_id: string | null;
  customer_id: string | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  source: string;
  notes: string | null;
  google_calendar_event_id: string | null;
  cancel_token?: string;
  reschedule_token?: string;
  created_at?: string;
  updated_at?: string;
};

export type PublicBookingWorker = {
  id: string;
  name: string;
  service_ids: string[];
};

export type PublicBookingPayload = {
  organization_id: string;
  organization_name: string;
  booking_slug: string;
  timezone: string;
  services: ServiceRecord[];
  workers: PublicBookingWorker[];
};

export type TimeSlot = {
  starts_at: string;
  ends_at: string;
  worker_id: string | null;
};
