import { getBrowserSupabase } from '@/lib/supabase-browser';
import { supabase } from '@/lib/supabase';

export type PasskeyRecord = { id: string; friendly_name?: string | null; created_at?: string | null };
type PasskeyActionResult = { ok: boolean; error?: string; canceled?: boolean };
type PasskeyError = { name?: string; message?: string; code?: string; status?: number };
const noPasskeyFoundMessage = 'No passkey found. Sign in with your email and password, then add a passkey in Settings.';

export function browserSupportsPasskeys(): boolean { return typeof window !== 'undefined' && typeof PublicKeyCredential !== 'undefined'; }
export function passkeyApiEnabled(): boolean { try { return typeof getBrowserSupabase().auth.signInWithPasskey === 'function'; } catch { return false; } }
function normalizePasskeyList(data: unknown): PasskeyRecord[] { if (Array.isArray(data)) return data as PasskeyRecord[]; if (data && typeof data === 'object' && Array.isArray((data as { passkeys?: PasskeyRecord[] }).passkeys)) return (data as { passkeys: PasskeyRecord[] }).passkeys; return []; }
function errorText(error: unknown): string { if (!error) return ''; if (typeof error === 'string') return error.toLowerCase(); const d = error as PasskeyError; return [d.name,d.message,d.code,d.status ? String(d.status) : ''].filter(Boolean).join(' ').toLowerCase(); }
function errorCode(error: unknown): string { return String((error as PasskeyError | null)?.code || '').toLowerCase(); }
export function isNoPasskeyAvailableError(error: unknown): boolean { const text = errorText(error); const code = errorCode(error); return code === 'webauthn_credential_not_found' || text.includes('no passkey') || text.includes('no credential') || text.includes('credential not found') || text.includes('not registered') || text.includes('unknown credential') || text.includes('no discoverable credential') || text.includes('no matching credential'); }
export function isPasskeyCancellationError(error: unknown): boolean { const text = errorText(error); return text.includes('notallowederror') || text.includes('not allowed by the user agent') || text.includes('request is not allowed') || text.includes('user denied permission') || text.includes('denied permission') || text.includes('operation either timed out or was not allowed') || text.includes('aborterror') || text.includes('aborted') || text.includes('cancel'); }

export function passkeyErrorMessage(error: PasskeyError | null | undefined): string {
  const text = errorText(error); const code = errorCode(error);
  if (!text) return 'Passkey action failed. Try again or use email and password.';
  if (isNoPasskeyAvailableError(error)) return noPasskeyFoundMessage;
  if (isPasskeyCancellationError(error)) return 'Passkey action was canceled.';
  if (code === 'passkey_disabled' || text.includes('passkey disabled') || text.includes('experimental')) return 'Passkeys are not enabled for this EverittOS project yet.';
  if (code === 'webauthn_verification_failed' || text.includes('verification failed') || text.includes('relying party') || text.includes('origin mismatch')) return 'Passkey verification failed. Check that the relying party and origin are app.everittventures.com.';
  if (code === 'email_not_confirmed' || text.includes('email not confirmed')) return 'Confirm your email before adding or using a passkey.';
  if (text.includes('not supported')) return 'This browser does not support passkeys.';
  return error?.message || 'Passkey action failed.';
}

function reportPasskeyFailure(action: 'sign-in' | 'register', error: unknown) {
  const details = error as PasskeyError | null;
  console.warn(`[EverittOS passkey ${action}]`, { code: details?.code || null, name: details?.name || null, message: details?.message || String(error || '') });
}

export async function signInWithPasskey(): Promise<PasskeyActionResult> {
  if (!browserSupportsPasskeys()) return { ok: false, error: 'This browser does not support passkeys.' };
  try {
    const { data, error } = await supabase.auth.signInWithPasskey();
    if (error) { reportPasskeyFailure('sign-in', error); if (isNoPasskeyAvailableError(error)) return { ok:false,error:noPasskeyFoundMessage }; if (isPasskeyCancellationError(error)) return { ok:false,canceled:true }; return { ok:false,error:passkeyErrorMessage(error) }; }
    if (!data?.session) return { ok:false,error:'Passkey sign-in did not create a session.' };
    return { ok:true };
  } catch (error) { reportPasskeyFailure('sign-in', error); if (isNoPasskeyAvailableError(error)) return { ok:false,error:noPasskeyFoundMessage }; if (isPasskeyCancellationError(error)) return { ok:false,canceled:true }; return { ok:false,error:passkeyErrorMessage(error as PasskeyError) }; }
}

export async function registerPasskey(): Promise<PasskeyActionResult> {
  if (!browserSupportsPasskeys()) return { ok:false,error:'This browser does not support passkeys.' };
  try {
    const { data, error } = await supabase.auth.registerPasskey();
    if (error) { reportPasskeyFailure('register', error); if (isPasskeyCancellationError(error)) return { ok:false,canceled:true,error:'Passkey setup was canceled.' }; return { ok:false,error:passkeyErrorMessage(error) }; }
    if (!data?.id) return { ok:false,error:'Passkey was not saved.' };
    return { ok:true };
  } catch (error) { reportPasskeyFailure('register', error); if (isPasskeyCancellationError(error)) return { ok:false,canceled:true,error:'Passkey setup was canceled.' }; return { ok:false,error:passkeyErrorMessage(error as PasskeyError) }; }
}

export async function listPasskeys(): Promise<{ passkeys: PasskeyRecord[]; error?: string }> { const { data,error } = await supabase.auth.passkey.list(); if (error) return { passkeys:[],error:passkeyErrorMessage(error) }; return { passkeys:normalizePasskeyList(data) }; }
export async function deletePasskey(passkeyId: string): Promise<{ ok:boolean; error?:string }> { const { error } = await supabase.auth.passkey.delete({ passkeyId }); if (error) return { ok:false,error:passkeyErrorMessage(error) }; return { ok:true }; }
