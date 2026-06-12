import { NextResponse } from 'next/server';
import { executeAiAction, type ProposedAiAction } from '@/lib/ai-actions';
import { verifyAiRequest } from '@/lib/ai-gate';
import { logAiGeneration } from '@/lib/ai-server';
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const gate = await verifyAiRequest(supabase, admin, user.id, { feature: 'ai_actions', requireManage: true });
  if (!gate.ok) {
    const status =
      gate.code === 'rate_limited' || gate.code === 'everittteam_budget_exhausted'
        ? 429
        : gate.code === 'budget_verification_failed'
          ? 503
          : 403;
    return NextResponse.json({ error: gate.message, code: gate.code, locked: gate.code === 'plan_required' }, { status });
  }

  const body = (await request.json()) as { action?: ProposedAiAction; confirmed?: boolean };
  if (!body.confirmed || !body.action?.type) {
    return NextResponse.json({ error: 'Action must be confirmed before execution.' }, { status: 400 });
  }

  const result = await executeAiAction(admin, {
    organizationId: gate.org.organizationId,
    userId: user.id,
    role: gate.org.role,
    action: body.action
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  await logAiGeneration(admin, {
    organizationId: gate.org.organizationId,
    userId: user.id,
    prompt: `Execute action: ${body.action.type}`,
    response: result.message,
    model: 'action',
    feature: 'ai_actions'
  });

  return NextResponse.json(result);
}
