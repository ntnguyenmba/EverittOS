import { isDemoFeatureEnabled } from '@/lib/demo-guard';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const DEMO_ORG_NAME = 'Everitt Demo Services';
export const DEMO_USER_EMAIL = 'demo@everittventures.com';

export type DemoSeedResult =
  | { ok: true; organizationId: string; message: string }
  | { ok: false; message: string };

export async function seedDemoOrganization(userId: string, email: string): Promise<DemoSeedResult> {
  if (!isDemoFeatureEnabled()) {
    return { ok: false, message: 'Demo workspaces are not available in production.' };
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return { ok: false, message: 'Demo setup unavailable on this server.' };
  }

  const { data: existingMember } = await admin
    .from('organization_members')
    .select('organization_id, organizations!inner(is_demo)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (existingMember?.organization_id) {
    return { ok: true, organizationId: existingMember.organization_id, message: 'Demo workspace already active.' };
  }

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name: DEMO_ORG_NAME, owner_user_id: userId, is_demo: true })
    .select('id')
    .single();

  if (orgError || !org) {
    return { ok: false, message: orgError?.message || 'Could not create demo organization.' };
  }

  const orgId = org.id;

  await admin.from('profiles').upsert({
    id: userId,
    email,
    organization_id: orgId,
    plan: 'growth',
    role: 'owner',
    account_status: 'active'
  });

  await admin.from('organization_members').upsert({
    organization_id: orgId,
    user_id: userId,
    role: 'owner',
    active: true
  });

  await admin.from('organization_settings').upsert({
    organization_id: orgId,
    company_email: email,
    company_phone: '512-555-0100',
    website: 'https://everittventures.com',
    company_address: 'Austin, TX',
    brand_primary_color: '#2D3748',
    brand_accent_color: '#4A6354',
    onboarding_completed: true,
    onboarding_step: 6
  });

  const { data: customer } = await admin
    .from('customers')
    .insert({
      user_id: userId,
      organization_id: orgId,
      name: 'Riverfront Property Group',
      phone: '512-555-0188',
      email: 'ops@riverfront.example',
      address: '1200 Congress Ave'
    })
    .select('id')
    .single();

  const { data: worker } = await admin
    .from('workers')
    .insert({
      user_id: userId,
      organization_id: orgId,
      name: 'Jordan Lee',
      role: 'technician',
      phone: '512-555-0199'
    })
    .select('id')
    .single();

  const { data: job } = await admin
    .from('jobs')
    .insert({
      user_id: userId,
      organization_id: orgId,
      customer_id: customer?.id || null,
      title: 'Quarterly HVAC inspection',
      customer_name: 'Riverfront Property Group',
      status: 'scheduled',
      assigned_to: worker?.id || null,
      start_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
    })
    .select('id')
    .single();

  await admin.from('activity_logs').insert({
    organization_id: orgId,
    user_id: userId,
    actor_name: 'Demo seed',
    entity_type: 'organization',
    entity_id: orgId,
    action: 'user_created',
    message: 'Demo workspace seeded with sample data',
    metadata: { is_demo: true }
  });

  if (job?.id) {
    await admin.from('activity_logs').insert({
      organization_id: orgId,
      user_id: userId,
      actor_name: 'Demo seed',
      entity_type: 'job',
      entity_id: job.id,
      action: 'job_created',
      message: 'Sample job created for demo',
      metadata: { title: 'Quarterly HVAC inspection' }
    });
  }

  return { ok: true, organizationId: orgId, message: 'Demo workspace ready with sample data.' };
}

export async function isDemoOrganization(organizationId: string): Promise<boolean> {
  const admin = createAdminSupabase();
  if (!admin) return false;
  const { data } = await admin.from('organizations').select('is_demo').eq('id', organizationId).maybeSingle();
  return Boolean(data?.is_demo);
}
