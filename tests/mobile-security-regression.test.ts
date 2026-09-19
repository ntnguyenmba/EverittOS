import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

test('session policy keeps device lock separate from server session', async () => {
  const policy = await import('../lib/session-policy');
  assert.equal(policy.deviceIdleLockMs('/portal/contractor/jobs/123'), 10 * 60 * 1000);
  assert.equal(policy.deviceIdleLockMs('/payments'), 5 * 60 * 1000);
  assert.equal(policy.sessionIdleTimeoutMs(), 8 * 60 * 60 * 1000);
  assert.equal(policy.sessionAbsoluteTimeoutMs(), 7 * 24 * 60 * 60 * 1000);
  assert.equal(policy.SYSTEM_HANDOFF_GRACE_MS, 90 * 1000);
});

test('native PIN secrets use secure platform storage and biometrics are registered', () => {
  const pin = read('lib/native-pin.ts');
  const iosSecure = read('ios/App/App/Security/EverittSecureStorePlugin.swift');
  const androidSecure = read('android/app/src/main/java/com/everittventures/everittos/security/EverittSecureStorePlugin.java');
  const iosBiometric = read('ios/App/App/Security/EverittBiometricPlugin.swift');
  const androidBiometric = read('android/app/src/main/java/com/everittventures/everittos/security/EverittBiometricPlugin.java');
  const iosDelegate = read('ios/App/App/AppDelegate.swift');
  const androidActivity = read('android/app/src/main/java/com/everittventures/everittos/MainActivity.java');

  assert.match(pin, /EverittSecureStore|secure/i);
  assert.match(iosSecure, /kSecClassGenericPassword/);
  assert.match(androidSecure, /AndroidKeyStore/);
  assert.match(iosBiometric, /deviceOwnerAuthenticationWithBiometrics/);
  assert.match(androidBiometric, /BiometricPrompt/);
  assert.match(iosDelegate, /EverittBiometricPlugin/);
  assert.match(androidActivity, /EverittBiometricPlugin/);
});

test('worker offline photo flow persists previews and queues uploads', () => {
  const offline = read('lib/contractor-offline.ts');
  const page = read('app/portal/contractor/jobs/[id]/page.tsx');
  const nativeStore = read('lib/native-field-store.ts');

  assert.match(offline, /queueFieldChange\('photo\.upload'/);
  assert.match(offline, /readPendingContractorPhotos/);
  assert.match(offline, /savePendingPhotoRows/);
  assert.match(offline, /deleteFieldPhoto/);
  assert.match(page, /pickJobPhotoFromCamera/);
  assert.match(page, /pickJobPhotoFromLibrary/);
  assert.match(page, /readPendingContractorPhotos/);
  assert.match(nativeStore, /saveFieldPhoto/);
});

test('native sensitive actions and revoked sessions stay guarded', () => {
  const guard = read('components/native-sensitive-action-guard.tsx');
  assert.match(guard, /\/api\/team\/invite/);
  assert.match(guard, /\/api\/exports\//);
  assert.match(guard, /\/api\/integrations\/quickbooks\/connect/);
  assert.match(guard, /\/payment/);
  assert.match(guard, /session_expired/);
  assert.match(guard, /session_revoked/);
  assert.match(guard, /requireNativeStepUp/);
});

test('passkey production association remains wired to EverittOS production host', () => {
  const supabaseBrowser = read('lib/supabase-browser.ts');
  const aasa = read('public/.well-known/apple-app-site-association');
  const entitlements = read('ios/App/App/App.entitlements');
  const passkeys = read('lib/passkey-auth.ts');

  assert.match(supabaseBrowser, /experimental:\s*\{\s*passkey:\s*true\s*\}/);
  assert.match(aasa, /H95SEQ2ET8\.com\.everittventures\.everittos/);
  assert.match(aasa, /"webcredentials"/);
  assert.match(entitlements, /webcredentials:app\.everittventures\.com/);
  assert.match(passkeys, /webauthn_credential_not_found/);
  assert.match(passkeys, /webauthn_verification_failed/);
});
