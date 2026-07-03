export function navLabel(_href: string, _t: (key: string) => string, fallback: string): string {
  return fallback;
}

export function navSectionLabel(sectionId: string, t: (key: string) => string): string | null {
  if (sectionId === 'tools') return t('nav.sectionTools');
  if (sectionId === 'insights') return t('nav.sectionInsights');
  return null;
}

export function settingsNavLabel(_href: string, _t: (key: string) => string, fallback: string): string {
  return fallback;
}
