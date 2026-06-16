import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOOKINGS_REQUIRED_PLAN,
  bookingsPlanDeniedPayload,
  bookingsPlanGate,
  canAccessFeature,
  canUseBookings
} from '@/lib/plan-access';
import { resolveNavItem } from '@/lib/nav-access';
import { limitsForPlan } from '@/lib/everittos-limits';

describe('bookings plan feature', () => {
  it('locks bookings on Free only', () => {
    assert.equal(canAccessFeature('free', 'bookings'), false);
    assert.equal(canUseBookings('free'), false);
    assert.equal(limitsForPlan('free').bookings, false);
  });

  it('unlocks bookings on Pro and every higher paid plan', () => {
    for (const plan of ['pro', 'business', 'growth', 'enterprise'] as const) {
      assert.equal(canAccessFeature(plan, 'bookings'), true, plan);
      assert.equal(canUseBookings(plan), true, plan);
      assert.equal(limitsForPlan(plan).bookings, true, plan);
    }
  });

  it('requires Pro for bookings upgrade messaging', () => {
    assert.equal(BOOKINGS_REQUIRED_PLAN, 'pro');
    const gate = bookingsPlanGate('free');
    assert.equal(gate.ok, false);
    if (!gate.ok) {
      assert.match(gate.message, /Pro/i);
      assert.equal(gate.requiredPlan, 'pro');
    }
    const payload = bookingsPlanDeniedPayload('free');
    assert.equal(payload.code, 'plan_required');
    assert.equal(payload.requiredPlan, 'pro');
    assert.equal(payload.locked, true);
  });

  it('shows locked Bookings nav item for Free workspaces', () => {
    const resolution = resolveNavItem('owner', 'free', '/bookings');
    assert.equal(resolution.visible, true);
    assert.equal(resolution.accessible, false);
    assert.equal(resolution.requiredPlan, 'pro');
  });

  it('allows Bookings nav item for Pro workspaces', () => {
    const resolution = resolveNavItem('owner', 'pro', '/bookings');
    assert.equal(resolution.visible, true);
    assert.equal(resolution.accessible, true);
  });
});
