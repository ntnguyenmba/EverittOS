import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { clearSessionMarkers, createSupabaseCookieAdapter } from '@/lib/auth-cookies';
import { isAccountActive, isAccountDeleted } from '@/lib/account-status';
import { mapAccessError } from '@/lib/auth-errors';
import { meetsMinimumPlan, minimumPlanForPath } from '@/lib/plan-access';
import { normalizePlan } from '@/lib/everittos-plans';
import { canAccessNavHref, canAccessSettingsPath } from '@/lib/nav-access';
import { isPlatformAdminEmail } from '@/lib/platform-admin';
import { hasPermission } from '@/lib/permissions';
import { CLIENT_PORTAL_HOME, CONTRACTOR_PORTAL_HOME, clientPortalJobsPath, isClientAllowedPath, isContractorAllowedPath, isPortalPersonalSettingsPath, isTeamInviteAcceptPath } from '@/lib/portal-access';
import { defaultPathForRole } from '@/lib/role-routes';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { resolveOnboardingAccessState } from '@/lib/onboarding-access';
import { resolveWorkspaceDeletionState } from '@/lib/workspace-access';
import { resolveMiddlewareClientRepair } from '@/lib/middleware-client-repair';
import { subscriptionBlocksPaidAccess } from '@/lib/subscription-access';
import { fetchProfileByUserId, resolveProfilePlan, resolveProfileSubscriptionStatus } from '@/lib/profile-query';
import { enforceIdleSession } from '@/lib/session-server';
import { enforceRateLimit } from '@/lib/rate-limit-middleware';
import { isDemoFeatureEnabled } from '@/lib/demo-guard';
import { isLegacyMarketingAppPath, MARKETING_SITE_URL } from '@/lib/marketing-site';
import { postAuthRedirectPath, shouldRedirectToOnboarding } from '@/lib/post-auth-redirect';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-config';
import { ROLE_BLOCKED_PREFIXES, isLoggedOutOnlyPath, isProtectedPath, isSessionApiPath, matchedMainNavPath, pathMatchesPrefix } from '@/lib/middleware-route-policy';

function redirectWithCookies(url: URL, source: NextResponse) { const redirect=NextResponse.redirect(url); source.cookies.getAll().forEach(({name,value})=>redirect.cookies.set(name,value)); return redirect; }
function roleBlockedRedirect(request:NextRequest,source:NextResponse,role?:string|null,_pathname?:string,_detail?:string){return redirectWithCookies(new URL(defaultPathForRole(role,'/dashboard'),request.url),source);}

export async function middleware(request:NextRequest){
 const rateLimited=enforceRateLimit(request);if(rateLimited)return rateLimited;const pathname=request.nextUrl.pathname;
 if(pathname==='/reset-password'&&request.nextUrl.searchParams.has('code')){const exchangeUrl=new URL('/api/auth/reset-session',request.url);request.nextUrl.searchParams.forEach((value,key)=>exchangeUrl.searchParams.set(key,value));return NextResponse.redirect(exchangeUrl);}
 if(isLegacyMarketingAppPath(pathname))return NextResponse.redirect(MARKETING_SITE_URL);
 if(pathname==='/demo')return NextResponse.redirect(new URL(isDemoFeatureEnabled()?'/signup?next=/onboarding':'/login',request.url));
 if(pathname==='/api/demo/enter'&&!isDemoFeatureEnabled())return NextResponse.json({error:'Not found'},{status:404});
 let supabaseResponse=NextResponse.next({request});
 const supabase=createServerClient(getSupabaseUrl(),getSupabaseAnonKey(),{cookies:createSupabaseCookieAdapter({getAll(){return request.cookies.getAll();},setAll(cookiesToSet:{name:string;value:string;options?:Record<string,unknown>}[]){cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));supabaseResponse=NextResponse.next({request});cookiesToSet.forEach(({name,value,options})=>supabaseResponse.cookies.set(name,value,options));}})});
 const{data:{user}}=await supabase.auth.getUser();
 if(pathname==='/'){if(user){const profileRead=await fetchProfileByUserId(supabase,user.id);const onboarding=await resolveOnboardingAccessState(supabase,profileRead.profile?.organization_id);return redirectWithCookies(new URL(postAuthRedirectPath(profileRead.profile?.role,'/dashboard',onboarding.completed,onboarding.skipped),request.url),supabaseResponse);}return redirectWithCookies(new URL('/login',request.url),supabaseResponse);}
 if(user&&isLoggedOutOnlyPath(pathname)){const profileRead=await fetchProfileByUserId(supabase,user.id);const onboarding=await resolveOnboardingAccessState(supabase,profileRead.profile?.organization_id);return redirectWithCookies(new URL(postAuthRedirectPath(profileRead.profile?.role,'/dashboard',onboarding.completed,onboarding.skipped),request.url),supabaseResponse);}
 if(isSessionApiPath(pathname)){
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const expired=await enforceIdleSession(request,supabase,supabaseResponse);if(expired)return expired;
  const profileRead=await fetchProfileByUserId(supabase,user.id);if(isAccountDeleted(profileRead.profile?.deleted_at)){await supabase.auth.signOut();return NextResponse.json({error:'Account has been deleted.'},{status:403});}if(!isAccountActive(profileRead.profile?.account_status)){await supabase.auth.signOut();return NextResponse.json({error:'Account is disabled.'},{status:403});}return supabaseResponse;
 }
 if(!isProtectedPath(pathname))return supabaseResponse;
 if(!user){const login=new URL('/login',request.url);login.searchParams.set('next',pathname);login.searchParams.set('reason','session');login.searchParams.set('detail',mapAccessError('session').message);return redirectWithCookies(login,supabaseResponse);}
 const idleRedirect=await enforceIdleSession(request,supabase,supabaseResponse);if(idleRedirect)return idleRedirect;
 const profileRead=await fetchProfileByUserId(supabase,user.id);const profile=profileRead.profile;const onboarding=await resolveOnboardingAccessState(supabase,profile?.organization_id);
 if(shouldRedirectToOnboarding(profile?.role,onboarding.completed,pathname)&&pathname!=='/onboarding'&&!pathname.startsWith('/onboarding/'))return redirectWithCookies(new URL('/onboarding',request.url),supabaseResponse);
 if((pathname==='/onboarding'||pathname.startsWith('/onboarding/'))&&onboarding.skipped&&onboarding.completed)return redirectWithCookies(new URL(postAuthRedirectPath(profile?.role,'/dashboard',true,true),request.url),supabaseResponse);
 if(isAccountDeleted(profile?.deleted_at)){const withinRecovery=profile?.deletion_scheduled_at&&new Date(profile.deletion_scheduled_at)>new Date();const recoveryPath=isPortalPersonalSettingsPath(pathname)||pathname.startsWith('/portal/contractor/settings')||pathname.startsWith('/portal/client/settings')||pathname.startsWith('/api/account/restore')||pathname.startsWith('/api/account/profile');if(!withinRecovery||!recoveryPath){await supabase.auth.signOut();const login=new URL('/login',request.url);login.searchParams.set('reason','deleted');login.searchParams.set('detail',withinRecovery?'This account is scheduled for deletion. Sign in again to restore it from Account settings.':'This account has been deleted. Contact support if you need help.');const deletedRedirect=redirectWithCookies(login,supabaseResponse);clearSessionMarkers(deletedRedirect);return deletedRedirect;}}
 if(!isAccountActive(profile?.account_status)){await supabase.auth.signOut();const login=new URL('/login',request.url);login.searchParams.set('reason','disabled');login.searchParams.set('detail',mapAccessError('disabled').message);const disabledRedirect=redirectWithCookies(login,supabaseResponse);clearSessionMarkers(disabledRedirect);return disabledRedirect;}
 const workspace=await resolveWorkspaceDeletionState(supabase,user.id,profile?.organization_id);if(workspace.blocked&&!pathname.startsWith('/login')&&!pathname.startsWith('/api/auth')){await supabase.auth.signOut();const login=new URL('/login',request.url);login.searchParams.set('reason','workspace_deleted');login.searchParams.set('detail','This workspace is scheduled for deletion and is no longer available.');return redirectWithCookies(login,supabaseResponse);}
 let role=normalizeRole(profile?.role||'owner');const userPlan=profile?normalizePlan(await resolveProfilePlan(supabase,user.id,profile)):'free';const subscriptionStatus=profile?await resolveProfileSubscriptionStatus(supabase,user.id,profile):'free';
 if(isTeamInviteAcceptPath(pathname))return supabaseResponse;
 if(profile&&isClientRole(role)){const repaired=await resolveMiddlewareClientRepair(supabase,user.id,user.email,profile);if(repaired.role)role=normalizeRole(repaired.role);}
 if(isContractorRole(role)&&!isContractorAllowedPath(pathname))return roleBlockedRedirect(request,supabaseResponse,role,pathname,'Contractor portal only.');
 if(isClientRole(role)&&!isClientAllowedPath(pathname)){const destination=pathname.startsWith('/jobs/')?clientPortalJobsPath():CLIENT_PORTAL_HOME;return redirectWithCookies(new URL(destination,request.url),supabaseResponse);}
 for(const rule of ROLE_BLOCKED_PREFIXES){if(pathMatchesPrefix(pathname,rule.prefix)&&!hasPermission(role,rule.permission))return roleBlockedRedirect(request,supabaseResponse,role,pathname,'You do not have permission to open this page.');}
 if(pathname.startsWith('/settings')&&!canAccessSettingsPath(role,pathname))return roleBlockedRedirect(request,supabaseResponse,role,pathname,'You do not have permission to open this settings page.');
 const mainNavPath=matchedMainNavPath(pathname);if(mainNavPath&&!canAccessNavHref(role,mainNavPath))return roleBlockedRedirect(request,supabaseResponse,role,pathname,'You do not have permission to open this page.');
 const minimumPlan=minimumPlanForPath(pathname);if(minimumPlan&&!meetsMinimumPlan(userPlan,minimumPlan))return redirectWithCookies(new URL(`/settings/billing?upgrade=${minimumPlan}`,request.url),supabaseResponse);
 if(profile&&subscriptionBlocksPaidAccess(subscriptionStatus,userPlan)&&minimumPlan&&minimumPlan!=='free')return redirectWithCookies(new URL('/settings/billing?reason=subscription',request.url),supabaseResponse);
 if(pathname.startsWith('/admin')&&!isPlatformAdminEmail(user.email))return roleBlockedRedirect(request,supabaseResponse,role,pathname,'Admin access required.');
 return supabaseResponse;
}

export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|workbox-.*\\.js|icons/|images/|api/health).*)']};
