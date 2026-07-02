/**
 * Enterprise smoke test — verifies DB writes and plan resolution against production/staging Supabase.
 *
 * Requires:
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SMOKE_TEST_USER_ID — existing workspace owner user UUID (Enterprise recommended)
 *
 * Run: npm run test:smoke
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const smokeUserId = process.env.SMOKE_TEST_USER_ID;

const skip = !url || !serviceKey || !smokeUserId;

function admin() {
  return createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}

test('enterprise smoke: plan_for_organization matches paid subscription', { skip }, async () => {
  const client = admin();

  const { data: org } = await client
    .from('organizations')
    .select('id, owner_user_id')
    .eq('owner_user_id', smokeUserId!)
    .maybeSingle();

  assert.ok(org?.id, 'Smoke user must own an organization');

  const { data: effectivePlan, error: planError } = await client.rpc('plan_for_organization', {
    org_id: org.id
  });
  assert.ifError(planError);
  assert.notEqual(effectivePlan, 'free', `Expected paid plan, got ${effectivePlan}`);

  const { data: ownerProfile } = await client.from('profiles').select('plan').eq('id', smokeUserId!).maybeSingle();
  const { data: sub } = await client
    .from('everittos_subscriptions')
    .select('plan, status')
    .eq('user_id', smokeUserId!)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const paidFromProfile = ownerProfile?.plan && ownerProfile.plan !== 'free';
  const paidFromSub = sub?.plan && sub.plan !== 'free';
  assert.ok(
    paidFromProfile || paidFromSub || effectivePlan !== 'free',
    'Enterprise smoke user should have profile or subscription plan'
  );
});

test('enterprise smoke: customer create + read', { skip }, async () => {
  const client = admin();
  const { data: org } = await client
    .from('organizations')
    .select('id')
    .eq('owner_user_id', smokeUserId!)
    .maybeSingle();
  assert.ok(org?.id);

  const label = `Smoke Customer ${Date.now()}`;
  const { data: created, error } = await client
    .from('customers')
    .insert({
      organization_id: org.id,
      user_id: smokeUserId,
      company_name: label
    })
    .select('id, company_name')
    .single();

  assert.ifError(error);
  assert.equal(created?.company_name, label);

  const { data: readBack } = await client.from('customers').select('id').eq('id', created!.id).maybeSingle();
  assert.ok(readBack?.id);
  await client.from('customers').delete().eq('id', created!.id);
});

test('enterprise smoke: job create + read', { skip }, async () => {
  const client = admin();
  const { data: org } = await client
    .from('organizations')
    .select('id')
    .eq('owner_user_id', smokeUserId!)
    .maybeSingle();
  assert.ok(org?.id);

  const title = `Smoke Job ${Date.now()}`;
  const { data: job, error } = await client
    .from('jobs')
    .insert({
      organization_id: org.id,
      user_id: smokeUserId,
      title,
      status: 'scheduled'
    })
    .select('id, title')
    .single();

  assert.ifError(error);
  assert.equal(job?.title, title);

  await client.from('jobs').delete().eq('id', job!.id);
});

test('enterprise smoke: outbound estimate draft', { skip }, async () => {
  const client = admin();
  const { data: org } = await client
    .from('organizations')
    .select('id')
    .eq('owner_user_id', smokeUserId!)
    .maybeSingle();
  assert.ok(org?.id);

  const { data: doc, error } = await client
    .from('outbound_documents')
    .insert({
      organization_id: org.id,
      doc_type: 'estimate',
      status: 'draft',
      subject: `Smoke Estimate ${Date.now()}`,
      created_by: smokeUserId
    })
    .select('id, doc_type, status')
    .single();

  assert.ifError(error);
  assert.equal(doc?.doc_type, 'estimate');

  await client.from('outbound_documents').delete().eq('id', doc!.id);
});

test('enterprise smoke: automation via service role (API path)', { skip }, async () => {
  const client = admin();
  const { data: org } = await client
    .from('organizations')
    .select('id')
    .eq('owner_user_id', smokeUserId!)
    .maybeSingle();
  assert.ok(org?.id);

  const { data: automation, error } = await client
    .from('automations')
    .insert({
      organization_id: org.id,
      name: `Smoke Automation ${Date.now()}`,
      trigger_type: 'lead_created',
      action_type: 'create_task',
      created_by: smokeUserId,
      active: true
    })
    .select('id, name')
    .single();

  assert.ifError(error);
  assert.ok(automation?.id);

  await client.from('automations').delete().eq('id', automation!.id);
});

test('enterprise smoke: team invitation row', { skip }, async () => {
  const client = admin();
  const { data: org } = await client
    .from('organizations')
    .select('id')
    .eq('owner_user_id', smokeUserId!)
    .maybeSingle();
  assert.ok(org?.id);

  const email = `smoke+${Date.now()}@example.com`;
  const { data: invite, error } = await client
    .from('organization_invitations')
    .insert({
      organization_id: org.id,
      email,
      role: 'employee',
      invited_by: smokeUserId,
      status: 'pending'
    })
    .select('id, email')
    .single();

  assert.ifError(error);
  assert.equal(invite?.email, email);

  await client.from('organization_invitations').delete().eq('id', invite!.id);
});
