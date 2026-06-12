import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  googleCalendarHealthLabel,
  isGoogleCalendarOperational,
  isRevokedTokenError,
  resolveGoogleCalendarHealth
} from '../lib/google-calendar-health';
import type { GoogleCalendarConnectionRow } from '../lib/google-calendar-sync';
import { createGoogleOAuthState, verifyGoogleOAuthState } from '../lib/google-calendar-oauth-state';

function connection(partial: Partial<GoogleCalendarConnectionRow>): GoogleCalendarConnectionRow {
  return {
    id: '1',
    organization_id: 'org-1',
    connected_by_user_id: 'user-1',
    google_email: 'test@example.com',
    access_token: 'access',
    refresh_token: 'refresh',
    token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    calendar_id: 'primary',
    sync_enabled: true,
    last_sync_at: null,
    last_sync_error: null,
    ...partial
  };
}

describe('google calendar health', () => {
  it('returns not_connected when row is missing', () => {
    assert.equal(resolveGoogleCalendarHealth(null), 'not_connected');
  });

  it('returns reconnect_required without refresh token', () => {
    assert.equal(resolveGoogleCalendarHealth(connection({ refresh_token: '' })), 'reconnect_required');
  });

  it('returns token_expired when access token is past expiry', () => {
    const health = resolveGoogleCalendarHealth(
      connection({ token_expires_at: new Date(Date.now() - 120_000).toISOString() })
    );
    assert.equal(health, 'token_expired');
    assert.equal(isGoogleCalendarOperational(health), true);
  });

  it('returns connected for valid tokens', () => {
    assert.equal(resolveGoogleCalendarHealth(connection({})), 'connected');
    assert.equal(googleCalendarHealthLabel('connected'), 'Connected');
  });

  it('detects revoked token errors', () => {
    assert.equal(isRevokedTokenError('invalid_grant: Token has been expired or revoked.'), true);
    assert.equal(
      resolveGoogleCalendarHealth(
        connection({ last_sync_error: 'invalid_grant: Token has been expired or revoked.' })
      ),
      'reconnect_required'
    );
  });
});

describe('google oauth state', () => {
  it('round-trips signed state', () => {
    process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET = 'test-secret';
    const state = createGoogleOAuthState('user-1', '00000000-0000-4000-8000-000000000001');
    const payload = verifyGoogleOAuthState(state);
    assert.ok(payload);
    assert.equal(payload.userId, 'user-1');
    assert.equal(payload.organizationId, '00000000-0000-4000-8000-000000000001');
  });

  it('rejects tampered state', () => {
    process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET = 'test-secret';
    const state = createGoogleOAuthState('user-1', '00000000-0000-4000-8000-000000000001');
    assert.equal(verifyGoogleOAuthState(`${state}x`), null);
  });
});
