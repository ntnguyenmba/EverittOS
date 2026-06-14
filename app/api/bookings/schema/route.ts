import { NextResponse } from 'next/server';
import { probeBookingSchemaReady } from '@/lib/booking/schema';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const probe = await probeBookingSchemaReady(ctx.supabase);
  if (!probe.ready) {
    return NextResponse.json(
      {
        schemaReady: false,
        code: probe.code,
        missing: probe.missing,
        error: probe.error
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    schemaReady: true,
    tables: ['bookings', 'services', 'staff_services', 'staff_availability']
  });
}
