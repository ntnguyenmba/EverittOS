import { getBrowserSupabase } from '@/lib/supabase-browser';
import { supabase } from '@/lib/supabase';

export type PasskeyRecord = {
  id: string;
  friendly_name?: string | null;
  created_at?: string | null;
};

export function browserSupportsPasskeys(): boolean {
  return typeof window !== 'undefined' && typeof PublicKeyCredential !== 'undefined';
}

export function passkeyApiEnabled(): boolean {
  try {
    const client = getBrowserSupabase();
    return typeof client.auth.signInWithPasskey === 'function';
  } catch {
    return false;
  }
}

function normalizePasskeyList(data: unknown): PasskeyRecord[] {
  if (Array.isArray(data)) return data as PasskeyRecord[];
  if (data && typeof data === 'object' && Array.isArray((data as { passkeys?: PasskeyRecord[] }).passkeys)) {
    return (data as { passkeys: PasskeyRecord[] }).passkeys;
  }
  return [];
}

export function passkeyErrorMessage(error: { message?: string } | null | undefined): string {
  const message = (error?.message || '').toLowerCase();
  if (!message) return 'Passkey action failed. Try again or use email and password.';
  if (message.includes('experimental') || message.includes('passkey')) {
    return 'Passkeys are not enabled for this project yet. Enable them in Supabase Authentication settings.';
  }
  if (message.includes('abort') || message.includes('cancel')) {
    return 'Passkey setup was canceled.';
  }
  if (message.includes('not supported')) {
    return 'This browser does not support passkeys.';
  }
  return error?.message || 'Passkey action failed.';
}

export async function signInWithPasskey(): Promise<{ ok: boolean; error?: string }> {
  if (!browserSupportsPasskeys()) {
    return { ok: false, error: 'This browser does not support passkeys.' };
  }

  const { data, error } = await supabase.auth.signInWithPasskey();
  if (error) return { ok: false, error: passkeyErrorMessage(error) };
  if (!data?.session) return { ok: false, error: 'Passkey sign-in did not create a session.' };
  return { ok: true };
}

export async function registerPasskey(): Promise<{ ok: boolean; error?: string }> {
  if (!browserSupportsPasskeys()) {
    return { ok: false, error: 'This browser does not support passkeys.' };
  }

  const { data, error } = await supabase.auth.registerPasskey();
  if (error) return { ok: false, error: passkeyErrorMessage(error) };
  if (!data?.id) return { ok: false, error: 'Passkey was not saved.' };
  return { ok: true };
}

export async function listPasskeys(): Promise<{ passkeys: PasskeyRecord[]; error?: string }> {
  const { data, error } = await supabase.auth.passkey.list();
  if (error) return { passkeys: [], error: passkeyErrorMessage(error) };
  return { passkeys: normalizePasskeyList(data) };
}

export async function deletePasskey(passkeyId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.passkey.delete({ passkeyId });
  if (error) return { ok: false, error: passkeyErrorMessage(error) };
  return { ok: true };
}
