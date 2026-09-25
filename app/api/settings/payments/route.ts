import { NextResponse } from 'next/server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const METHODS = new Set(['', 'stripe', 'square', 'paypal', 'venmo', 'zelle', 'cash_app', 'custom']);

function safeLink(value: unknown): string | null | undefined {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  try { const url = new URL(raw); return url.protocol === 'https:' ? url.toString() : undefined; } catch { return undefined; }
}

export async function PATCH(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const body = await request.json();
  const method = String(body.preferredPaymentMethod || '').trim().toLowerCase();
  if (!METHODS.has(method)) return NextResponse.json({ error: 'Choose a valid payment method.' }, { status: 400 });
  const paymentLink = safeLink(body.paymentLink);
  if (paymentLink === undefined) return NextResponse.json({ error: 'Payment link must be a valid https:// address.' }, { status: 400 });
  const { error } = await ctx.supabase.from('organization_settings').upsert({ organization_id: ctx.workspace.organizationId, preferred_payment_method: method || null, payment_link: paymentLink, payment_instructions: String(body.paymentInstructions || '').trim() || null });
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: 'Invoice payment settings need the latest database migration.' }, { status: 503 });
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
