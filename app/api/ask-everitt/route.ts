import { NextResponse } from 'next/server';
import { AI_ACTION_SYSTEM_HINT, parseProposedAction } from '@/lib/ai-actions';
import { assertAskEverittSearchAccess, searchUsageEvent } from '@/lib/ask-everitt-access';
import { runContextAwareAskQuery } from '@/lib/ask-everitt/context-query';
import { detectAskEverittMode } from '@/lib/ask-everitt-intent';
import { formatPrefetchedContextForAi, prefetchAskEverittContextForAi } from '@/lib/ask-everitt/ai-prefetch';
import { localizeAskEverittSearchResponse, type AskEverittLocale } from '@/lib/ask-everitt/localize';
import { parseNaturalAskEverittQuery } from '@/lib/ask-everitt/natural-query';
import { runAskEverittSearchEngine } from '@/lib/ask-everitt/search-engine';
import { buildRecord, response } from '@/lib/ask-everitt/search-helpers';
import { buildSmartAskSuggestions } from '@/lib/ask-everitt/smart-suggestions';
import { runStructuredNaturalQuery } from '@/lib/ask-everitt/structured-query';
import { runStructuredNaturalQueryV2 } from '@/lib/ask-everitt/structured-query-v2';
import { runStructuredNaturalQueryV3 } from '@/lib/ask-everitt/structured-query-v3';
import { queryUnpaidInvoices } from '@/lib/ask-everitt/unpaid-invoices';
import { buildOrganizationAiContext } from '@/lib/ai-context';
import { verifyAiRequest } from '@/lib/ai-gate';
import { logAiGeneration, runAiChat, type AiChatMessage } from '@/lib/ai-server';
import { recordAiUsage } from '@/lib/ai-usage-events';
import { isClientRole, normalizeRole } from '@/lib/roles';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
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

function isNextJobQuestion(prompt: string): boolean {
  return /\b(?:when(?:'|’)?s|when is|what(?:'|’)?s|what is|show|find|tell me)?\s*(?:my|our|the)?\s*next\s+(?:job|work|appointment)\b|\bnext\s+(?:job|work|appointment)\b/i.test(prompt);
}

function nextJobSummary(locale: AskEverittLocale, when: string, customer: string | null, title: string): string {
  const subject = customer ? `${title} · ${customer}` : title;
  if (locale === 'es') return `Su próximo trabajo es ${subject}, programado para ${when}.`;
  if (locale === 'vi') return `Công việc tiếp theo là ${subject}, được lên lịch vào ${when}.`;
  return `Your next job is ${subject}, scheduled for ${when}.`;
}

function noNextJobSummary(locale: AskEverittLocale): string {
  if (locale === 'es') return 'No hay próximos trabajos programados.';
  if (locale === 'vi') return 'Không có công việc sắp tới đã được lên lịch.';
  return 'No upcoming jobs are scheduled.';
}

async function queryNextJob(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
  locale: AskEverittLocale
) {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date, due_date, scheduled_start, assigned_to')
    .eq('organization_id', organizationId)
    .or(`scheduled_start.gte.${nowIso},start_date.gte.${today},due_date.gte.${today}`)
    .limit(200);

  if (error) return null;

  const excluded = new Set(['completed', 'complete', 'cancelled', 'canceled', 'archived']);
  const upcoming = (data || [])
    .filter((job) => !excluded.has(String(job.status || '').toLowerCase()))
    .map((job) => {
      const raw = job.scheduled_start || (job.start_date ? `${job.start_date}T00:00:00` : job.due_date ? `${job.due_date}T00:00:00` : null);
      const timestamp = raw ? new Date(raw).getTime() : Number.POSITIVE_INFINITY;
      return { job, raw, timestamp };
    })
    .filter((entry) => entry.raw && Number.isFinite(entry.timestamp) && entry.timestamp >= now.getTime() - 12 * 60 * 60 * 1000)
    .sort((a, b) => a.timestamp - b.timestamp);

  const first = upcoming[0];
  if (!first) {
    return response(noNextJobSummary(locale), [], {
      sourcesUsed: ['jobs', 'schedule'],
      noResultsHint: locale === 'es' ? 'Agregue una fecha u hora a un trabajo para que aparezca aquí.' : locale === 'vi' ? 'Thêm ngày hoặc giờ cho công việc để công việc xuất hiện ở đây.' : 'Add a date or time to a job so it appears here.'
    });
  }

  const job = first.job;
  const when = first.raw || job.start_date || job.due_date || '';
  const record = buildRecord('jobs', {
    id: job.id,
    type: 'job',
    title: job.title || job.customer_name || 'Job',
    subtitle: job.customer_name || null,
    status: job.status || null,
    date: job.start_date || job.due_date || String(when).slice(0, 10),
    owner: job.assigned_to ? (locale === 'es' ? 'Trabajador asignado' : locale === 'vi' ? 'Đã phân công nhân viên' : 'Worker assigned') : null,
    href: `/jobs/${job.id}`
  });

  return response(nextJobSummary(locale, when, job.customer_name || null, job.title || 'Job'), [record], {
    sourcesUsed: ['jobs', 'schedule']
  });
}

const BUSINESS_DATA_RULES = `Use current workspace data as the source of truth. When the current page or its active filters are relevant, answer in that context instead of silently switching to all-time or all-workspace data. Keep these concepts separate: Money in = customer cash actually received; Still owed = customer balances not yet collected; Job revenue = money received plus customer balances for the selected period; Paid contractors = cash already paid to contractors; Contractor costs = labor cost whether paid or unpaid; Business expenses = non-contractor operating expenses; Money kept = cash received minus paid contractor cash and business expenses; Profit = job revenue minus contractor costs and business expenses. Bookkeeping is operational recordkeeping and is not tax, accounting, or legal advice. If data is insufficient, say what is missing instead of guessing. Prefer exact records and amounts from workspace data, and point the user to the relevant job, customer, invoice, expense, worker, or report when available. Never expose data the user's role is not allowed to access.`;

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Server not configured', code: 'not_configured' }, { status: 503 });

  const body = (await request.json()) as { prompt?: string; forceMode?: 'search' | 'ai'; locale?: string };
  const prompt = body.prompt?.trim();
  const locale = normalizeAskLocale(body.locale);
  if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });

  const org = await fetchOrganizationContextForRequest(supabase, user.id);
  if (!org) return NextResponse.json({ error: 'No active workspace found.', code: 'no_organization' }, { status: 403 });
  if (isClientRole(org.role)) return NextResponse.json({ error: 'Your role cannot use Ask Everitt.', code: 'permission_denied' }, { status: 403 });

  const activeSupabase = supabase;
  const activeUser = user;
  const activeOrg = org;
  const activeAdmin = admin;
  const activePrompt = prompt;

  const { plan } = await resolveOrganizationPlan(activeSupabase, activeUser.id);
  const natural = parseNaturalAskEverittQuery(activePrompt);
  const detectedMode = detectAskEverittMode(activePrompt);
  const mode = body.forceMode || (natural.preferSearch ? 'search' : detectedMode);
  const pageContext = currentPageContext(request);
  const contextualPrompt = pageAwarePrompt(activePrompt, pageContext);

  async function runStructuredSearch() {
    const searchAccess = await assertAskEverittSearchAccess(activeAdmin, activeUser.id, activeOrg.role, activeOrg.organizationId, plan);
    if (!searchAccess.ok) {
      return NextResponse.json(
        { error: searchAccess.message, code: searchAccess.code, mode: 'search' },
        { status: searchAccess.code === 'search_daily_limit' ? 429 : 403 }
      );
    }

    const unpaidInvoices = natural.intent === 'unpaid_invoices'
      ? await queryUnpaidInvoices(activeSupabase, activeOrg.organizationId)
      : null;
    const contextualStructured = unpaidInvoices ? null : await runContextAwareAskQuery(activeSupabase, activeOrg.organizationId, prompt: activePrompt, locale, pageContext);
    const structuredV3 = unpaidInvoices || contextualStructured ? null : await runStructuredNaturalQueryV3(activeSupabase, activeOrg.organizationId, activeUser.id, prompt: activePrompt, locale);
    const structuredV2 = unpaidInvoices || contextualStructured || structuredV3 ? null : await runStructuredNaturalQueryV2(activeSupabase, activeOrg.organizationId, activeUser.id, prompt: activePrompt, locale);
    const structuredFallback = unpaidInvoices || contextualStructured || structuredV3 || structuredV2 ? null : await runStructuredNaturalQuery(activeSupabase, activeOrg.organizationId, activeUser.id, prompt: activePrompt, locale);
    const directResult = unpaidInvoices || contextualStructured || structuredV3 || structuredV2 || structuredFallback || (natural.intent === 'next_job' || isNextJobQuestion(activePrompt) ? await queryNextJob(activeSupabase, activeOrg.organizationId, locale) : null);
    const searchResult = directResult || await runAskEverittSearchEngine(activeSupabase, activeOrg.organizationId, natural.searchQuery || activePrompt);

    if (searchResult.results.length === 0) {
      searchResult.suggestions = await buildSmartAskSuggestions(activeSupabase, activeOrg.organizationId, locale, pageContext);
    }

    await recordAiUsage(activeAdmin, searchUsageEvent({ workspaceId: activeOrg.organizationId, userId: activeUser.id, userRole: normalizeRole(activeOrg.role), prompt: activePrompt }));
    return NextResponse.json(localizeAskEverittSearchResponse(searchResult, locale));
  }

  if (mode === 'search') return runStructuredSearch();

  const gate = await verifyAiRequest(activeSupabase, activeAdmin, activeUser.id, { feature: 'ask_everitt' });
  if (!gate.ok) {
    if ((gate.code === 'plan_required' || gate.code === 'subscription_inactive') && natural.hasRecordIntent) return runStructuredSearch();
    const status = gate.code === 'plan_required' || gate.code === 'subscription_inactive' ? 403 : gate.code === 'rate_limited' || gate.code === 'everittteam_budget_exhausted' || gate.code === 'staff_daily_limit' || gate.code === 'staff_monthly_limit' ? 429 : 503;
    return NextResponse.json({ error: gate.message, code: gate.code, mode: 'ai', searchAvailable: true, locked: gate.code === 'plan_required', requiredPlan: gate.requiredPlan || 'business' }, { status });
  }

  const prefetched = await prefetchAskEverittContextForAi(activeSupabase, activeOrg.organizationId, contextualPrompt);
  const dataContext = formatPrefetchedContextForAi(prefetched);
  const orgContext = await buildOrganizationAiContext(activeAdmin, gate.org.organizationId);
  const messages: AiChatMessage[] = [{ role: 'user', content: `${languageInstruction(locale)}\n\n${activePrompt}\n\n${pageContext ? `--- Current EverittOS page context ---\n${pageContext}\n\n` : ''}--- Workspace data (from Supabase, use as facts) ---\n${dataContext}` }];
  const result = await runAiChat(messages, `${AI_ACTION_SYSTEM_HINT}\n\n${languageInstruction(locale)}\n\n${BUSINESS_DATA_RULES}\n\n${orgContext}`, { feature: 'ask_everitt' });

  if (!result.ok) return NextResponse.json({ error: result.message, code: result.code, mode: 'ai', searchAvailable: true }, { status: result.code === 'rate_limited' ? 429 : 503 });

  const { cleanReply, action } = parseProposedAction(result.reply);
  await logAiGeneration(activeAdmin, { organizationId: gate.org.organizationId, userId: activeUser.id, prompt: activePrompt, response: cleanReply, model: result.model, feature: 'ask_everitt', usage: result.usage });
  await recordAiUsage(activeAdmin, { workspaceId: gate.org.organizationId, userId: activeUser.id, userRole: normalizeRole(gate.org.role), feature: 'ask_everitt', mode: 'ai', prompt: activePrompt, inputTokens: result.usage.promptTokens, outputTokens: result.usage.completionTokens, estimatedCost: result.usage.estimatedCostUsd });

  return NextResponse.json({ mode: 'ai', reply: cleanReply, model: result.model, provider: result.provider, action, prefetchedSummary: prefetched.summary, usage: { monthlyUsed: gate.monthlyUsed + 1, monthlyCap: gate.monthlyCap, unlimited: gate.unlimited } });
}
