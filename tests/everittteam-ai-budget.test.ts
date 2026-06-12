import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  EVERITTTEAM_BUDGET_EXHAUSTED_MESSAGE,
  EVERITTTEAM_BUDGET_PAUSED_MESSAGE,
  EVERITTTEAM_BUDGET_WARNING_MESSAGE,
  EVERITTTEAM_PROMO_CODE,
  getEverittteamBudgetWarning,
  getEverittteamMonthlyBudgetUsd,
  isEverittteamPromoCode
} from '@/lib/everittteam-ai-budget';

describe('everittteam-ai-budget', () => {
  const originalBudget = process.env.AI_EVERITTTEAM_MONTHLY_BUDGET_USD;

  afterEach(() => {
    if (originalBudget === undefined) delete process.env.AI_EVERITTTEAM_MONTHLY_BUDGET_USD;
    else process.env.AI_EVERITTTEAM_MONTHLY_BUDGET_USD = originalBudget;
  });

  it('recognizes EVERITTTEAM promo code case-insensitively', () => {
    assert.equal(isEverittteamPromoCode('EVERITTTEAM'), true);
    assert.equal(isEverittteamPromoCode('everittteam'), true);
    assert.equal(isEverittteamPromoCode(' VIP '), false);
    assert.equal(isEverittteamPromoCode(null), false);
  });

  it('reads monthly budget from AI_EVERITTTEAM_MONTHLY_BUDGET_USD', () => {
    process.env.AI_EVERITTTEAM_MONTHLY_BUDGET_USD = '25';
    assert.equal(getEverittteamMonthlyBudgetUsd(), 25);
  });

  it('defaults to $10 when env is missing or invalid', () => {
    delete process.env.AI_EVERITTTEAM_MONTHLY_BUDGET_USD;
    assert.equal(getEverittteamMonthlyBudgetUsd(), 10);

    process.env.AI_EVERITTTEAM_MONTHLY_BUDGET_USD = 'not-a-number';
    assert.equal(getEverittteamMonthlyBudgetUsd(), 10);
  });

  it('warns owners at 80% budget usage', () => {
    const warning = getEverittteamBudgetWarning(
      { applies: true, budgetUsd: 10, usedUsd: 8.2, percentUsed: 82 },
      true
    );
    assert.equal(warning, EVERITTTEAM_BUDGET_WARNING_MESSAGE);
  });

  it('shows paused message to owners at 100% budget', () => {
    const warning = getEverittteamBudgetWarning(
      { applies: true, budgetUsd: 10, usedUsd: 10, percentUsed: 100 },
      true
    );
    assert.equal(warning, EVERITTTEAM_BUDGET_PAUSED_MESSAGE);
  });

  it('does not warn non-owners', () => {
    const warning = getEverittteamBudgetWarning(
      { applies: true, budgetUsd: 10, usedUsd: 9.5, percentUsed: 95 },
      false
    );
    assert.equal(warning, null);
  });

  it('exports the hard-stop message required by product spec', () => {
    assert.equal(
      EVERITTTEAM_BUDGET_EXHAUSTED_MESSAGE,
      'EVERITTTEAM AI budget has been reached for this month.'
    );
    assert.equal(EVERITTTEAM_PROMO_CODE, 'EVERITTTEAM');
  });
});
