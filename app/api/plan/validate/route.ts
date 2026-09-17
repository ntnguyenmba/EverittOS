import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { enforcePlanForUser } from '@/lib/plan-enforce-server';
import type { PlanResource } from '@/lib/plan-validate';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getPlanApiCopy } from '@/lib/i18n/plan-api-copy';

export async function POST(request: Request) {
  const c = getPlanApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { resource?: PlanResource };
  const resource = body.resource;
  if (!resource) return NextResponse.json({ error: c.resourceRequired }, { status: 400 });

  const result = await enforcePlanForUser(supabase, user.id, resource);
  return NextResponse.json(result);
}
