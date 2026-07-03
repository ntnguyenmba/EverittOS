import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { limitsForPlan } from '@/lib/everittos-limits';
import { limitReached } from '@/lib/plan-limit-utils';
import { validatePlanAction, workerPlanLimitMessage } from '@/lib/plan-validate';

describe('worker plan limits', () => {
  it('blocks Free before the worker cap because crew assignment is unavailable', () => {
    const result = validatePlanAction({ plan: 'free', resource: 'workers', currentCount: 0 });
    assert.equal(result.allowed, false);
    assert.match(result.message || '', /Business plan or higher/i);
    assert.match(result.message || '', /Free/i);
  });

  it('blocks Pro because crew assignment is unavailable', () => {
    const result = validatePlanAction({ plan: 'pro', resource: 'workers', currentCount: 0 });
    assert.equal(result.allowed, false);
    assert.match(result.message || '', /Business plan or higher/i);
  });

  it('allows Business below the 100 worker cap', () => {
    const limit = limitsForPlan('business').crewMembers;
    assert.equal(limit, 100);
    assert.equal(
      validatePlanAction({ plan: 'business', resource: 'workers', currentCount: 99 }).allowed,
      true
    );
  });

  it('blocks Business at the 100 worker cap with plan-specific copy', () => {
    const limit = limitsForPlan('business').crewMembers;
    const result = validatePlanAction({ plan: 'business', resource: 'workers', currentCount: 100 });
    assert.equal(result.allowed, false);
    assert.equal(result.message, workerPlanLimitMessage('business', limit));
    assert.match(result.message || '', /Business plan/i);
    assert.match(result.message || '', /100 team members/i);
  });

  it('allows Starter below the 200 worker cap', () => {
    const limit = limitsForPlan('starter').crewMembers;
    assert.equal(limit, 200);
    assert.equal(
      validatePlanAction({ plan: 'starter', resource: 'workers', currentCount: 199 }).allowed,
      true
    );
  });

  it('blocks Starter at the 200 worker cap', () => {
    const result = validatePlanAction({ plan: 'starter', resource: 'workers', currentCount: 200 });
    assert.equal(result.allowed, false);
    assert.match(result.message || '', /Starter plan/i);
    assert.match(result.message || '', /200 team members/i);
  });

  it('never blocks Growth for worker count because the cap is unlimited', () => {
    const limit = limitsForPlan('growth').crewMembers;
    assert.equal(limitReached(limit, 0), false);
    assert.equal(limitReached(limit, 10_000), false);
    assert.equal(
      validatePlanAction({ plan: 'growth', resource: 'workers', currentCount: 10_000 }).allowed,
      true
    );
  });

  it('never blocks Enterprise for worker count because the cap is unlimited', () => {
    const limit = limitsForPlan('enterprise').crewMembers;
    assert.equal(limitReached(limit, 0), false);
    assert.equal(limitReached(limit, 50_000), false);
    assert.equal(
      validatePlanAction({ plan: 'enterprise', resource: 'workers', currentCount: 50_000 }).allowed,
      true
    );
  });

  it('does not treat unlimited caps as zero using raw >= comparison', () => {
    const enterpriseLimit = limitsForPlan('enterprise').crewMembers;
    assert.equal(enterpriseLimit < 0, true);
    assert.equal(50 >= enterpriseLimit, true, 'raw >= incorrectly blocks unlimited plans');
    assert.equal(limitReached(enterpriseLimit, 50), false, 'limitReached must allow unlimited plans');
  });
});
