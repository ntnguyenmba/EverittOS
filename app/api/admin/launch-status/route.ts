import { NextResponse } from 'next/server';
import { transactionalEmailConfigured } from '@/lib/email-provider';
import { isPlatformAdminEmail } from '@/lib/platform-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-config';

type CheckStatus = 'ok' | 'warn' | 'fail';

function scoreFromChecks(checks: { status: CheckStatus; weight: number }[]): number {
  const total = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.reduce((sum, c) => {
    if (c.status === 'ok') return sum + c.weight;
    if (c.status === 'warn') return sum + c.weight * 0.5;
    return sum;
  }, 0);
  return Math.round((earned / total) * 100);
}

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminSupabase();

  const envChecks = [
    { name: 'NEXT_PUBLIC_SUPABASE_URL', ok: !!getSupabaseUrl() },
    { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', ok: !!getSupabaseAnonKey() },
    { name: 'NEXT_PUBLIC_APP_URL', ok: !!process.env.NEXT_PUBLIC_APP_URL },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
    { name: 'STRIPE_SECRET_KEY', ok: !!process.env.STRIPE_SECRET_KEY },
    { name: 'STRIPE_WEBHOOK_SECRET', ok: !!process.env.STRIPE_WEBHOOK_SECRET },
    { name: 'RESEND_API_KEY', ok: !!process.env.RESEND_API_KEY },
    { name: 'EMAIL_FROM', ok: !!process.env.EMAIL_FROM },
    { name: 'ADMIN_EMAILS', ok: !!process.env.ADMIN_EMAILS }
  ];

  let dbStatus: CheckStatus = 'fail';
  let rlsStatus: CheckStatus = 'warn';
  let authStatus: CheckStatus = 'warn';

  if (admin) {
    const { error: profileError } = await admin.from('profiles').select('id').limit(1);
    dbStatus = profileError ? 'fail' : 'ok';

    const tables = ['jobs', 'customers', 'organization_members', 'notifications', 'activity_logs'];
    let probeOk = 0;
    for (const table of tables) {
      const { error } = await admin.from(table).select('id').limit(1);
      if (!error) probeOk += 1;
    }
    rlsStatus = probeOk >= tables.length - 1 ? 'ok' : probeOk > 0 ? 'warn' : 'fail';

    const { error: authProbe } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
    authStatus = authProbe ? 'warn' : 'ok';
  }

  const stripeStatus: CheckStatus = envChecks.find((e) => e.name === 'STRIPE_SECRET_KEY')?.ok ? 'ok' : 'fail';
  const emailConfigured = transactionalEmailConfigured();
  const emailStatus: CheckStatus = emailConfigured ? 'ok' : 'warn';
  const webhookStatus: CheckStatus = envChecks.find((e) => e.name === 'STRIPE_WEBHOOK_SECRET')?.ok ? 'ok' : 'fail';

  const envStatus: CheckStatus = envChecks.every((e) => e.ok) ? 'ok' : 'warn';

  const weighted: { status: CheckStatus; weight: number }[] = [
    { status: authStatus, weight: 15 },
    { status: stripeStatus, weight: 15 },
    { status: dbStatus, weight: 20 },
    { status: rlsStatus, weight: 20 },
    { status: envStatus, weight: 15 },
    { status: emailStatus, weight: 8 },
    { status: webhookStatus, weight: 7 }
  ];

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    launchReadinessScore: scoreFromChecks(weighted),
    checks: {
      auth: authStatus,
      stripe: stripeStatus,
      database: dbStatus,
      rls: rlsStatus,
      environment: envStatus,
      email: emailStatus,
      webhooks: webhookStatus
    },
    environmentVariables: envChecks.map((e) => ({ name: e.name, configured: e.ok })),
    emailReadiness: {
      configured: emailConfigured,
      resendApiKey: !!process.env.RESEND_API_KEY,
      emailFrom: !!process.env.EMAIL_FROM,
      message: emailConfigured
        ? 'Transactional email is configured. Verify your sending domain in Resend before launch.'
        : 'Transactional email is not configured. Invites and outbound messages will use copy-link fallback until RESEND_API_KEY and EMAIL_FROM are set.'
    },
    launchReady: emailConfigured && stripeStatus === 'ok' && dbStatus === 'ok'
  });
}
