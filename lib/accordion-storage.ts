const PREFIX = 'everittos:accordion:';

export function readAccordionState(storageKey: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${storageKey}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function writeAccordionState(storageKey: string, state: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${PREFIX}${storageKey}`, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}
