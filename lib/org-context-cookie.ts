export const ACTIVE_ORG_COOKIE = 'everitt_active_org';

export function parseActiveOrgCookie(value: string | undefined | null): string | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  // UUID v4 shape
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}
