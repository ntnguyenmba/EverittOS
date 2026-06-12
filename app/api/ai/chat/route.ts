import { NextResponse } from 'next/server';
import {
  assertAiAllowed,
  logAiGeneration,
  runAiChat,
  type AiChatMessage
} from '@/lib/ai-server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const gate = await assertAiAllowed(admin, plan, org.organizationId);
  if (!gate.ok) {
    const status = gate.code === 'plan_required' ? 403 : gate.code === 'rate_limited' ? 429 : 503;
    return NextResponse.json({ error: gate.message, code: gate.code, requiredPlan: 'business' }, { status });
  }

  const body = (await request.json()) as { prompt?: string; messages?: AiChatMessage[] };
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const { data: memory } = await admin
    .from('organization_ai_memory')
    .select('company_profile, services, brand_voice, pricing_rules')
    .eq('organization_id', org.organizationId)
    .maybeSingle();

  const contextParts = [
    memory?.company_profile,
    memory?.services ? `Services: ${memory.services}` : null,
    memory?.brand_voice ? `Brand voice: ${memory.brand_voice}` : null,
    memory?.pricing_rules ? `Pricing: ${memory.pricing_rules}` : null
  ].filter(Boolean);

  const result = await runAiChat(
    body.messages?.length ? [...body.messages, { role: 'user', content: prompt }] : [{ role: 'user', content: prompt }],
    contextParts.join('\n')
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: 503 });
  }

  await logAiGeneration(admin, {
    organizationId: org.organizationId,
    userId: user.id,
    prompt,
    response: result.reply,
    model: result.model,
    feature: 'ask_everitt'
  });

  return NextResponse.json({ reply: result.reply, model: result.model });
}
