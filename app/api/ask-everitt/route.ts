import { NextResponse } from 'next/server';
import { AI_ACTION_SYSTEM_HINT, parseProposedAction } from '@/lib/ai-actions';
import { assertAskEverittSearchAccess, searchUsageEvent } from '@/lib/ask-everitt-access';
import { detectAskEverittMode } from '@/lib/ask-everitt-intent';
import { formatPrefetchedContextForAi, prefetchAskEverittContextForAi } from '@/lib/ask-everitt/ai-prefetch';
import { localizeAskEverittSearchResponse, type AskEverittLocale } from '@/lib/ask-everitt/localize';
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

function normalizeAskLocale(value?: string | null): AskEverittLocale {
  const normalized = String(value || '').toLowerCase();
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('vi')) return 'vi';
  return 'en';
}

function languageInstruction(locale: AskEverittLocale): string {
  if (locale === 'es') return 'Respond in Spanish. Keep business names, customer names, and database field values unchanged.';
  if (locale === 'vi') return 'Respond in Vietnamese. Keep business names, customer names, and database field values unchanged.';
  return 'Respond in English.';
}

function currentPageContext(request: Request): string {
  const referer = request.headers.get('referer');
  if (!referer) return '';
  try {
    const url = new URL(referer);
    const params = new URLSearchParams(url.search);
    const safePairs: string[] = [];
    for (const [key, value] of params.entries()) {
      if (!key || !value) continue;
      if (/token|secret|key|code|email|phone|feed|url/i.test(key)) continue;
      safePairs.push(`${key}=${value.slice(0, 120)}`);
      if (safePairs.length >= 12) break;
    }
    const filterText = safePairs.length ? ` Active filters: ${safePairs.join(', ')}.` : '';
    return `Current EverittOS page: ${url.pathname}.${filterText}`;
  } catch {
    return '';
  }
}

function pageAwarePrompt(prompt: string, pageContext: string): string {
  if (!pageContext) return prompt;
  return `${prompt}\n\n[Current app context: ${pageContext}]`;
}

const BUSINESS_DATA_RULES = `Use current workspace data as the source of truth. When the current page or its active filters are relevant, answer in that context instead of silently switching to all-time or all-workspace data. Keep these concepts separate: Money in = customer cash actually received; Still owed = customer balances not yet collected; Job revenue = money received plus customer balances for the selected period; Paid contractors = cash already paid to contractors; Contractor costs = labor cost whether paid or unpaid; Business expenses = non-contractor operating expenses; Money kept = cash received minus paid contractor cash and business expenses; Profit = job revenue minus contractor costs and business expenses. Bookkeeping is operational recordkeeping and is not tax, accounting, or legal advice. If data is insufficient, say what is missing instead of guessing. Prefer exact records and amounts from workspace data, and point the user to the relevant job, customer, invoice, expense, worker, or report when available. Never expose data the user's role is not allowed to access.`;

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

  const body = (await request.json()) as { prompt?: string; forceMode?: 'search' | 'ai'; locale?: string };
  const prompt = body.prompt?.trim();
  const locale = normalizeAskLocale(body.locale);
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
  const pageContext = currentPageContext(request);
  const contextualPrompt = pageAwarePrompt(prompt, pageContext);

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

    const searchResult = await runAskEverittSearchEngine(supabase, org.organizationId, contextualPrompt);
    await recordAiUsage(admin, searchUsageEvent({
      workspaceId: org.organizationId,
      userId: user.id,
      userRole: normalizeRole(org.role),
      prompt
    }));

    return NextResponse.json(localizeAskEverittSearchResponse(searchResult, locale));
  }

  const gate = await verifyAiRequest(supabase, admin, user.id, { feature: 'ask_everitt' });
  if (!gate.ok) {
    const status =
      gate.code === 'plan_required' || gate.code === 'subscription_inactive'
        ? 403
        : gate.code === 'rate_limited' ||
            gate.code === 'everittteam_budget_exhausted' ||
            gate.code === 'staff_daily_limit' ||
            gate.code === 'staff_monthly_limit'
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

  const prefetched = await prefetchAskEverittContextForAi(supabase, org.organizationId, contextualPrompt);
  const dataContext = formatPrefetchedContextForAi(prefetched);

  const orgContext = await buildOrganizationAiContext(admin, gate.org.organizationId);
  const messages: AiChatMessage[] = [
    {
      role: 'user',
      content: `${languageInstruction(locale)}\n\n${prompt}\n\n${pageContext ? `--- Current EverittOS page context ---\n${pageContext}\n\n` : ''}--- Workspace data (from Supabase, use as facts) ---\n${dataContext}`
    }
  ];
  const result = await runAiChat(messages, `${AI_ACTION_SYSTEM_HINT}\n\n${languageInstruction(locale)}\n\n${BUSINESS_DATA_RULES}\n\n${orgContext}`, {
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
