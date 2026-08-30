import assert from 'node:assert/strict';
import test from 'node:test';
import { isLoggedOutOnlyPath, isProtectedPath, isPublicApiPath, isSessionApiPath, matchedMainNavPath } from '../lib/middleware-route-policy';

test('protects core sell-ready product routes', () => {
  for (const path of ['/dashboard', '/jobs/123', '/leads/abc', '/invoices', '/portal/contractor', '/assistant']) {
    assert.equal(isProtectedPath(path), true, path);
  }
});

test('does not mark public pages as protected', () => {
  for (const path of ['/login', '/signup', '/book/request', '/f/request-form']) {
    assert.equal(isProtectedPath(path), false, path);
  }
});

test('keeps intended public APIs public', () => {
  assert.equal(isPublicApiPath('/api/auth/login'), true);
  assert.equal(isPublicApiPath('/api/forms/public/abc'), true);
  assert.equal(isPublicApiPath('/api/jobs'), false);
});

test('requires a session for private app APIs', () => {
  assert.equal(isSessionApiPath('/api/jobs'), true);
  assert.equal(isSessionApiPath('/api/portal/contractor/jobs'), true);
  assert.equal(isSessionApiPath('/api/auth/session'), false);
  assert.equal(isSessionApiPath('/api/v1/jobs'), false);
});

test('identifies login and signup as logged-out-only pages', () => {
  assert.equal(isLoggedOutOnlyPath('/login'), true);
  assert.equal(isLoggedOutOnlyPath('/signup'), true);
  assert.equal(isLoggedOutOnlyPath('/dashboard'), false);
});

test('maps sell-ready routes to navigation permissions', () => {
  assert.equal(matchedMainNavPath('/jobs/123'), '/jobs');
  assert.equal(matchedMainNavPath('/assistant'), '/assistant');
  assert.equal(matchedMainNavPath('/settings/account'), null);
});
