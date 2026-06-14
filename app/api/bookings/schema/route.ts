import { NextResponse } from 'next/server';
import { probeBookingSchemaReady } from '@/lib/booking/schema';
import { requireBookingsPlan } from '@/lib/booking/plan-gate';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const planCheck = await requireBookingsPlan(ctx.supabase, ctx.userId);
  if (!planCheck.ok) {
    return NextResponse.json(planCheck.payload, { status: 403 });
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
