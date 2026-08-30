'use client';

import { isNativePlatform } from '@/lib/platform/detect';
import { nativeBiometricAvailable, verifyNativeBiometric } from '@/lib/native-biometric';

const STEP_UP_FRESH_MS = 2 * 60 * 1000;
const STEP_UP_KEY = 'everittos_native_step_up_at_v1';

function readFreshStepUp(now = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  const at = Number(window.sessionStorage.getItem(STEP_UP_KEY) || '0') || 0;
  return now - at <= STEP_UP_FRESH_MS;
}

function markStepUp() {
  window.sessionStorage.setItem(STEP_UP_KEY, String(Date.now()));
}

export function clearNativeStepUp() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(STEP_UP_KEY);
}

/**
 * Native sensitive-action gate. Web continues to rely on account/session auth.
 * On native, a recent biometric confirmation is accepted for two minutes.
 * If biometrics are unavailable/cancelled, show the existing PIN lock and require retry.
 */
export async function requireNativeStepUp(reason: string): Promise<boolean> {
  if (!isNativePlatform()) return true;
  if (readFreshStepUp()) return true;
  if (await nativeBiometricAvailable()) {
    const ok = await verifyNativeBiometric(reason);
    if (ok) {
      markStepUp();
      return true;
    }
  }
  window.dispatchEvent(new Event('everittos:native-lock'));
  return false;
}
