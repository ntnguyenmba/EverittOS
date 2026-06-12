import { NextResponse } from 'next/server';
import { buildOrganizationAiContext } from '@/lib/ai-context';
import type { AiFeatureId } from '@/lib/ai-features';
import { verifyAiRequest } from '@/lib/ai-gate';
import { logAiGeneration, runAiChat } from '@/lib/ai-server';
import { canSeeOrgWideData } from '@/lib/permissions';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

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
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const body = (await request.json()) as { type?: string; input?: string; feature?: AiFeatureId };
  const genType = body.type || 'proposal';
  const preset = GENERATION_PROMPTS[genType] || GENERATION_PROMPTS.proposal;
  const feature = body.feature || preset.feature;

  const gate = await verifyAiRequest(supabase, admin, user.id, { feature });
  if (!gate.ok) {
    const status =
      gate.code === 'rate_limited' || gate.code === 'everittteam_budget_exhausted'
        ? 429
        : gate.code === 'budget_verification_failed'
          ? 503
          : 403;
    return NextResponse.json(
      { error: gate.message, code: gate.code, locked: gate.code === 'plan_required', requiredPlan: 'business' },
      { status }
    );
  }

  if (!canSeeOrgWideData(gate.org.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
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

  return NextResponse.json({
    content: result.reply,
    model: result.model,
    provider: result.provider,
    type: genType
  });
}
