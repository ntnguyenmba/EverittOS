import { logAuthEvent } from '@/lib/auth-logger';

export type AuthStep =
  | 'config_check'
  | 'connectivity'
  | 'sign_in'
  | 'session_verify'
  | 'profile_lookup'
  | 'membership_lookup'
  | 'workspace_bootstrap'
  | 'complete';

const SKIPPED_WORKSPACE_STEPS: AuthStep[] = [
  'config_check',
  'connectivity',
  'sign_in',
  'session_verify'
];

export function logAuthStep(route: string, step: AuthStep, meta?: Record<string, string | number | boolean | null | undefined>) {
  logAuthEvent('auth_step', { route, step, ...meta });
}

export function workspaceDiagnostics(input: {
  authStep: AuthStep;
  userId?: string | null;
  sessionVerified?: boolean;
  profile?: {
    role?: string | null;
    organization_id?: string | null;
    account_status?: string | null;
  } | null;
  hasMembership?: boolean;
  profileLookupRan?: boolean;
  membershipLookupRan?: boolean;
}) {
  const session = {
    verified: Boolean(input.sessionVerified),
    userId: input.userId || null
  };

  if (SKIPPED_WORKSPACE_STEPS.includes(input.authStep)) {
    return {
      authStep: input.authStep,
      session,
      profile: { skipped: true, reason: 'Workspace checks run only after authentication succeeds.' },
      organization: { skipped: true, reason: 'Workspace checks run only after authentication succeeds.' }
    };
  }

  return {
    authStep: input.authStep,
    session,
    profile: {
      skipped: false,
      lookupRan: Boolean(input.profileLookupRan),
      present: Boolean(input.profile),
      role: input.profile?.role ?? null,
      organizationId: input.profile?.organization_id ?? null,
      accountStatus: input.profile?.account_status ?? null
    },
    organization: {
      skipped: false,
      lookupRan: Boolean(input.membershipLookupRan),
      present: Boolean(input.profile?.organization_id || input.hasMembership),
      membershipActive: input.hasMembership ?? false
    }
  };
}
