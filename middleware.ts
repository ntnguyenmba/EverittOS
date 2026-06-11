import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { clearSessionMarkers, createSupabaseCookieAdapter } from '@/lib/auth-cookies';
import { isAccountActive } from '@/lib/account-status';
import { mapAccessError } from '@/lib/auth-errors';
import { meetsMinimumPlan, minimumPlanForPath } from '@/lib/plan-access';
import { normalizePlan } from '@/lib/everittos-plans';
import { canAccessNavHref, canAccessSettingsPath } from '@/lib/nav-access';
import { isPlatformAdminEmail } from '@/lib/platform-admin';
import { canSeeOrgWideData, hasPermission } from '@/lib/permissions';
import { isClientRole, normalizeRole } from '@/lib/roles';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { subscriptionBlocksPaidAccess } from '@/lib/subscription-access';
import {
  fetchProfileByUserId,
  resolveProfilePlan,
  resolveProfileSubscriptionStatus
} from '@/lib/profile-query';
import { enforceIdleSession } from '@/lib/session-server';
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

const ROLE_BLOCKED_PREFIXES: { prefix: string; permission: 'view_team' | 'manage_billing' | 'view_all_org_data' }[] = [
  { prefix: '/team', permission: 'view_team' },
  { prefix: '/settings/billing', permission: 'manage_billing' }
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

function roleBlockedRedirect(request: NextRequest, source: NextResponse, pathname: string, detail: string) {
  const dashboard = new URL('/dashboard', request.url);
  dashboard.searchParams.set('reason', 'role');
  dashboard.searchParams.set('detail', detail);
  return redirectWithCookies(dashboard, source);
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: createSupabaseCookieAdapter({
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
    })
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

  const idleRedirect = await enforceIdleSession(request, supabase, supabaseResponse);
  if (idleRedirect) {
    return idleRedirect;
  }

  const profileRead = await fetchProfileByUserId(supabase, user.id);
  const profile = profileRead.profile;

  if (!isAccountActive(profile?.account_status)) {
    await supabase.auth.signOut();
    const login = new URL('/login', request.url);
    login.searchParams.set('reason', 'disabled');
    login.searchParams.set('detail', mapAccessError('disabled').message);
    const disabledRedirect = redirectWithCookies(login, supabaseResponse);
    clearSessionMarkers(disabledRedirect);
    return disabledRedirect;
  }

  const organizationId = profile?.organization_id || null;
  let resolvedOrgId = organizationId;
  if (!resolvedOrgId) {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    resolvedOrgId = membership?.organization_id || null;
  }

  const role = normalizeRole(profile?.role || 'owner');
  const userPlan = profile
    ? normalizePlan(await resolveProfilePlan(supabase, user.id, profile))
    : 'free';
  const subscriptionStatus = profile
    ? await resolveProfileSubscriptionStatus(supabase, user.id, profile)
    : 'free';

  if (pathname.startsWith('/admin') && !isPlatformAdminEmail(user.email)) {
    return roleBlockedRedirect(
      request,
      supabaseResponse,
      pathname,
      'Platform admin access is limited to authorized Everitt Ventures operators.'
    );
  }

  if (subscriptionBlocksPaidAccess(userPlan, subscriptionStatus)) {
    const billing = new URL('/settings/billing', request.url);
    billing.searchParams.set('reason', 'subscription');
    billing.searchParams.set('status', subscriptionStatus || 'unknown');
    if (pathname !== '/settings/billing' && !pathname.startsWith('/settings/account')) {
      return redirectWithCookies(billing, supabaseResponse);
    }
  }

  for (const rule of ROLE_BLOCKED_PREFIXES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      if (!hasPermission(role, rule.permission)) {
        return roleBlockedRedirect(
          request,
          supabaseResponse,
          pathname,
          `Your role (${role}) cannot access ${pathname}. Contact your workspace owner or admin if you need access.`
        );
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
    return roleBlockedRedirect(
      request,
      supabaseResponse,
      pathname,
      'Your role only includes assigned work — not full customer or worker lists.'
    );
  }

  if (!canSeeOrgWideData(role) && (pathname.startsWith('/activity') || pathname.startsWith('/workflows'))) {
    return roleBlockedRedirect(
      request,
      supabaseResponse,
      pathname,
      'Your role cannot access organization-wide activity or workflow settings.'
    );
  }

  if (pathname.startsWith('/settings') && !canAccessSettingsPath(role, pathname, userPlan)) {
    const detail =
      pathname.startsWith('/settings/billing')
        ? 'Billing is limited to workspace owners and admins.'
        : pathname === '/settings' || pathname.startsWith('/settings?')
          ? 'Company settings are limited to workspace owners and admins.'
          : `Your role (${role}) cannot access ${pathname}.`;
    return roleBlockedRedirect(request, supabaseResponse, pathname, detail);
  }

  const mainNavPaths = [
    '/dashboard',
    '/jobs',
    '/customers',
    '/schedule',
    '/workers',
    '/team',
    '/activity',
    '/workflows',
    '/notifications'
  ];
  const matchedNav = mainNavPaths.find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (matchedNav && !canAccessNavHref(role, matchedNav, userPlan)) {
    return roleBlockedRedirect(
      request,
      supabaseResponse,
      pathname,
      `Your role (${role}) cannot access ${matchedNav}.`
    );
  }

  const requiredPlan = minimumPlanForPath(pathname);
  if (requiredPlan) {
    const { plan } = await resolveOrganizationPlan(supabase, user.id);
    const effectivePlan = normalizePlan(plan || userPlan);

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
