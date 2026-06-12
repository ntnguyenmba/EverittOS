/**
 * User-facing labels for app shell and dashboard.
 * Never derive display names from email addresses.
 */

export type WorkspaceDisplayProfile = {
  business_name?: string | null;
};

/** Business name only — never email or email local-part. */
export function workspaceBusinessName(profile: WorkspaceDisplayProfile | null | undefined): string | null {
  const name = profile?.business_name?.trim();
  if (!name) return null;
  if (name.includes('@')) return null;
  return name;
}
