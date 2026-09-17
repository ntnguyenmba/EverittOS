import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { clearSessionMarkers, createSupabaseCookieAdapter } from '@/lib/auth-cookies';
import { isAccountActive, isAccountDeleted } from '@/lib/account-status';
import { mapAccessError } from '@/lib/auth-errors';
import { meetsMinimumPlan, minimumPlanForPath } from '@/lib/plan-access';
import { normalizePlan } from '@/lib/everittos-plans';
import { canAccessNavHref, canAccessSettingsPath } from '@/lib/nav-access';
import { ACTIVE_ORG_COOKIE } from '@/lib/org-context-cookie';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { isPlatformAdminEmail } from '@/lib/platform-admin';
import { hasPermission } from '@/lib/permissions';
import {
  CLIENT_PORTAL_HOME,
  CONTRACTOR_PORTAL_HOME,
  clientPortalJobsPath,
  isClientAllowedPath,
  isContractorAllowedPath,
  isPortalPersonalSettingsPath,
  isTeamInviteAcceptPath
} from '@/lib/portal-access';
import { defaultPathForRole } from '@/lib/role-routes';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { resolveOnboardingAccessState } from '@/lib/onboarding-access';
import { resolveWorkspaceDeletionState } from '@/lib/workspace-access';
import { resolveMiddlewareClientRepair } from '@/lib/middleware-client-repair';
import { subscriptionBlocksPaidAccess } from '@/lib/subscription-access';
import {
  fetchProfileByUserId,
  resolveProfilePlan,
  resolveProfileSubscriptionStatus
} from '@/lib/profile-query';
import { enforceIdleSession } from '@/lib/session-server';
import { enforceRateLimit } from '@/lib/rate-limit-middleware';
import { isDemoFeatureEnabled } from '@/lib/demo-guard';
import { isLegacyMarketingAppPath, MARKETING_SITE_URL } from '@/lib/marketing-site';
import { postAuthRedirectPath, shouldRedirectToOnboarding } from '@/lib/post-auth-redirect';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-config';
import {
  ROLE_BLOCKED_PREFIXES,
  isLoggedOutOnlyPath,
  isProtectedPath,
  isPublicApiPath,
  isSessionApiPath,
  matchedMainNavPath,
  pathMatchesPrefix
} from '@/lib/middleware-route-policy';

function redirectWithCookies(url: URL, source: NextResponse) {
  const redirect = NextResponse.redirect(url);
  source.cookies.getAll().forEach(({ name, value }) => { redirect.cookies.set(name, value); });
  return redirect;
}
function roleBlockedRedirect(request: NextRequest, source: NextResponse, role?: string | null, _pathname?: string, _detail?: string) {
  return redirectWithCookies(new URL(defaultPathForRole(role, '/dashboard'), request.url), source);
}

export async function middleware(request: NextRequest) {
  const rateLimited = enforceRateLimit(request); if (rateLimited) return rateLimited;
  const pathname = request.nextUrl.pathname;
  if (pathname === '/reset-password' && request.nextUrl.searchParams.has('code')) { const exchangeUrl = new URL('/api/auth/reset-session', request.url); request.nextUrl.searchParams.forEach((value, key) => exchangeUrl.searchParams.set(key, value)); return NextResponse.redirect(exchangeUrl); }
  if (isLegacyMarketingAppPath(pathname)) return NextResponse.redirect(MARKETING_SITE_URL);
  if (pathname === '/demo') return NextResponse.redirect(new URL(isDemoFeatureEnabled() ? '/signup?next=/onboarding' : '/login', request.url));
  if (pathname === '/api/demo/enter' && !isDemoFeatureEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Public API handlers own their auth lifecycle. In particular, do not refresh or
  // clear an old Supabase session in middleware while /api/auth/login is creating
  // a new one, because competing Set-Cookie headers can invalidate the first login.
  if (isPublicApiPath(pathname)) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), { cookies: createSupabaseCookieAdapter({
    getAll() { return request.cookies.getAll(); },
    setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) { cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value)); supabaseResponse = NextResponse.next({ request }); cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options)); }
  }) }) as any;
  const { data: { user } } = await supabase.auth.getUser();

  if (pathname === '/') { if (user) { const activeOrgId = request.cookies.get(ACTIVE_ORG_COOKIE)?.value || null; const [profileRead, activeOrg] = await Promise.all([fetchProfileByUserId(supabase, user.id), activeOrgId ? fetchOrganizationContextForUser(supabase, user.id, activeOrgId) : Promise.resolve(null)]); const activeRole = activeOrg?.role || profileRead.profile?.role; const onboarding = await resolveOnboardingAccessState(supabase, activeOrg?.organizationId || profileRead.profile?.organization_id); const destination = postAuthRedirectPath(activeRole, '/dashboard', onboarding.completed, onboarding.skipped); return redirectWithCookies(new URL(destination, request.url), supabaseResponse); } return supabaseResponse; }
  if (user && isLoggedOutOnlyPath(pathname)) { const activeOrgId = request.cookies.get(ACTIVE_ORG_COOKIE)?.value || null; const [profileRead, activeOrg] = await Promise.all([fetchProfileByUserId(supabase, user.id), activeOrgId ? fetchOrganizationContextForUser(supabase, user.id, activeOrgId) : Promise.resolve(null)]); const activeRole = activeOrg?.role || profileRead.profile?.role; const onboarding = await resolveOnboardingAccessState(supabase, activeOrg?.organizationId || profileRead.profile?.organization_id); const destination = postAuthRedirectPath(activeRole, '/dashboard', onboarding.completed, onboarding.skipped); return redirectWithCookies(new URL(destination, request.url), supabaseResponse); }

  if (isSessionApiPath(pathname)) {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const expired = await enforceIdleSession(request, supabase, supabaseResponse);
    if (expired) return expired;
    const profileRead = await fetchProfileByUserId(supabase, user.id);
    if (isAccountDeleted(profileRead.profile?.deleted_at)) { await supabase.auth.signOut(); return NextResponse.json({ error: 'Account has been deleted.' }, { status: 403 }); }
    if (!isAccountActive(profileRead.profile?.account_status)) { await supabase.auth.signOut(); return NextResponse.json({ error: 'Account is disabled.' }, { status: 403 }); }
    return supabaseResponse;
  }
  if (!isProtectedPath(pathname)) return supabaseResponse;
  if (!user) { const login = new URL('/login', request.url); login.searchParams.set('next', pathname); login.searchParams.set('reason', 'session'); login.searchParams.set('detail', mapAccessError('session').message); return redirectWithCookies(login, supabaseResponse); }
  const idleRedirect = await enforceIdleSession(request, supabase, supabaseResponse); if (idleRedirect) return idleRedirect;
  const activeOrgId = request.cookies.get(ACTIVE_ORG_COOKIE)?.value || null;
  const [profileRead, activeOrg] = await Promise.all([
    fetchProfileByUserId(supabase, user.id),
    activeOrgId ? fetchOrganizationContextForUser(supabase, user.id, activeOrgId) : Promise.resolve(null)
  ]);
  const profile = profileRead.profile;
  const contextOrgId = activeOrg?.organizationId || profile?.organization_id;
  const contextRole = activeOrg?.role || profile?.role;
  const onboarding = await resolveOnboardingAccessState(supabase, contextOrgId);
  if (shouldRedirectToOnboarding(contextRole, onboarding.completed, pathname) && pathname !== '/onboarding' && !pathname.startsWith('/onboarding/')) return redirectWithCookies(new URL('/onboarding', request.url), supabaseResponse);
  if ((pathname === '/onboarding' || pathname.startsWith('/onboarding/')) && onboarding.skipped && onboarding.completed) return redirectWithCookies(new URL(postAuthRedirectPath(contextRole, '/dashboard', true, true), request.url), supabaseResponse);
  if (isAccountDeleted(profile?.deleted_at)) { const withinRecovery = profile?.deletion_scheduled_at && new Date(profile.deletion_scheduled_at) > new Date(); const recoveryPath = isPortalPersonalSettingsPath(pathname) || pathname.startsWith('/portal/contractor/settings') || pathname.startsWith('/portal/client/settings') || pathname.startsWith('/api/account/restore') || pathname.startsWith('/api/account/profile'); if (!withinRecovery || !recoveryPath) { await supabase.auth.signOut(); const login = new URL('/login', request.url); login.searchParams.set('reason', 'deleted'); login.searchParams.set('detail', withinRecovery ? 'This account is scheduled for deletion. Sign in again to restore it from Account settings.' : 'This account has been deleted. Contact support if you need help.'); const deletedRedirect = redirectWithCookies(login, supabaseResponse); clearSessionMarkers(deletedRedirect); return deletedRedirect; } }
  if (!isAccountActive(profile?.account_status)) { await supabase.auth.signOut(); const login = new URL('/login', request.url); login.searchParams.set('reason', 'disabled'); login.searchParams.set('detail', mapAccessError('disabled').message); const disabledRedirect = redirectWithCookies(login, supabaseResponse); clearSessionMarkers(disabledRedirect); return disabledRedirect; }
  const workspace = await resolveWorkspaceDeletionState(supabase, user.id, contextOrgId);
  if (workspace.blocked && !pathname.startsWith('/login') && !pathname.startsWith('/api/auth')) { await supabase.auth.signOut(); const login = new URL('/login', request.url); login.searchParams.set('reason', 'workspace_deleted'); login.searchParams.set('detail', 'This workspace is scheduled for deletion and is no longer available.'); return redirectWithCookies(login, supabaseResponse); }
  let role = normalizeRole(contextRole || 'owner');
  const [resolvedUserPlan, subscriptionStatus] = await Promise.all([
    activeOrg
      ? resolveOrganizationPlan(supabase, user.id, activeOrg.organizationId).then(({ plan }) => normalizePlan(plan))
      : profile
        ? resolveProfilePlan(supabase, user.id, profile).then((plan) => normalizePlan(plan))
        : Promise.resolve('free' as const),
    profile ? resolveProfileSubscriptionStatus(supabase, user.id, profile) : Promise.resolve('free')
  ]);
  const userPlan = resolvedUserPlan;
  if (isTeamInviteAcceptPath(pathname)) return supabaseResponse;
  // A valid selected workspace is authoritative. Legacy client repair is only for accounts
  // that do not yet have an explicit active workspace selection.
  if (!activeOrg) {
    const repair = await resolveMiddlewareClientRepair(supabase, user.id, role, pathname); role = repair.role;
    if (repair.redirectToClientJobs) return redirectWithCookies(new URL(clientPortalJobsPath(), request.url), supabaseResponse);
  }
  if (isClientRole(role)) { if (!isClientAllowedPath(pathname)) return redirectWithCookies(new URL(CLIENT_PORTAL_HOME, request.url), supabaseResponse); return supabaseResponse; }
  if (isContractorRole(role)) { if (!isContractorAllowedPath(pathname)) return redirectWithCookies(new URL(CONTRACTOR_PORTAL_HOME, request.url), supabaseResponse); return supabaseResponse; }
  if (pathname.startsWith('/admin') && !isPlatformAdminEmail(user.email)) return roleBlockedRedirect(request, supabaseResponse, role, pathname, 'Platform admin access is limited to authorized Everitt Ventures operators.');
  if (subscriptionBlocksPaidAccess(userPlan, subscriptionStatus)) { const billing = new URL('/settings/billing', request.url); billing.searchParams.set('reason', 'subscription'); billing.searchParams.set('status', subscriptionStatus || 'unknown'); if (pathname !== '/settings/billing' && !pathname.startsWith('/settings/account')) return redirectWithCookies(billing, supabaseResponse); }
  for (const rule of ROLE_BLOCKED_PREFIXES) { if (pathMatchesPrefix(pathname, rule.prefix) && !hasPermission(role, rule.permission)) return roleBlockedRedirect(request, supabaseResponse, role, pathname, `Your role (${role}) cannot access ${pathname}. Contact your workspace owner or admin if you need access.`); }
  if (pathname.startsWith('/settings') && !canAccessSettingsPath(role, pathname, userPlan)) { const fallback = canAccessSettingsPath(role, '/settings/account', userPlan) ? '/settings/account' : defaultPathForRole(role, '/dashboard'); return redirectWithCookies(new URL(fallback, request.url), supabaseResponse); }
  const matchedNav = matchedMainNavPath(pathname); if (matchedNav && !canAccessNavHref(role, matchedNav, userPlan)) return roleBlockedRedirect(request, supabaseResponse, role, pathname, `Your role (${role}) cannot access ${matchedNav}.`);
  const requiredPlan = minimumPlanForPath(pathname); if (requiredPlan) { const { plan } = await resolveOrganizationPlan(supabase, user.id, activeOrg?.organizationId || null); const effectivePlan = normalizePlan(plan || userPlan); if (!meetsMinimumPlan(effectivePlan, requiredPlan)) { const billing = new URL('/settings/billing', request.url); billing.searchParams.set('upgrade', requiredPlan); billing.searchParams.set('reason', 'plan'); billing.searchParams.set('detail', `${requiredPlan} plan required for ${pathname}.`); return redirectWithCookies(billing, supabaseResponse); } }
  return supabaseResponse;
}

export const config = { matcher: ['/', '/product', '/pricing', '/industries', '/demo', '/api/:path*', '/dashboard', '/dashboard/:path*', '/jobs/:path*', '/workers/:path*', '/people/:path*', '/settings/:path*', '/customers/:path*', '/crm/:path*', '/projects/:path*', '/knowledge/:path*', '/automations/:path*', '/clients/:path*', '/proposals/:path*', '/schedule/:path*', '/onboarding/:path*', '/team/:path*', '/teams/:path*', '/activity/:path*', '/analytics/:path*', '/notifications/:path*', '/billing/:path*', '/workflows/:path*', '/portal/:path*', '/admin/:path*', '/forms/:path*', '/templates/:path*', '/reviews/:path*', '/leads/:path*', '/services/:path*', '/bookings/:path*', '/invoices/:path*', '/photos/:path*', '/reports/:path*', '/expenses/:path*', '/bookkeeping/:path*', '/inventory/:path*', '/routes/:path*', '/messages/:path*', '/estimates/:path*', '/pricing-helper', '/pricing-helper/:path*', '/my-work/:path*', '/contractor-pay/:path*', '/staffing/:path*', '/operations/:path*', '/assistant', '/assistant/:path*', '/book/:path*', '/f/:path*', '/login', '/signup'] };
