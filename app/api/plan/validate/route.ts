import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { enforcePlanForUser } from '@/lib/plan-enforce-server';
import type { PlanResource } from '@/lib/plan-validate';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { resource?: PlanResource };
  const resource = body.resource;
  if (!resource) {
    return NextResponse.json({ error: 'resource is required' }, { status: 400 });
  }

  const result = await enforcePlanForUser(supabase, user.id, resource);
  return NextResponse.json(result);
}
