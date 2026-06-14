import type { SupabaseClient } from '@supabase/supabase-js';

export function slugifyBookingSlug(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'workspace';
}

export async function resolveOrganizationByBookingSlug(
  admin: SupabaseClient,
  slug: string
): Promise<{ id: string; name: string; booking_slug: string } | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await admin
    .from('organizations')
    .select('id, name, booking_slug')
    .eq('booking_slug', normalized)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data as { id: string; name: string; booking_slug: string };
}

export async function ensureUniqueBookingSlug(
  admin: SupabaseClient,
  organizationId: string,
  preferredName: string
): Promise<string> {
  let candidate = slugifyBookingSlug(preferredName);
  let suffix = 0;

  while (suffix < 20) {
    const slug = suffix === 0 ? candidate : `${candidate}-${suffix}`;
    const { data: existing } = await admin
      .from('organizations')
      .select('id')
      .eq('booking_slug', slug)
      .maybeSingle();

    if (!existing || existing.id === organizationId) {
      await admin.from('organizations').update({ booking_slug: slug }).eq('id', organizationId);
      return slug;
    }
    suffix += 1;
  }

  const fallback = `${candidate}-${organizationId.slice(0, 8)}`;
  await admin.from('organizations').update({ booking_slug: fallback }).eq('id', organizationId);
  return fallback;
}
