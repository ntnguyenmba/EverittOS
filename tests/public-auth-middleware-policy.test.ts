import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicApiPath, isSessionApiPath } from '../lib/middleware-route-policy';

test('login and setup APIs remain public and outside middleware session enforcement', () => {
  for (const path of ['/api/auth/login', '/api/auth/setup', '/api/auth/session', '/api/auth/sign-out']) {
    assert.equal(isPublicApiPath(path), true, `${path} should be handled by its route handler`);
    assert.equal(isSessionApiPath(path), false, `${path} should not be forced through middleware session auth`);
  }
});

test('job writes still require an authenticated middleware session', () => {
  assert.equal(isPublicApiPath('/api/jobs'), false);
  assert.equal(isSessionApiPath('/api/jobs'), true);
});
