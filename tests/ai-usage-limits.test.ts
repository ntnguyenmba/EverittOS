import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isStaffAiRole,
  shouldApplyStaffAiLimits,
  STAFF_DAILY_AI_PROMPT_LIMIT,
  STAFF_MONTHLY_AI_PROMPT_LIMIT
} from '@/lib/ai-usage-events';
import { aiMonthlyCap } from '@/lib/ai-server';

describe('ai usage limits by role and plan', () => {
  it('applies staff limits to staff roles on business plans', () => {
    assert.equal(shouldApplyStaffAiLimits('business', 'employee'), true);
    assert.equal(shouldApplyStaffAiLimits('business', 'staff'), true);
    assert.equal(shouldApplyStaffAiLimits('business', 'contractor'), true);
    assert.equal(shouldApplyStaffAiLimits('business', 'viewer'), true);
  });

  it('does not apply staff limits to enterprise unlimited plans', () => {
    assert.equal(shouldApplyStaffAiLimits('enterprise', 'employee'), false);
    assert.equal(shouldApplyStaffAiLimits('enterprise', 'contractor'), false);
    assert.equal(aiMonthlyCap('enterprise'), -1);
  });

  it('does not apply staff limits to workspace owners, admins, or managers', () => {
    assert.equal(shouldApplyStaffAiLimits('business', 'owner'), false);
    assert.equal(shouldApplyStaffAiLimits('business', 'admin'), false);
    assert.equal(shouldApplyStaffAiLimits('business', 'manager'), false);
  });

  it('does not apply staff limits on free or pro plans without AI access', () => {
    assert.equal(shouldApplyStaffAiLimits('free', 'employee'), false);
    assert.equal(shouldApplyStaffAiLimits('pro', 'employee'), false);
  });

  it('identifies staff AI roles consistently', () => {
    assert.equal(isStaffAiRole('employee'), true);
    assert.equal(isStaffAiRole('staff'), true);
    assert.equal(isStaffAiRole('owner'), false);
    assert.equal(isStaffAiRole('manager'), false);
  });

  it('uses per-user staff caps separate from customer plan caps', () => {
    assert.equal(STAFF_DAILY_AI_PROMPT_LIMIT, 2);
    assert.equal(STAFF_MONTHLY_AI_PROMPT_LIMIT, 40);
    assert.equal(aiMonthlyCap('business'), 200);
  });
});
