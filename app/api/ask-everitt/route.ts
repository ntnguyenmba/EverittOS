import { NextResponse } from 'next/server';
import { AI_ACTION_SYSTEM_HINT, parseProposedAction } from '@/lib/ai-actions';
import { assertAskEverittSearchAccess, searchUsageEvent } from '@/lib/ask-everitt-access';
import { detectAskEverittMode } from '@/lib/ask-everitt-intent';
import { formatPrefetchedContextForAi, prefetchAskEverittContextForAi } from '@/lib/ask-everitt/ai-prefetch';
import { runAskEverittSearchEngine } from '@/lib/ask-everitt/search-engine';
import { buildOrganizationAiContext } from '@/lib/ai-context';
import { verifyAiRequest } from '@/lib/ai-gate';
import { logAiGeneration, runAiChat, type AiChatMessage } from '@/lib/ai-server';
import { recordAiUsage } from '@/lib/ai-usage-events';
import { isClientRole, normalizeRole } from '@/lib/roles';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
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

  const body = (await request.json()) as { prompt?: string; forceMode?: 'search' | 'ai' };
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) {
    return NextResponse.json({ error: 'No active workspace found.', code: 'no_organization' }, { status: 403 });
  }

  if (isClientRole(org.role)) {
    return NextResponse.json({ error: 'Your role cannot use Ask Everitt.', code: 'permission_denied' }, { status: 403 });
  }

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  const mode = body.forceMode || detectAskEverittMode(prompt);

  if (mode === 'search') {
    const searchAccess = await assertAskEverittSearchAccess(
      admin,
      user.id,
      org.role,
      org.organizationId,
      plan
    );
    if (!searchAccess.ok) {
      return NextResponse.json(
        { error: searchAccess.message, code: searchAccess.code, mode: 'search' },
        { status: searchAccess.code === 'search_daily_limit' ? 429 : 403 }
      );
    }

    const searchResult = await runAskEverittSearchEngine(supabase, org.organizationId, prompt);
    await recordAiUsage(admin, searchUsageEvent({
      workspaceId: org.organizationId,
      userId: user.id,
      userRole: normalizeRole(org.role),
      prompt
    }));

    return NextResponse.json(searchResult);
  }

  // Everitt AI Mode — premium, cost-controlled (staff/plan gates inside verifyAiRequest)
  const gate = await verifyAiRequest(supabase, admin, user.id, { feature: 'ask_everitt' });
  if (!gate.ok) {
    const status =
      gate.code === 'plan_required' || gate.code === 'subscription_inactive'
        ? 403
        : gate.code === 'rate_limited' ||
            gate.code === 'everittteam_budget_exhausted' ||
            gate.code === 'staff_daily_limit' ||
            gate.code === 'staff_budget_exhausted'
          ? 429
          : 503;
    return NextResponse.json(
      {
        error: gate.message,
        code: gate.code,
        mode: 'ai',
        searchAvailable: true,
        locked: gate.code === 'plan_required',
        requiredPlan: gate.requiredPlan || 'business'
      },
      { status }
    );
  }

  const prefetched = await prefetchAskEverittContextForAi(supabase, org.organizationId, prompt);
  const dataContext = formatPrefetchedContextForAi(prefetched);

  const orgContext = await buildOrganizationAiContext(admin, gate.org.organizationId);
  const messages: AiChatMessage[] = [
    {
      role: 'user',
      content: `${prompt}\n\n--- Workspace data (from Supabase, use as facts) ---\n${dataContext}`
    }
  ];
  const result = await runAiChat(messages, `${AI_ACTION_SYSTEM_HINT}\n\n${orgContext}`, {
    feature: 'ask_everitt'
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code, mode: 'ai', searchAvailable: true },
      { status: result.code === 'rate_limited' ? 429 : 503 }
    );
  }

  const { cleanReply, action } = parseProposedAction(result.reply);

  await logAiGeneration(admin, {
    organizationId: gate.org.organizationId,
    userId: user.id,
    prompt,
    response: cleanReply,
    model: result.model,
    feature: 'ask_everitt',
    usage: result.usage
  });

  await recordAiUsage(admin, {
    workspaceId: gate.org.organizationId,
    userId: user.id,
    userRole: normalizeRole(gate.org.role),
    feature: 'ask_everitt',
    mode: 'ai',
    prompt,
    inputTokens: result.usage.promptTokens,
    outputTokens: result.usage.completionTokens,
    estimatedCost: result.usage.estimatedCostUsd
  });

  return NextResponse.json({
    mode: 'ai',
    reply: cleanReply,
    model: result.model,
    provider: result.provider,
    action,
    prefetchedSummary: prefetched.summary,
    usage: {
      monthlyUsed: gate.monthlyUsed + 1,
      monthlyCap: gate.monthlyCap,
      unlimited: gate.unlimited
    }
  });
}
