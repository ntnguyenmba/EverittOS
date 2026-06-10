import { createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const API_KEY_PREFIX = 'eos_live_';

export function generateApiKeyRaw(): string {
  return `${API_KEY_PREFIX}${randomBytes(24).toString('hex')}`;
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function apiKeyDisplayPrefix(rawKey: string): string {
  return rawKey.slice(0, 16);
}

export type ApiKeyRow = {
  id: string;
  organization_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_by: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export async function createApiKey(
  admin: SupabaseClient,
  input: { organizationId: string; name: string; createdBy: string; scopes?: string[] }
): Promise<{ row: ApiKeyRow; rawKey: string }> {
  const rawKey = generateApiKeyRaw();
  const key_hash = hashApiKey(rawKey);
  const key_prefix = apiKeyDisplayPrefix(rawKey);

  const { data, error } = await admin
    .from('api_keys')
    .insert({
      organization_id: input.organizationId,
      name: input.name.trim(),
      key_hash,
      key_prefix,
      created_by: input.createdBy,
      scopes: input.scopes || ['read:jobs', 'write:jobs', 'read:customers', 'read:workers']
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create API key');
  }

  return { row: data as ApiKeyRow, rawKey };
}

export async function verifyApiKey(
  admin: SupabaseClient,
  rawKey: string
): Promise<(ApiKeyRow & { organization_id: string }) | null> {
  if (!rawKey.startsWith(API_KEY_PREFIX)) return null;

  const key_hash = hashApiKey(rawKey);
  const { data } = await admin
    .from('api_keys')
    .select('*')
    .eq('key_hash', key_hash)
    .is('revoked_at', null)
    .maybeSingle();

  if (!data) return null;

  await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);

  return data as ApiKeyRow;
}

export async function listApiKeys(admin: SupabaseClient, organizationId: string): Promise<ApiKeyRow[]> {
  const { data } = await admin
    .from('api_keys')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  return (data || []) as ApiKeyRow[];
}

export async function revokeApiKey(admin: SupabaseClient, keyId: string, organizationId: string): Promise<boolean> {
  const { error } = await admin
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('organization_id', organizationId)
    .is('revoked_at', null);

  return !error;
}
