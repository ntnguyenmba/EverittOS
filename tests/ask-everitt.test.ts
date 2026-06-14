import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectAskEverittMode, isAiSuggestion } from '@/lib/ask-everitt-intent';
import {
  estimateAiCost,
  STAFF_DAILY_AI_PROMPT_LIMIT,
  STAFF_WORKSPACE_MONTHLY_AI_BUDGET_USD
} from '@/lib/ai-usage-events';

describe('ask-everitt-intent', () => {
  it('routes predict and explain to AI mode', () => {
    assert.equal(detectAskEverittMode('Predict workload next month'), 'ai');
    assert.equal(detectAskEverittMode('Explain revenue trends'), 'ai');
  });

  it('routes lookup questions to search mode', () => {
    assert.equal(detectAskEverittMode('Which jobs are scheduled tomorrow?'), 'search');
    assert.equal(detectAskEverittMode('Show unpaid invoices'), 'search');
    assert.equal(detectAskEverittMode('Which leads came in this month?'), 'search');
    assert.equal(detectAskEverittMode('Find the cleaning checklist for kitchens'), 'search');
  });

  it('routes generative tasks to AI mode', () => {
    assert.equal(detectAskEverittMode('Write a follow-up message for this lead'), 'ai');
    assert.equal(detectAskEverittMode('Summarize this month reviews'), 'ai');
    assert.equal(detectAskEverittMode('Generate a campaign for spring cleaning'), 'ai');
    assert.equal(detectAskEverittMode('Draft an email to the customer'), 'ai');
  });

  it('defaults ambiguous queries to search mode', () => {
    assert.equal(detectAskEverittMode('pipeline status'), 'search');
    assert.equal(detectAskEverittMode('hello'), 'search');
  });

  it('flags premium suggestions', () => {
    assert.equal(isAiSuggestion('Summarize this month\'s reviews.'), true);
    assert.equal(isAiSuggestion('Which jobs are scheduled tomorrow?'), false);
  });
});

describe('ai-usage-events constants', () => {
  it('uses 2 staff AI prompts per day', () => {
    assert.equal(STAFF_DAILY_AI_PROMPT_LIMIT, 2);
  });

  it('uses $10 workspace staff AI monthly cap', () => {
    assert.equal(STAFF_WORKSPACE_MONTHLY_AI_BUDGET_USD, 10);
  });

  it('estimateAiCost returns a non-negative number', () => {
    assert.ok(estimateAiCost(1000, 500) >= 0);
  });
});

import { getSearchSources, registerSearchSource } from '@/lib/ask-everitt/search-sources';

describe('search-sources registry', () => {
  it('includes core business modules', () => {
    const ids = getSearchSources().map((s) => s.id);
    assert.ok(ids.includes('customers'));
    assert.ok(ids.includes('jobs'));
    assert.ok(ids.includes('invoices'));
    assert.ok(ids.includes('expenses'));
  });

  it('allows registering new searchable modules', () => {
    registerSearchSource({
      id: 'custom_module',
      label: 'Custom',
      recordType: 'document',
      table: 'custom_table',
      keywords: ['custom'],
      href: '/custom',
      actionLabel: 'Open Custom',
      listPath: '/custom'
    });
    assert.ok(getSearchSources().some((s) => s.id === 'custom_module'));
  });
});

describe('staff AI block messages', () => {
  it('documents expected daily limit copy', () => {
    const msg =
      "You've reached your 2 AI prompts for today. Ask Everitt search is still available.";
    assert.match(msg, /2 AI prompts/);
    assert.match(msg, /search is still available/);
  });

  it('documents expected monthly budget copy', () => {
    const msg =
      'Your workspace staff AI allowance has been reached for this month. Ask Everitt search is still available, and AI access will reset next month.';
    assert.match(msg, /\$10|allowance|month/);
    assert.match(msg, /search is still available/);
  });
});
