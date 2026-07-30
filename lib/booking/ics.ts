export type BookingIcsInput = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  timeZone?: string;
  organizerName?: string;
  organizerEmail?: string;
  lastModified?: string;
  sequence?: number;
};

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US',