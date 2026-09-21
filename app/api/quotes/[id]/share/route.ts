import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isAdminRole, normalizeRole } from '@/lib/roles';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { meetsMinimumPlan } from '@/lib/plan-access';
import { normalizeLocale } from '@/lib/i18n/config';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getResourceApiCopy } from '@/lib/i18n/resource-api-copy';
import { getQuoteShareCopy, fillQuoteCopy } from '@/lib/i18n/quote-share-copy';
import { absoluteQuoteUrl, formatQuoteMoney, safeHtml } from '@/lib/quote-sharing';
import { sendTransactionalEmail } from '@/lib/email-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function canUseQuotes(role: string | null | undefined) {
  return isAdminRole(normalizeRole(role));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const apiCopy=getResourceApiCopy(localeFromRequest(request));
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  if (!canUseQuotes(ctx.workspace.role)) return NextResponse.json({ error: apiCopy.permissionDenied, code: 'permission_denied' }, { status: 403 });

  const resolved = await resolveOrganizationPlan(ctx.supabase, ctx.userId, ctx.workspace.organizationId);
  if (!meetsMinimumPlan(resolved.plan, 'pro')) {
    return NextResponse.json({ error: 'plan_required', code: 'plan_required', requiredPlan: 'pro' }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const locale = normalizeLocale(body.locale);
  const c = getQuoteShareCopy(locale);
  const { data: quote, error } = await ctx.supabase.from('quotes').select('*').eq('id', id).eq('organization_id', ctx.workspace.organizationId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!quote) return NextResponse.json({ error: 'quote_not_found', code: 'quote_not_found' }, { status: 404 });

  const token = quote.public_token || randomBytes(24).toString('base64url');
  const now = new Date().toISOString();
  const { error: updateError } = await ctx.supabase.from('quotes').update({
    public_token: token,
    public_locale: locale,
    status: quote.status === 'draft' ? 'shared' : quote.status,
    shared_at: quote.shared_at || now,
    updated_at: now
  }).eq('id', quote.id).eq('organization_id', ctx.workspace.organizationId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  const url = absoluteQuoteUrl(new URL(request.url).origin, token, locale);
  const mode = String(body.mode || 'link');
  if (mode !== 'email') return NextResponse.json({ ok: true, url, status: quote.status === 'draft' ? 'shared' : quote.status });

  const to = String(quote.customer_email || '').trim();
  if (!to) return NextResponse.json({ error: 'email_required', code: 'email_required', url }, { status: 400 });

  const { data: org } = await ctx.supabase.from('organizations').select('name').eq('id', ctx.workspace.organizationId).maybeSingle();
  const business = String(org?.name || 'EverittOS');
  const service = String(quote.service_type || c.service);
  const customer = String(quote.customer_name || c.customer);
  const price = formatQuoteMoney(Number(quote.price || 0), quote.currency, locale);
  const subject = fillQuoteCopy(c.emailSubject, { business });
  const text = [fillQuoteCopy(c.emailIntro, { business }), '', service, price, quote.notes || '', '', `${c.viewQuote}: ${url}`].filter(Boolean).join('\n');
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#132433"><p style="font-size:14px;color:#526777">${safeHtml(business)}</p><h1 style="font-size:26px;margin:12px 0">${safeHtml(c.quote)}</h1><p>${safeHtml(fillQuoteCopy(c.emailIntro,{business}))}</p><div style="border:1px solid #d5dee5;border-radius:18px;padding:20px;margin:24px 0"><div style="font-size:14px;color:#526777">${safeHtml(c.preparedFor)}</div><div style="font-size:18px;font-weight:700">${safeHtml(customer)}</div><div style="margin-top:18px;font-size:14px;color:#526777">${safeHtml(c.service)}</div><div style="font-size:18px;font-weight:700">${safeHtml(service)}</div><div style="margin-top:18px;font-size:14px;color:#526777">${safeHtml(c.price)}</div><div style="font-size:28px;font-weight:800">${safeHtml(price)}</div></div><a href="${safeHtml(url)}" style="display:inline-block;background:#285d78;color:#fff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:700">${safeHtml(c.viewQuote)}</a></div>`;
  const sent = await sendTransactionalEmail({ to, subject, html, text });
  if (!sent.sent) return NextResponse.json({ error: 'send_failed', code: 'send_failed', detail: sent.error, url }, { status: 502 });

  return NextResponse.json({ ok: true, sent: true, url, status: quote.status === 'draft' ? 'shared' : quote.status });
}
