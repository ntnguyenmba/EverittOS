import { NextResponse } from 'next/server';
import { buildOrganizationAiContext } from '@/lib/ai-context';
import type { AiFeatureId } from '@/lib/ai-features';
import { verifyAiRequest } from '@/lib/ai-gate';
import { logAiGeneration, runAiChat } from '@/lib/ai-server';
import { canSeeOrgWideData } from '@/lib/permissions';
import { aiModeUsageEvent, recordAiUsage } from '@/lib/ai-usage-events';
import { normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getAiApiCopy } from '@/lib/i18n/ai-api-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GENERATION_PROMPTS: Record<string, { feature: AiFeatureId; instruction: string }> = {
  proposal: {
    feature: 'proposal_generation',
    instruction: 'Generate a professional service proposal with scope, pricing placeholders, and terms. Use organization context.'
  },
  email: {
    feature: 'email_drafting',
    instruction: 'Draft a polished client email. Include subject line and body. Match brand voice from context.'
  },
  sop: {
    feature: 'sop_generation',
    instruction: 'Generate a standard operating procedure with numbered steps and checklist items.'
  },
  meeting: {
    feature: 'meeting_summary',
    instruction: 'Summarize meeting notes into: Summary, Action Items, Tasks, and Follow-ups.'
  },
  insight: {
    feature: 'business_insights',
    instruction: 'Provide business insights: revenue trends, pipeline risks, workload, and lead conversion opportunities based on context.'
  }
};

export async function POST(request: Request) {
  const locale = localeFromRequest(request);
  const c = getAiApiCopy(locale);
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { type?: string; input?: string; feature?: AiFeatureId };
  const genType = body.type || 'proposal';
  const preset = GENERATION_PROMPTS[genType] || GENERATION_PROMPTS.proposal;
  const feature = body.feature || preset.feature;

  const gate = await verifyAiRequest(supabase, admin, user.id, { feature, locale });
  if (!gate.ok) {
    const status =
      gate.code === 'rate_limited' ||
      gate.code === 'everittteam_budget_exhausted' ||
      gate.code === 'staff_daily_limit' ||
      gate.code === 'staff_monthly_limit'
        ? 429
        : gate.code === 'budget_verification_failed' || gate.code === 'not_configured'
          ? 503
          : gate.code === 'unauthorized' || gate.code === 'no_organization'
            ? 401
            : 403;
    return NextResponse.json(
      { error: gate.message, code: gate.code, locked: gate.code === 'plan_required', requiredPlan: 'business' },
      { status }
    );
  }

  if (!canSeeOrgWideData(gate.org.role)) {
    return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  }

  const userInput = body.input?.trim() || `Generate ${genType}`;
  const orgContext = await buildOrganizationAiContext(admin, gate.org.organizationId);

  const result = await runAiChat(
    [{ role: 'user', content: `${preset.instruction}\n\nUser request: ${userInput}` }],
    orgContext,
    { feature }
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: 503 });
  }

  await logAiGeneration(admin, {
    organizationId: gate.org.organizationId,
    userId: user.id,
    prompt: userInput,
    response: result.reply,
    model: result.model,
    feature,
    usage: result.usage
  });

  await recordAiUsage(
    admin,
    aiModeUsageEvent({
      workspaceId: gate.org.organizationId,
      userId: user.id,
      userRole: normalizeRole(gate.org.role),
      feature,
      prompt: userInput,
      inputTokens: result.usage.promptTokens,
      outputTokens: result.usage.completionTokens,
      estimatedCost: result.usage.estimatedCostUsd
    })
  );

  return NextResponse.json({
    content: result.reply,
    model: result.model,
    provider: result.provider,
    type: genType
  });
}
