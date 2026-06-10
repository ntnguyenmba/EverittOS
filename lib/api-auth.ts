import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyApiKey } from '@/lib/api-keys';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { resolveOrganizationPlan } from '@/lib/organization-plan';

export type ApiAuthContext = {
  admin: SupabaseClient;
  organizationId: string;
  plan: EverittosPlan;
  keyId: string;
  scopes: string[];
};

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function authenticateApiRequest(request: Request): Promise<ApiAuthContext | NextResponse> {
  const admin = createAdminSupabase();
  if (!admin) {
    return jsonError('API service is not configured.', 503);
  }

  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonError('Missing or invalid Authorization header. Use Bearer API_KEY.', 401);
  }

  const rawKey = authHeader.slice(7).trim();
  const keyRow = await verifyApiKey(admin, rawKey);
  if (!keyRow) {
    return jsonError('Invalid or revoked API key.', 401);
  }

  const { plan } = await resolveOrganizationPlan(admin, keyRow.created_by);
  const orgPlan = await resolveOrganizationPlanForOrg(admin, keyRow.organization_id);
  const effectivePlan = orgPlan || plan;

  if (!limitsForPlan(effectivePlan).apiAccess) {
    return jsonError('API access requires Growth or Enterprise plan.', 403);
  }

  return {
    admin,
    organizationId: keyRow.organization_id,
    plan: effectivePlan,
    keyId: keyRow.id,
    scopes: keyRow.scopes || []
  };
}

async function resolveOrganizationPlanForOrg(
  admin: SupabaseClient,
  organizationId: string
): Promise<EverittosPlan> {
  const { data: org } = await admin.from('organizations').select('owner_user_id').eq('id', organizationId).maybeSingle();
  if (!org?.owner_user_id) return 'free';

  const { data: ownerProfile } = await admin.from('profiles').select('plan').eq('id', org.owner_user_id).maybeSingle();
  return normalizePlan(ownerProfile?.plan);
}

export function hasScope(ctx: ApiAuthContext, scope: string): boolean {
  return ctx.scopes.includes(scope);
}
