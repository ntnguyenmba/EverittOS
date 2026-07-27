export const CLIENT_HOME_PATH = '/portal/client';
export const CLIENT_SETTINGS_PATH = '/portal/client/settings';

export function clientNavItems(): Array<{ id: string; label: string; href: string }> {
  return [
    { id: 'overview', label: 'Overview', href: `${CLIENT_HOME_PATH}?tab=dashboard` },
    { id: 'jobs', label: 'Appointments', href: `${CLIENT_HOME_PATH}?tab=jobs` },
    { id: 'schedule', label: 'Schedule', href: `${CLIENT_HOME_PATH}?tab=schedule` },
    { id: 'reports', label: 'Reports', href: `${CLIENT_HOME_PATH}?tab=reports` },
    { id: 'invoices', label: 'Invoices', href: `${CLIENT_HOME_PATH}?tab=invoices` },
    { id: 'account', label: 'Account', href: CLIENT_SETTINGS_PATH }
  ];
}
