export const CLIENT_HOME_PATH = '/portal/client';
export const CLIENT_SETTINGS_PATH = '/portal/client/settings';

export function clientNavItems(): Array<{ id: string; label: string; href: string }> {
  return [
    { id: 'overview', label: 'Dashboard', href: `${CLIENT_HOME_PATH}?tab=dashboard` },
    { id: 'jobs', label: 'Appointments', href: `${CLIENT_HOME_PATH}?tab=jobs` },
    { id: 'account', label: 'Settings', href: CLIENT_SETTINGS_PATH }
  ];
}
