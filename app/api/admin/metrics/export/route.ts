import { NextResponse } from 'next/server';
import { fetchPlatformMetrics, platformMetricsToCsv } from '@/lib/platform-metrics';
import { isPlatformAdminEmail } from '@/lib/platform-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const metrics = await fetchPlatformMetrics();
  if (!metrics) {
    return NextResponse.json({ error: 'Server configuration incomplete.' }, { status: 503 });
  }

  const csv = platformMetricsToCsv(metrics);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="everittos-investor-metrics.csv"'
    }
  });
}
