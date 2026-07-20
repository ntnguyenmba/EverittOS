import { NextResponse } from 'next/server';
import { fetchPublicCustomerReport } from '@/lib/customer-report';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;
  const trimmed = String(token || '').trim();
  if (!trimmed || trimmed.length < 16) {
    return NextResponse.json({ error: 'This report link is not available.' }, { status: 404 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const { report, error, status } = await fetchPublicCustomerReport(admin, trimmed);
  if (!report) {
    return NextResponse.json({ error: error || 'This report link is not available.' }, { status });
  }

  return NextResponse.json({ report });
}
