import type { AppLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import vi from '@/messages/vi.json';
import type { EverittosPlan } from '@/lib/everittos-plans';

const MESSAGE_CATALOG: Record<AppLocale, typeof en> = { en, es, vi };

type MessageTree = Record<string, unknown>;

function getNestedValue(tree: MessageTree, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = tree;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as MessageTree)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export function getMessagesForLocale(locale: AppLocale): typeof en {
  return MESSAGE_CATALOG[locale] || MESSAGE_CATALOG.en;
}

export function translateMessage(
  locale: AppLocale,
  key: string,
  values?: Record<string, string | number>
): string {
  const tree = getMessagesForLocale(locale) as MessageTree;
  const value = getNestedValue(tree, key) ?? getNestedValue(MESSAGE_CATALOG.en as MessageTree, key);
  if (!value) return key;
  return interpolate(value, values);
}

export function translatedPlanName(locale: AppLocale, plan: EverittosPlan | string): string {
  const normalized = plan === 'free' ? 'free' : plan;
  return translateMessage(locale, `plans.${normalized}`, {}) || String(plan);
}

export function translatedRoleName(locale: AppLocale, role: string): string {
  return translateMessage(locale, `roles.${role}`, {}) || role;
}

export const ONBOARDING_STEP_KEYS = [
  'onboarding.steps.workspace',
  'onboarding.steps.customer',
  'onboarding.steps.job',
  'onboarding.steps.photo',
  'onboarding.steps.report',
  'onboarding.steps.invite'
] as const;

export const ONBOARDING_STEP_SHORT_KEYS = [
  'onboarding.stepsShort.workspace',
  'onboarding.stepsShort.customer',
  'onboarding.stepsShort.job',
  'onboarding.stepsShort.photo',
  'onboarding.stepsShort.report',
  'onboarding.stepsShort.invite'
] as const;

export const EMPTY_STATE_KEYS = {
  workers: 'empty.workers',
  customers: 'empty.customers',
  jobs: 'empty.jobs',
  schedule: 'empty.schedule',
  activity: 'empty.activity',
  notifications: 'empty.notifications',
  workflows: 'empty.workflows',
  photos: 'empty.photos'
} as const;

export type EmptyStateKey = keyof typeof EMPTY_STATE_KEYS;
