import { getBrowserSupabase } from '@/lib/supabase-browser';
import { supabase } from '@/lib/supabase';

export type PasskeyRecord = {
  id: string;
  friendly_name?: string | null;
  created_at?: string | null;
};

type PasskeyActionResult = {
  ok: boolean;
  error?: string;
  canceled?: boolean;
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

function getPasskeyErrorText(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error.toLowerCase();

  const details = error as { name?: string; message?: string; code?: string; status?: number };
  return [details.name, details.message, details.code, details.status ? String(details.status) : '']
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function isPasskeyCancellationError(error: unknown): boolean {
  const text = getPasskeyErrorText(error);

  return (
    text.includes('notallowederror') ||
    text.includes('not allowed by the user agent') ||
    text.includes('request is not allowed') ||
    text.includes('user denied permission') ||
    text.includes('denied permission') ||
    text.includes('operation either timed out or was not allowed') ||
    text.includes('aborterror') ||
    text.includes('aborted') ||
    text.includes('cancel')
  );
}

export function passkeyErrorMessage(error: { message?: string } | null | undefined): string {
  const message = (error?.message || '').toLowerCase();
  if (!message) return 'Passkey action failed. Try again or use email and password.';
  if (isPasskeyCancellationError(error)) {
    return 'Passkey action was canceled.';
  }
  if (message.includes('experimental') || message.includes('passkey')) {
    return 'Passkeys are not enabled for this project yet. Enable them in Supabase Authentication settings.';
  }
  if (message.includes('not supported')) {
    return 'This browser does not support passkeys.';
  }
  return error?.message || 'Passkey action failed.';
}

export async function signInWithPasskey(): Promise<PasskeyActionResult> {
  if (!browserSupportsPasskeys()) {
    return { ok: false, error: 'This browser does not support passkeys.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPasskey();
    if (error) {
      if (isPasskeyCancellationError(error)) return { ok: false, canceled: true };
      return { ok: false, error: passkeyErrorMessage(error) };
    }
    if (!data?.session) return { ok: false, error: 'Passkey sign-in did not create a session.' };
    return { ok: true };
  } catch (error) {
    if (isPasskeyCancellationError(error)) return { ok: false, canceled: true };
    return { ok: false, error: passkeyErrorMessage(error as { message?: string }) };
  }
}

export async function registerPasskey(): Promise<PasskeyActionResult> {
  if (!browserSupportsPasskeys()) {
    return { ok: false, error: 'This browser does not support passkeys.' };
  }

  try {
    const { data, error } = await supabase.auth.registerPasskey();
    if (error) {
      if (isPasskeyCancellationError(error)) return { ok: false, canceled: true, error: 'Passkey setup was canceled.' };
      return { ok: false, error: passkeyErrorMessage(error) };
    }
    if (!data?.id) return { ok: false, error: 'Passkey was not saved.' };
    return { ok: true };
  } catch (error) {
    if (isPasskeyCancellationError(error)) return { ok: false, canceled: true, error: 'Passkey setup was canceled.' };
    return { ok: false, error: passkeyErrorMessage(error as { message?: string }) };
  }
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
