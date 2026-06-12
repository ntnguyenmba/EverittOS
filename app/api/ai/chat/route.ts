import { NextResponse } from 'next/server';
import { AI_ACTION_SYSTEM_HINT, parseProposedAction } from '@/lib/ai-actions';
import { buildOrganizationAiContext } from '@/lib/ai-context';
import type { AiFeatureId } from '@/lib/ai-features';
import { verifyAiRequest } from '@/lib/ai-gate';
import { logAiGeneration, runAiChat, type AiChatMessage } from '@/lib/ai-server';
import { canSeeOrgWideData } from '@/lib/permissions';
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
    return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured', code: 'not_configured' }, { status: 503 });
  }

  const body = (await request.json()) as {
    prompt?: string;
    messages?: AiChatMessage[];
    feature?: AiFeatureId;
  };
  const feature = body.feature || 'ask_everitt';

  const gate = await verifyAiRequest(supabase, admin, user.id, { feature });
  if (!gate.ok) {
    const status =
      gate.code === 'plan_required' || gate.code === 'subscription_inactive' || gate.code === 'permission_denied'
        ? 403
        : gate.code === 'rate_limited'
          ? 429
          : gate.code === 'unauthorized' || gate.code === 'no_organization'
            ? 401
            : 503;
    return NextResponse.json(
      {
        error: gate.message,
        code: gate.code,
        requiredPlan: gate.requiredPlan || 'business',
        locked: gate.code === 'plan_required'
      },
      { status }
    );
  }

  if (!canSeeOrgWideData(gate.org.role)) {
    return NextResponse.json(
      { error: 'Your role cannot use Ask Everitt.', code: 'permission_denied', locked: false },
      { status: 403 }
    );
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const orgContext = await buildOrganizationAiContext(admin, gate.org.organizationId);

  const messages: AiChatMessage[] = body.messages?.length
    ? [...body.messages, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }];

  const result = await runAiChat(messages, `${AI_ACTION_SYSTEM_HINT}\n\n${orgContext}`, { feature });

  if (!result.ok) {
    const status = result.code === 'rate_limited' ? 429 : 503;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  const { cleanReply, action } = parseProposedAction(result.reply);

  await logAiGeneration(admin, {
    organizationId: gate.org.organizationId,
    userId: user.id,
    prompt,
    response: cleanReply,
    model: result.model,
    feature,
    usage: result.usage
  });

  return NextResponse.json({
    reply: cleanReply,
    model: result.model,
    provider: result.provider,
    action,
    usage: {
      monthlyUsed: gate.monthlyUsed + 1,
      monthlyCap: gate.monthlyCap,
      unlimited: gate.unlimited
    }
  });
}
