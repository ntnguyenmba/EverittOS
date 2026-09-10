import { Capacitor, registerPlugin } from '@capacitor/core';

export const NATIVE_PIN_RECORD_KEY = 'everittos_native_pin_v1';
export const NATIVE_PIN_ENABLED_KEY = 'everittos_native_pin_enabled_v1';
export const NATIVE_PIN_ENABLED_EVENT = 'everittos:native-pin-changed';
const SECURE_PIN_KEY = 'native_pin_record_v1';
const PIN_FAILURE_KEY = 'everittos_native_pin_failures_v1';
const MAX_PIN_FAILURES = 5;
const PIN_COOLDOWN_MS = 5 * 60 * 1000;

type NativePinRecord = { version: 1; salt: string; hash: string };
type FailureRecord = { count: number; cooldownUntil?: number };
type SecureStore = { set(options: { key: string; value: string }): Promise<void>; get(options: { key: string }): Promise<{ value?: string | null }>; remove(options: { key: string }): Promise<void> };
const EverittSecureStore = registerPlugin<SecureStore>('EverittSecureStore');

function bytesToBase64(bytes: Uint8Array): string { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function base64ToBytes(value: string): Uint8Array { const binary = atob(value); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i); return bytes; }
async function derivePinHash(pin: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer, iterations: 120000 }, material, 256);
  return bytesToBase64(new Uint8Array(bits));
}
function nativeSecureStoreAvailable(): boolean { return Capacitor.isNativePlatform(); }
function safeLocalGet(key: string): string | null { if (typeof window === 'undefined') return null; try { return window.localStorage.getItem(key); } catch { return null; } }
function safeLocalSet(key: string, value: string): void { if (typeof window === 'undefined') return; try { window.localStorage.setItem(key, value); } catch { /* blocked storage must not crash the native app */ } }
function safeLocalRemove(key: string): void { if (typeof window === 'undefined') return; try { window.localStorage.removeItem(key); } catch { /* blocked storage must not crash the native app */ } }
function safeSessionGet(key: string): string | null { if (typeof window === 'undefined') return null; try { return window.sessionStorage.getItem(key); } catch { return null; } }
function safeSessionSet(key: string, value: string): void { if (typeof window === 'undefined') return; try { window.sessionStorage.setItem(key, value); } catch { /* blocked storage must not crash the native app */ } }
function safeSessionRemove(key: string): void { if (typeof window === 'undefined') return; try { window.sessionStorage.removeItem(key); } catch { /* blocked storage must not crash the native app */ } }
function readFailures(): FailureRecord { try { return JSON.parse(safeSessionGet(PIN_FAILURE_KEY) || '{"count":0}') as FailureRecord; } catch { return { count: 0 }; } }
function writeFailures(value: FailureRecord) { safeSessionSet(PIN_FAILURE_KEY, JSON.stringify(value)); }
export function nativePinCooldownRemainingMs(now = Date.now()): number { const until = readFailures().cooldownUntil || 0; return Math.max(0, until - now); }

async function readPinRecord(): Promise<NativePinRecord | null> {
  const legacy = safeLocalGet(NATIVE_PIN_RECORD_KEY);
  if (nativeSecureStoreAvailable()) {
    try {
      const secure = await EverittSecureStore.get({ key: SECURE_PIN_KEY });
      if (secure.value) return JSON.parse(secure.value) as NativePinRecord;
      if (legacy) {
        await EverittSecureStore.set({ key: SECURE_PIN_KEY, value: legacy });
        safeLocalRemove(NATIVE_PIN_RECORD_KEY);
        safeLocalSet(NATIVE_PIN_ENABLED_KEY, '1');
        return JSON.parse(legacy) as NativePinRecord;
      }
    } catch { /* keep legacy fallback during native migration */ }
  }
  try { return legacy ? JSON.parse(legacy) as NativePinRecord : null; } catch { return null; }
}

export function nativePinIsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return safeLocalGet(NATIVE_PIN_ENABLED_KEY) === '1' || Boolean(safeLocalGet(NATIVE_PIN_RECORD_KEY));
}

export async function setNativePin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const record: NativePinRecord = { version: 1, salt: bytesToBase64(salt), hash: await derivePinHash(pin, salt) };
  const serialized = JSON.stringify(record);
  if (nativeSecureStoreAvailable()) {
    await EverittSecureStore.set({ key: SECURE_PIN_KEY, value: serialized });
    safeLocalRemove(NATIVE_PIN_RECORD_KEY);
    safeLocalSet(NATIVE_PIN_ENABLED_KEY, '1');
  } else {
    safeLocalSet(NATIVE_PIN_RECORD_KEY, serialized);
  }
  safeSessionRemove(PIN_FAILURE_KEY);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NATIVE_PIN_ENABLED_EVENT));
}

export async function verifyNativePin(pin: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin) || nativePinCooldownRemainingMs() > 0) return false;
  try {
    const record = await readPinRecord();
    if (!record) return true;
    if (record.version !== 1 || !record.salt || !record.hash) return false;
    const ok = await derivePinHash(pin, base64ToBytes(record.salt)) === record.hash;
    if (ok) { safeSessionRemove(PIN_FAILURE_KEY); return true; }
    const failures = readFailures();
    const count = failures.count + 1;
    writeFailures(count >= MAX_PIN_FAILURES ? { count: 0, cooldownUntil: Date.now() + PIN_COOLDOWN_MS } : { count });
    return false;
  } catch { return false; }
}

export async function clearNativePin(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (nativeSecureStoreAvailable()) { try { await EverittSecureStore.remove({ key: SECURE_PIN_KEY }); } catch { /* continue local cleanup */ } }
  safeLocalRemove(NATIVE_PIN_RECORD_KEY);
  safeLocalRemove(NATIVE_PIN_ENABLED_KEY);
  safeSessionRemove(PIN_FAILURE_KEY);
  window.dispatchEvent(new Event(NATIVE_PIN_ENABLED_EVENT));
}
