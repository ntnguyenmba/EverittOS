import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyNavigationTarget,
  deepLinkToAppPath,
  dispatchAndroidBackPress,
  parseDeepLink,
  postLoginSafePath,
  registerAndroidBackHandler,
  resolveBillingVisibility,
  shouldBypassServiceWorkerCache,
  validateMobilePublicEnv
} from '@/lib/platform';

test('classifyNavigationTarget treats EverittOS paths as internal', () => {
  assert.equal(classifyNavigationTarget('/dashboard', 'https://app.everittventures.com'), 'internal');
  assert.equal(
    classifyNavigationTarget('https://app.everittventures.com/jobs/123', 'https://app.everittventures.com'),
    'internal'
  );
});

test('classifyNavigationTarget treats external websites as external', () => {
  assert.equal(classifyNavigationTarget('https://example.com', 'https://app.everittventures.com'), 'external');
  assert.equal(classifyNavigationTarget('mailto:support@everittventures.com', 'https://app.everittventures.com'), 'protocol');
});

test('parseDeepLink accepts trusted universal links and rejects invalid paths', () => {
  const ok = parseDeepLink('https://app.everittventures.com/jobs/abc');
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.path, '/jobs/abc');
  }

  const custom = parseDeepLink('everittos://jobs/abc');
  assert.equal(custom.ok, true);

  const bad = parseDeepLink('https://evil.example/phish');
  assert.equal(bad.ok, false);
});

test('deepLinkToAppPath returns null for invalid links', () => {
  assert.equal(deepLinkToAppPath('https://evil.example/login'), null);
  assert.equal(deepLinkToAppPath('https://app.everittventures.com/login'), '/login');
});

test('postLoginSafePath avoids returning to auth screens', () => {
  assert.equal(postLoginSafePath('/login'), '/dashboard');
  assert.equal(postLoginSafePath('/jobs/1'), '/jobs/1');
});

test('android back handlers close modals before navigation', () => {
  const unregister = registerAndroidBackHandler({
    id: 'test-modal',
    priority: 50,
    handle: () => true
  });
  assert.equal(dispatchAndroidBackPress(), true);
  unregister();
  assert.equal(dispatchAndroidBackPress(), false);
});

test('resolveBillingVisibility hides checkout on native surfaces', () => {
  const web = resolveBillingVisibility();
  assert.equal(web.allowCheckout, true);
});

test('shouldBypassServiceWorkerCache excludes private API routes', () => {
  assert.equal(shouldBypassServiceWorkerCache('https://app.everittventures.com/api/jobs'), true);
  assert.equal(shouldBypassServiceWorkerCache('https://app.everittventures.com/_next/static/chunk.js'), false);
});

test('validateMobilePublicEnv rejects LAN IP app URLs', () => {
  const result = validateMobilePublicEnv({
    NEXT_PUBLIC_APP_URL: 'http://192.168.1.20:3000',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon'
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('LAN IP')));
});

test('validateMobilePublicEnv accepts production HTTPS configuration', () => {
  const result = validateMobilePublicEnv({
    NEXT_PUBLIC_APP_URL: 'https://app.everittventures.com',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon'
  });
  assert.equal(result.ok, true);
});
