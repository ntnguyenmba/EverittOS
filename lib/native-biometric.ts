'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

type BiometricPlugin = {
  isAvailable(): Promise<{ available: boolean; type?: string }>;
  verify(options: { reason: string }): Promise<{ verified: boolean; canceled?: boolean; unavailable?: boolean }>;
};

const EverittBiometric = registerPlugin<BiometricPlugin>('EverittBiometric');

export async function nativeBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try { return Boolean((await EverittBiometric.isAvailable()).available); } catch { return false; }
}

export async function verifyNativeBiometric(reason = 'Unlock EverittOS'): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try { return Boolean((await EverittBiometric.verify({ reason })).verified); } catch { return false; }
}
