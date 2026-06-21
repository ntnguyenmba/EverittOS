import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBillingUser } from '@/lib/stripe-billing-sync';

type QueryResult = { data: Record<string, unknown> | null; error: null };

function mockAdmin(profiles: Record<string, Record<string, unknown>>) {
  let filterColumn = '';
  let filterValue = '';

  return {
    from(table: string) {
      if (table !== 'profiles') throw new Error(`Unexpected table ${table}`);
      return {
        select() {
          return this;
        },
        eq(column: string, value: string) {
          filterColumn = column;
          filterValue = value;
          return this;
        },
        ilike(column: string, value: string) {
          filterColumn = column;
          filterValue = value;
          return this;
        },
        maybeSingle(): Promise<QueryResult> {
          if (filterColumn === 'id') {
            const row = profiles[filterValue];
            return Promise.resolve({ data: row ? { ...row } : null, error: null });
          }
          if (filterColumn === 'stripe_customer_id') {
            const row = Object.values(profiles).find((profile) => profile.stripe_customer_id === filterValue);
            return Promise.resolve({ data: row ? { ...row } : null, error: null });
          }
          if (filterColumn === 'email') {
            const row = Object.values(profiles).find(
              (profile) => String(profile.email || '').toLowerCase() === filterValue.toLowerCase()
            );
            return Promise.resolve({ data: row ? { ...row } : null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }
      };
    }
  } as never;
}

test('resolveBillingUser prefers metadata user id before email', async () => {
  const admin = mockAdmin({
    user_a: { id: 'user_a', email: 'owner@example.com', stripe_customer_id: null }
  });
  const match = await resolveBillingUser(admin, {
    sessionUserId: 'user_a',
    email: 'different@example.com'
  });
  assert.equal(match?.id, 'user_a');
});

test('resolveBillingUser resolves stored Stripe customer id before email fallback', async () => {
  const admin = mockAdmin({
    user_a: { id: 'user_a', email: 'owner@example.com', stripe_customer_id: 'cus_saved123' }
  });
  const match = await resolveBillingUser(admin, {
    stripeCustomerId: 'cus_saved123',
    email: 'different@example.com'
  });
  assert.equal(match?.id, 'user_a');
});

test('resolveBillingUser falls back to email when metadata and customer id are absent', async () => {
  const admin = mockAdmin({
    user_a: { id: 'user_a', email: 'owner@example.com', stripe_customer_id: null }
  });
  const match = await resolveBillingUser(admin, { email: 'owner@example.com' });
  assert.equal(match?.id, 'user_a');
});
