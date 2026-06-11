import assert from 'node:assert/strict';

const FRIENDLY_KEYS = ['invalid_credentials', 'email_not_confirmed', 'pkce_flow_expired'];

function normalizeKey(raw) {
  const lower = raw.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'invalid_credentials';
  if (lower.includes('email not confirmed')) return 'email_not_confirmed';
  if (lower.includes('flow state') || lower.includes('pkce') || lower.includes('invalid grant')) {
    return 'pkce_flow_expired';
  }
  return '';
}

function mapAuthError(raw) {
  const trimmed = (raw || '').trim();
  const key = normalizeKey(trimmed);
  if (key) {
    return { message: `friendly:${key}`, code: key };
  }
  return { message: trimmed, code: trimmed };
}

const unknown = mapAuthError('Database error finding user');
assert.equal(unknown.message, 'Database error finding user');
assert.equal(unknown.code, 'Database error finding user');

const pkce = mapAuthError('PKCE flow state not found');
assert.equal(pkce.message, 'friendly:pkce_flow_expired');

const unconfirmed = mapAuthError('Email not confirmed');
assert.equal(unconfirmed.message, 'friendly:email_not_confirmed');

console.log('verify-auth-errors: ok');
