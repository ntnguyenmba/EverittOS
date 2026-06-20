import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mapAuthError,
  mapAuthErrorByCode,
  mapSignupExistingUserError
} from '@/lib/auth-errors';
import { isExistingUserSignupMessage } from '@/lib/auth-user-diagnostics';

test('isExistingUserSignupMessage detects Supabase duplicate registration errors', () => {
  assert.equal(isExistingUserSignupMessage('User already registered'), true);
  assert.equal(isExistingUserSignupMessage('A user with this email address has already been registered'), true);
  assert.equal(isExistingUserSignupMessage('Invalid login credentials'), false);
});

test('mapSignupExistingUserError returns required copy for unconfirmed email', () => {
  const mapped = mapSignupExistingUserError('email_not_confirmed');
  assert.equal(
    mapped.message,
    'Account already exists. Check your email for the confirmation link or sign in.'
  );
  assert.equal(mapped.code, 'existing_unconfirmed');
  assert.equal(mapped.signInRecommended, true);
  assert.equal(mapped.resendConfirmation, true);
});

test('mapSignupExistingUserError returns required copy for confirmed email', () => {
  const mapped = mapSignupExistingUserError('email_confirmed');
  assert.equal(mapped.message, 'An account already exists with this email. Sign in instead.');
  assert.equal(mapped.code, 'existing_confirmed');
  assert.equal(mapped.signInRecommended, true);
  assert.equal(mapped.resendConfirmation, false);
});

test('mapSignupExistingUserError guides incomplete accounts to sign in for repair', () => {
  for (const reason of ['missing_profile', 'missing_workspace'] as const) {
    const mapped = mapSignupExistingUserError(reason);
    assert.match(mapped.message, /Sign in/i);
    assert.match(mapped.message, /repair|finish setup/i);
    assert.equal(mapped.code, 'existing_incomplete');
    assert.equal(mapped.signInRecommended, true);
  }
});

test('mapSignupExistingUserError handles deleted accounts', () => {
  const mapped = mapSignupExistingUserError('account_deleted');
  assert.equal(mapped.code, 'account_deleted');
  assert.equal(mapped.signInRecommended, true);
});

test('mapAuthError never returns raw User already registered', () => {
  const mapped = mapAuthError('User already registered');
  assert.notEqual(mapped.message, 'User already registered');
  assert.equal(mapped.code, 'existing_confirmed');
});

test('mapAuthErrorByCode prefers structured signup codes', () => {
  const mapped = mapAuthErrorByCode('existing_unconfirmed');
  assert.equal(mapped?.message, 'Account already exists. Check your email for the confirmation link or sign in.');
});

test('mapAuthError uses generic fallback for unknown errors', () => {
  const mapped = mapAuthError('some obscure database trigger failure');
  assert.equal(mapped.code, 'auth_error');
  assert.match(mapped.message, /Something went wrong/i);
  assert.notEqual(mapped.message, 'some obscure database trigger failure');
});
