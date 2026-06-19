import type { EverittosPlan } from '@/lib/everittos-plans';
import { canAccessFeature } from '@/lib/plan-access';

/** AI capability identifiers — extend without breaking callers. */
export type AiFeatureId =
  | 'ask_everitt'
  | 'ai_chat'
  | 'ai_memory'
  | 'knowledge_search'
  | 'proposal_generation'
  | 'sop_generation'
  | 'email_drafting'
  | 'meeting_summary'
  | 'workflow_suggestions'
  | 'ai_actions'
  | 'business_insights';

export const AI_FEATURE_LABELS: Record<AiFeatureId, string> = {
  ask_everitt: 'Ask Everitt',
  ai_chat: 'AI Chat',
  ai_memory: 'AI Memory',
  knowledge_search: 'Knowledge Vault AI Search',
  proposal_generation: 'AI Proposal Generation',
  sop_generation: 'AI SOP Generation',
  email_drafting: 'AI Email Drafting',
  meeting_summary: 'AI Meeting Summaries',
  workflow_suggestions: 'AI Workflow Suggestions',
  ai_actions: 'AI Actions',
  business_insights: 'AI Business Insights'
};

/** Plans with any AI access (Business + Enterprise in EverittOS). */
export const AI_REQUIRED_PLAN = 'business' as const;

export function planHasAiAccess(plan: EverittosPlan): boolean {
  return canAccessFeature(plan, 'aiAccess');
}

export function isAiFeatureAvailable(_feature: AiFeatureId, plan: EverittosPlan): boolean {
  return planHasAiAccess(plan);
}

export const ASK_EVERITT_SEARCH_SUGGESTIONS = [
  'What needs attention today?',
  'Show today\'s schedule.',
  'Which jobs are overdue?',
  'Which invoices are unpaid?',
  'Which leads need follow-up?',
  'What changed this week?',
  'Who are my best customers?',
  'Show revenue this month.',
  'Show new leads this week.',
  'Show customers who have not booked in 90 days.'
] as const;

export const ASK_EVERITT_AI_SUGGESTIONS = [
  { text: 'Write today\'s business brief.', premium: true },
  { text: 'Tell me what to focus on next.', premium: true },
  { text: 'Draft a follow-up message for open leads.', premium: true },
  { text: 'Write a payment reminder for unpaid invoices.', premium: true },
  { text: 'Summarize recent reviews.', premium: true },
  { text: 'Draft a reactivation message for inactive customers.', premium: true }
] as const;

/** @deprecated Use ASK_EVERITT_SEARCH_SUGGESTIONS + ASK_EVERITT_AI_SUGGESTIONS */
export const ASK_EVERITT_SUGGESTIONS = [
  ...ASK_EVERITT_SEARCH_SUGGESTIONS,
  ...ASK_EVERITT_AI_SUGGESTIONS.map((s) => s.text)
] as const;
