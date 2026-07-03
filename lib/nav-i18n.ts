export function navLabel(href: string, _t: (key: string) => string, fallback: string): string {
  if (href === '/people' || href === '/team' || href === '/workers') return 'People';
  return fallback;
}

export function navSectionLabel(sectionId: string, t: (key: string) => string): string | null {
  if (sectionId === 'tools') return t('nav.sectionTools');
  if (sectionId === 'insights') return t('nav.sectionInsights');
  return null;
}

export function settingsNavLabel(href: string, _t: (key: string) => string, fallback: string): string {
  if (href === '/settings/team' || href === '/settings/people') return 'People';
  return fallback;
}
