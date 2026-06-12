import type { SupabaseClient } from '@supabase/supabase-js';

const CUSTOMER_LOGO_BUCKET = 'customer-logos';
const SIGNED_URL_TTL_SECONDS = 3600;

export async function uploadCustomerLogo(
  supabase: SupabaseClient,
  organizationId: string,
  customerId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${organizationId}/${customerId}/logo.${ext}`;
  const { error } = await supabase.storage.from(CUSTOMER_LOGO_BUCKET).upload(path, file, { upsert: true });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

export async function resolveCustomerLogoUrl(
  supabase: SupabaseClient,
  logoPath: string | null | undefined
): Promise<string | null> {
  if (!logoPath?.trim()) return null;
  const { data, error } = await supabase.storage
    .from(CUSTOMER_LOGO_BUCKET)
    .createSignedUrl(logoPath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function resolveOrgLogoUrl(
  supabase: SupabaseClient,
  logoPath: string | null | undefined
): Promise<string | null> {
  if (!logoPath?.trim()) return null;
  const { data, error } = await supabase.storage.from('org-logos').createSignedUrl(logoPath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
