import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function publicClient() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const { data, error } = await publicClient().rpc('get_public_quote', { p_token: token });
  if (error) return NextResponse.json({ error: 'quote_not_found', code: 'quote_not_found' }, { status: 404 });
  const quote = Array.isArray(data) ? data[0] : data;
  if (!quote) return NextResponse.json({ error: 'quote_not_found', code: 'quote_not_found' }, { status: 404 });
  return NextResponse.json({ quote });
}

export async function PATCH(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status || '');
  if (status !== 'accepted' && status !== 'declined') {
    return NextResponse.json({ error: 'invalid_status', code: 'invalid_status' }, { status: 400 });
  }
  const { data, error } = await publicClient().rpc('respond_public_quote', { p_token: token, p_status: status });
  if (error) return NextResponse.json({ error: 'quote_not_found', code: 'quote_not_found' }, { status: 404 });
  const quote = Array.isArray(data) ? data[0] : data;
  if (!quote) return NextResponse.json({ error: 'quote_not_found', code: 'quote_not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, quote });
}
