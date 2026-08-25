export const NATIVE_PIN_RECORD_KEY = 'everittos_native_pin_v1';
export const NATIVE_PIN_ENABLED_EVENT = 'everittos:native-pin-changed';

type NativePinRecord = {
  version: 1;
  salt: string;
  hash: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derivePinHash(pin: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 120000 },
    material,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

export function nativePinIsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.localStorage.getItem(NATIVE_PIN_RECORD_KEY));
}

export async function setNativePin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePinHash(pin, salt);
  const record: NativePinRecord = { version: 1, salt: bytesToBase64(salt), hash };
  window.localStorage.setItem(NATIVE_PIN_RECORD_KEY, JSON.stringify(record));
  window.dispatchEvent(new Event(NATIVE_PIN_ENABLED_EVENT));
}

export async function verifyNativePin(pin: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false;
  const raw = window.localStorage.getItem(NATIVE_PIN_RECORD_KEY);
  if (!raw) return true;
  try {
    const record = JSON.parse(raw) as NativePinRecord;
    if (record.version !== 1 || !record.salt || !record.hash) return false;
    const candidate = await derivePinHash(pin, base64ToBytes(record.salt));
    return candidate === record.hash;
  } catch {
    return false;
  }
}

export function clearNativePin(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(NATIVE_PIN_RECORD_KEY);
  window.dispatchEvent(new Event(NATIVE_PIN_ENABLED_EVENT));
}
