import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAccountActive } from '@/lib/account-status';
import { mapAccessError } from '@/lib/auth-errors';
import { meetsMinimumPlan, minimumPlanForPath } from '@/lib/plan-access';
import { normalizePlan } from '@/lib/everittos-plans';
import { canSeeOrgWideData, hasPermission } from '@/lib/permissions';
import { isClientRole, normalizeRole } from '@/lib/roles';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { subscriptionBlocksPaidAccess } from '@/lib/subscription-access';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-config';

const AUTH_PREFIXES = [
  '/dashboard',
  '/jobs',
  '/workers',
  '/settings',
  '/demo',
  '/customers',
  '/schedule',
  '/onboarding',
  '/team',
  '/activity',
  '/notifications',
  '/billing',
  '/workflows',
  '/portal',
  '/admin'
];

const AUTH_ONLY_WHEN_LOGGED_OUT = ['/login', '/signup'];

const ROLE_BLOCKED_PREFIXES: { prefix: string; permission: 'manage_team' | 'manage_billing' | 'view_all_org_data' }[] = [
  { prefix: '/team', permission: 'manage_team' },
  { prefix: '/settings/billing', permission: 'manage_billing' },
  { prefix: '/admin', permission: 'view_all_org_data' }
];

function isProtectedPath(pathname: string) {
  return AUTH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectWithCookies(url: URL, source: NextResponse) {
  const redirect = NextResponse.redirect(url);
  source.cookies.getAll().forEach(({ name, value }) => {
    redirect.cookies.set(name, value);
  });
  return redirect;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      }
    }
  });

  const pathname = request.nextUrl.pathname;

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user && AUTH_ONLY_WHEN_LOGGED_OUT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return redirectWithCookies(new URL('/dashboard', request.url), supabaseResponse);
  }

  if (!isProtectedPath(pathname)) {
    return supabaseResponse;
  }

  if (!user) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname);
    login.searchParams.set('reason', 'session');
    login.searchParams.set('detail', mapAccessError('session').message);
    return redirectWithCookies(login, supabaseResponse);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_status, plan, role, subscription_status')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    if (pathname.startsWith('/onboarding')) {
      return supabaseResponse;
    }
    const onboarding = new URL('/onboarding', request.url);
    onboarding.searchParams.set('reason', 'profile');
    return redirectWithCookies(onboarding, supabaseResponse);
  }

  if (!isAccountActive(profile.account_status)) {
    await supabase.auth.signOut();
    const login = new URL('/login', request.url);
    login.searchParams.set('reason', 'disabled');
    login.searchParams.set('detail', mapAccessError('disabled').message);
    return redirectWithCookies(login, supabaseResponse);
  }

  const role = normalizeRole(profile.role);
  const userPlan = normalizePlan(profile.plan);

  if (subscriptionBlocksPaidAccess(userPlan, profile.subscription_status)) {
    const billing = new URL('/settings/billing', request.url);
    billing.searchParams.set('reason', 'subscription');
    billing.searchParams.set('status', profile.subscription_status || 'unknown');
    if (pathname !== '/settings/billing' && !pathname.startsWith('/settings/account')) {
      return redirectWithCookies(billing, supabaseResponse);
    }
  }

  for (const rule of ROLE_BLOCKED_PREFIXES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      if (!hasPermission(role, rule.permission)) {
        const dashboard = new URL('/dashboard', request.url);
        dashboard.searchParams.set('reason', 'role');
        dashboard.searchParams.set('detail', `Role "${role}" cannot access ${pathname}.`);
        return redirectWithCookies(dashboard, supabaseResponse);
      }
    }
  }

  if (isClientRole(role)) {
    const allowedClient =
      pathname.startsWith('/portal/client') ||
      pathname.startsWith('/settings/account') ||
      pathname.startsWith('/settings/security');
    if (!allowedClient) {
      return redirectWithCookies(new URL('/portal/client', request.url), supabaseResponse);
    }
  }

  if (!canSeeOrgWideData(role) && (pathname.startsWith('/customers') || pathname.startsWith('/workers'))) {
    const dashboard = new URL('/dashboard', request.url);
    dashboard.searchParams.set('reason', 'role');
    dashboard.searchParams.set('detail', 'Your role only includes assigned work — not full customer or worker lists.');
    return redirectWithCookies(dashboard, supabaseResponse);
  }

  const requiredPlan = minimumPlanForPath(pathname);
  if (requiredPlan) {
    const { plan } = await resolveOrganizationPlan(supabase, user.id);
    const effectivePlan = normalizePlan(plan || profile.plan);

    if (!meetsMinimumPlan(effectivePlan, requiredPlan)) {
      const billing = new URL('/settings/billing', request.url);
      billing.searchParams.set('upgrade', requiredPlan);
      billing.searchParams.set('reason', 'plan');
      billing.searchParams.set('detail', `${requiredPlan} plan required for ${pathname}.`);
      return redirectWithCookies(billing, supabaseResponse);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/jobs/:path*',
    '/workers/:path*',
    '/settings/:path*',
    '/demo/:path*',
    '/customers/:path*',
    '/schedule/:path*',
    '/onboarding/:path*',
    '/team/:path*',
    '/activity/:path*',
    '/notifications/:path*',
    '/billing/:path*',
    '/workflows/:path*',
    '/portal/:path*',
    '/admin/:path*',
    '/login',
    '/signup'
  ]
};
