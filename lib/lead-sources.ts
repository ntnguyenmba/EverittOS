export type LeadSourceValue =
  | 'website'
  | 'phone_call'
  | 'facebook'
  | 'instagram'
  | 'google_search'
  | 'google_business_profile'
  | 'referral'
  | 'repeat_customer'
  | 'yelp'
  | 'thumbtack'
  | 'angi'
  | 'homeadvisor'
  | 'door_hanger'
  | 'yard_sign'
  | 'vehicle_wrap'
  | 'walk_in'
  | 'other';

export const LEAD_SOURCE_OPTIONS: { value: LeadSourceValue; label: string }[] = [
  { value: 'website', label: 'Website' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'google_search', label: 'Google Search' },
  { value: 'google_business_profile', label: 'Google Business Profile' },
  { value: 'referral', label: 'Referral' },
  { value: 'repeat_customer', label: 'Repeat Customer' },
  { value: 'yelp', label: 'Yelp' },
  { value: 'thumbtack', label: 'Thumbtack' },
  { value: 'angi', label: 'Angi' },
  { value: 'homeadvisor', label: 'HomeAdvisor' },
  { value: 'door_hanger', label: 'Door Hanger' },
  { value: 'yard_sign', label: 'Yard Sign' },
  { value: 'vehicle_wrap', label: 'Vehicle Wrap' },
  { value: 'walk_in', label: 'Walk In' },
  { value: 'other', label: 'Other' }
];

export function leadSourceLabel(value: string | null | undefined): string {
  const match = LEAD_SOURCE_OPTIONS.find((opt) => opt.value === value);
  return match?.label || value || 'Other';
}
