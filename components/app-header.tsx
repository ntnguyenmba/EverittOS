'use client';

import { LocaleSwitcher } from '@/components/locale-switcher';

/** Top app bar with language selector for authenticated shell. */
export function AppHeader() {
  return (
    <header className="app-header" aria-label="App header">
      <div className="app-header-spacer" />
      <LocaleSwitcher compact showLabel={false} />
    </header>
  );
}
