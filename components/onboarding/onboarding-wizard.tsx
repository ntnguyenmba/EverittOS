'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import {
  OnboardingActions,
  OnboardingCard,
  OnboardingExploreLink,
  OnboardingShell
} from '@/components/onboarding/onboarding-shell';
import { dashboardPathForRole, loginUrlWithDashboardNext } from '@/lib/dashboard-nav';
import { fetchOrganizationContext } from '@/lib/organization';
import { hasTeamManagement, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { logClientActivity } from '@/lib/activity';
import {
  INDUSTRY_OPTIONS,
  INVITE_ROLE_OPTIONS,
  ONBOARDING_STEP_COUNT,
  OPERATIONS_OPTIONS,
  TEAM_SIZE_OPTIONS,
  type IndustryOption,
  type InviteRoleOption,
  type OperationsOption,
  type TeamInviteRow,
  type TeamSizeOption
} from '@/lib/onboarding/constants';
import {
  trackOnboardingCompleted,
  trackOnboardingStarted,
  trackOnboardingStepCompleted,
  trackOnboardingStepSkipped
} from '@/lib/onboarding/analytics';
import { OnboardingSupportPromo } from '@/components/onboarding-support-promo';
import { ActionFeedbackBanner } from '@/components/action-feedback';
import { errorFeedback, type ActionFeedback } from '@/lib/action-messages';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/roles';

type CalendarStatus = {
  configured: boolean;
  connected: boolean;
};

function emptyInvite(): TeamInviteRow {
  return { email: '', role: 'worker' };
}

export function OnboardingWizard() {
  const router = useRouter();
  const { t } = useTranslation();

  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [orgId, setOrgId] = useState('');
  const [role, setRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [workspaceError, setWorkspaceError] = useState('');
  const startedTrackedRef = useRef(false);

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState<IndustryOption | ''>('');
  const [teamSize, setTeamSize] = useState<TeamSizeOption | ''>('');
  const [operationsFocus, setOperationsFocus] = useState<OperationsOption[]>([]);
  const [invites, setInvites] = useState<TeamInviteRow[]>([emptyInvite()]);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({ configured: false, connected: false });
  const [jobName, setJobName] = useState('');
  const [jobCustomer, setJobCustomer] = useState('');
  const [jobDate, setJobDate] = useState('');
  const [inviteLinks, setInviteLinks] = useState<string[]>([]);

  const stepLabel = useMemo(() => {
    if (step >= ONBOARDING_STEP_COUNT - 1) return undefined;
    return t('onboarding.progress', { current: step + 1, total: ONBOARDING_STEP_COUNT });
  }, [step, t]);

  const requireWorkspace = useCallback(() => {
    if (orgId) return true;
    setFeedback(errorFeedback('Workspace is still loading. Wait a moment and try again.'));
    return false;
  }, [orgId]);

  const persistSettings = useCallback(
    async (nextStep: number, options?: { completed?: boolean; skipped?: boolean }) => {
      if (!orgId) return;
      await supabase.from('organization_settings').upsert({
        organization_id: orgId,
        onboarding_step: nextStep,
        onboarding_completed: options?.completed ?? false,
        onboarding_skipped: options?.skipped ?? false,
        industry: industry || null,
        team_size: teamSize || null,
        operations_focus: operationsFocus
      });
    },
    [orgId, industry, teamSize, operationsFocus]
  );

  const dismissSetup = useCallback(
    async (action: 'skip_all' | 'cancel') => {
      if (!requireWorkspace()) return;
      setBusy(true);
      const res = await fetch('/api/onboarding/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, step })
      });
      setBusy(false);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setFeedback(errorFeedback(typeof json.error === 'string' ? json.error : 'Unable to leave setup right now.'));
        return;
      }
      router.push(dashboardPathForRole(role));
    },
    [requireWorkspace, role, router, step]
  );

  const skipAllSetup = useCallback(() => dismissSetup('skip_all'), [dismissSetup]);
  const cancelSetup = useCallback(() => dismissSetup('cancel'), [dismissSetup]);

  const advance = useCallback(
    async (nextStep: number, completed = false) => {
      setBusy(true);
      await persistSettings(nextStep, { completed, skipped: false });
      if (completed) {
        await trackOnboardingCompleted(orgId, { skipped: false });
        router.push(dashboardPathForRole(role));
        return;
      }
      setStep(nextStep);
      setFeedback(null);
      setBusy(false);
    },
    [orgId, persistSettings, role, router]
  );

  const completeStep = useCallback(
    async (nextStep: number) => {
      if (!requireWorkspace()) return;
      setBusy(true);
      await trackOnboardingStepCompleted(orgId, step);
      await advance(nextStep);
      setBusy(false);
    },
    [advance, orgId, requireWorkspace, step]
  );

  const skipStep = useCallback(
    async (nextStep: number) => {
      if (!requireWorkspace()) return;
      setBusy(true);
      await trackOnboardingStepSkipped(orgId, step);
      await advance(nextStep);
      setBusy(false);
    },
    [advance, orgId, requireWorkspace, step]
  );

  const goBack = useCallback((prevStep: number) => {
    setStep(prevStep);
    setFeedback(null);
  }, []);

  const actionLabels = useMemo(
    () => ({
      continue: t('common.continue'),
      skipThisStep: t('common.skipThisStep'),
      skipAll: t('common.skipAllSetup'),
      cancel: t('common.cancelSetup'),
      back: t('common.back')
    }),
    [t]
  );

  const exitActions = useMemo(
    () => ({
      skipThisStepLabel: actionLabels.skipThisStep,
      skipAllLabel: actionLabels.skipAll,
      cancelLabel: actionLabels.cancel,
      onSkipAll: () => void skipAllSetup(),
      onCancel: () => void cancelSetup()
    }),
    [actionLabels, cancelSetup, skipAllSetup]
  );

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push(loginUrlWithDashboardNext());
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));

      let org = await fetchOrganizationContext(user.id);
      if (!org) {
        await fetch('/api/auth/setup', { method: 'POST' });
        org = await fetchOrganizationContext(user.id);
      }

      if (!org) {
        setWorkspaceError('Could not load your workspace. Refresh the page or sign in again.');
      }

      if (org) {
        setOrgId(org.organizationId);
        setRole(org.role);

        const { data: settings } = await supabase
          .from('organization_settings')
          .select('onboarding_completed, onboarding_skipped, onboarding_step, industry, team_size, operations_focus')
          .eq('organization_id', org.organizationId)
          .maybeSingle();

        if (settings?.onboarding_completed || settings?.onboarding_skipped) {
          router.push(dashboardPathForRole(org.role));
          return;
        }

        setStep(Math.min(settings?.onboarding_step || 0, ONBOARDING_STEP_COUNT - 1));
        if (settings?.industry && INDUSTRY_OPTIONS.includes(settings.industry as IndustryOption)) {
          setIndustry(settings.industry as IndustryOption);
        }
        if (settings?.team_size && TEAM_SIZE_OPTIONS.includes(settings.team_size as TeamSizeOption)) {
          setTeamSize(settings.team_size as TeamSizeOption);
        }
        if (Array.isArray(settings?.operations_focus)) {
          setOperationsFocus(
            settings.operations_focus.filter((item: string): item is OperationsOption =>
              OPERATIONS_OPTIONS.includes(item as OperationsOption)
            )
          );
        }

        const { data: orgRow } = await supabase.from('organizations').select('name').eq('id', org.organizationId).single();
        setCompanyName(orgRow?.name || '');

        if (!startedTrackedRef.current) {
          await trackOnboardingStarted(org.organizationId);
          startedTrackedRef.current = true;
        }
      }

      try {
        const res = await fetch('/api/integrations/google-calendar/status');
        if (res.ok) {
          const json = (await res.json()) as CalendarStatus;
          setCalendarStatus(json);
        }
      } catch {
        /* optional */
      }

      setLoading(false);
    }

    void load();
  }, [router]);

  async function saveBusinessProfile() {
    if (!requireWorkspace() || !userId) return;
    const trimmed = companyName.trim();
    if (trimmed) {
      await supabase.from('organizations').update({ name: trimmed }).eq('id', orgId);
      await supabase.from('profiles').update({ business_name: trimmed }).eq('id', userId);
    }
    await completeStep(2);
  }

  function toggleOperation(key: OperationsOption) {
    setOperationsFocus((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  async function sendInvites() {
    if (!hasTeamManagement(plan)) {
      setFeedback(errorFeedback(t('onboarding.teamUpgradeRequired')));
      return;
    }

    const valid = invites.filter((row) => row.email.trim());
    if (valid.length === 0) {
      setFeedback(null);
      setInviteLinks([]);
      await completeStep(4);
      return;
    }

    const links: string[] = [];
    let needsCopy = false;

    for (const row of valid) {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: row.email.trim(),
          role: row.role === 'admin' ? 'admin' : row.role === 'manager' ? 'manager' : 'employee'
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback(errorFeedback(json.error || t('onboarding.inviteFailed')));
        return;
      }
      if (json.acceptUrl) links.push(json.acceptUrl);
      if (!json.emailSent) needsCopy = true;
    }

    setInviteLinks(links);
    if (needsCopy) {
      setFeedback({ kind: 'info', message: t('onboarding.inviteLinkReady') });
      return;
    }

    setFeedback(null);
    await completeStep(4);
  }

  async function createJobRecord(title: string, customer: string | null, date: string | null) {
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        user_id: userId,
        organization_id: orgId,
        title,
        customer_name: customer,
        status: 'new',
        start_date: date,
        due_date: date
      })
      .select('id')
      .single();

    if (error) throw error;
    if (orgId) {
      await logClientActivity(orgId, 'job', data.id, 'job_created', `Job ${title} created`);
      void fetch('/api/integrations/google-calendar/sync-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: data.id })
      });
    }
  }

  async function saveFirstJob() {
    const title = jobName.trim();
    if (!title) {
      await completeStep(6);
      return;
    }
    try {
      await createJobRecord(title, jobCustomer.trim() || null, jobDate || null);
      await completeStep(6);
    } catch (err) {
      setFeedback(errorFeedback(err instanceof Error ? err.message : 'Unable to create job.'));
    }
  }

  if (loading) {
    return (
      <OnboardingShell role={role}>
        <OnboardingCard>
          <p className="loading-state" role="status">
            {t('onboarding.loading')}
          </p>
        </OnboardingCard>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell role={role}>
      {workspaceError ? (
        <p className="auth-message auth-message-error" role="alert">
          {workspaceError}
        </p>
      ) : null}
      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />
      <div className="onboarding-progress" aria-hidden={step >= ONBOARDING_STEP_COUNT - 1}>
        <div
          className="onboarding-progress-bar"
          style={{ width: `${Math.round((step / (ONBOARDING_STEP_COUNT - 1)) * 100)}%` }}
        />
      </div>

      {step === 0 && (
        <OnboardingCard stepLabel={stepLabel}>
          <h1 className="onboarding-title">{t('onboarding.steps.welcome.title')}</h1>
          <p className="onboarding-subtitle">{t('onboarding.steps.welcome.subtitle')}</p>
          <OnboardingSupportPromo variant="welcome" className="onboarding-support-inline" />
          <OnboardingActions
            continueLabel={actionLabels.continue}
            skipThisStepLabel={exitActions.skipThisStepLabel}
            skipAllLabel={exitActions.skipAllLabel}
            cancelLabel={exitActions.cancelLabel}
            onContinue={() => void completeStep(1)}
            onSkipThisStep={() => void skipStep(1)}
            onSkipAll={exitActions.onSkipAll}
            onCancel={exitActions.onCancel}
            busy={busy}
          />
        </OnboardingCard>
      )}

      {step === 1 && (
        <OnboardingCard stepLabel={stepLabel}>
          <h2 className="onboarding-title">{t('onboarding.steps.business.title')}</h2>
          <p className="onboarding-subtitle">{t('onboarding.steps.business.subtitle')}</p>
          <div className="onboarding-form">
            <label className="onboarding-field">
              <span>{t('onboarding.steps.business.companyName')}</span>
              <input
                className="input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="organization"
              />
            </label>
            <label className="onboarding-field">
              <span>{t('onboarding.steps.business.industry')}</span>
              <select className="input" value={industry} onChange={(e) => setIndustry(e.target.value as IndustryOption | '')}>
                <option value="">{t('common.optional')}</option>
                {INDUSTRY_OPTIONS.map((key) => (
                  <option key={key} value={key}>
                    {t(`onboarding.industries.${key}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="onboarding-field">
              <span>{t('onboarding.steps.business.teamSize')}</span>
              <select className="input" value={teamSize} onChange={(e) => setTeamSize(e.target.value as TeamSizeOption | '')}>
                <option value="">{t('common.optional')}</option>
                {TEAM_SIZE_OPTIONS.map((key) => (
                  <option key={key} value={key}>
                    {t(`onboarding.teamSizes.${key}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <OnboardingActions
            continueLabel={actionLabels.continue}
            skipThisStepLabel={exitActions.skipThisStepLabel}
            skipAllLabel={exitActions.skipAllLabel}
            cancelLabel={exitActions.cancelLabel}
            backLabel={actionLabels.back}
            onBack={() => goBack(0)}
            onContinue={() => void saveBusinessProfile()}
            onSkipThisStep={() => void skipStep(2)}
            onSkipAll={exitActions.onSkipAll}
            onCancel={exitActions.onCancel}
            busy={busy}
          />
        </OnboardingCard>
      )}

      {step === 2 && (
        <OnboardingCard stepLabel={stepLabel}>
          <h2 className="onboarding-title">{t('onboarding.steps.operations.title')}</h2>
          <p className="onboarding-subtitle">{t('onboarding.steps.operations.subtitle')}</p>
          <div className="onboarding-chip-grid" role="group" aria-label={t('onboarding.steps.operations.title')}>
            {OPERATIONS_OPTIONS.map((key) => {
              const selected = operationsFocus.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  className={selected ? 'onboarding-chip active' : 'onboarding-chip'}
                  aria-pressed={selected}
                  onClick={() => toggleOperation(key)}
                >
                  {t(`onboarding.operations.${key}`)}
                </button>
              );
            })}
          </div>
          <OnboardingActions
            continueLabel={actionLabels.continue}
            skipThisStepLabel={exitActions.skipThisStepLabel}
            skipAllLabel={exitActions.skipAllLabel}
            cancelLabel={exitActions.cancelLabel}
            backLabel={actionLabels.back}
            onBack={() => goBack(1)}
            onContinue={() => void completeStep(3)}
            onSkipThisStep={() => void skipStep(3)}
            onSkipAll={exitActions.onSkipAll}
            onCancel={exitActions.onCancel}
            busy={busy}
          />
        </OnboardingCard>
      )}

      {step === 3 && (
        <OnboardingCard stepLabel={stepLabel}>
          <h2 className="onboarding-title">{t('onboarding.steps.team.title')}</h2>
          <p className="onboarding-subtitle">{t('onboarding.steps.team.subtitle')}</p>
          {!hasTeamManagement(plan) ? (
            <div className="settings-warning onboarding-upgrade-note">
              <p>{t('onboarding.teamUpgradeRequired')}</p>
              <Link className="btn btn-primary" href="/settings/billing">
                {t('ux.viewPlans')}
              </Link>
            </div>
          ) : null}
          <div className="onboarding-form">
            {invites.map((row, index) => (
              <div key={index} className="onboarding-invite-row">
                <label className="onboarding-field">
                  <span>{t('onboarding.steps.team.email')}</span>
                  <input
                    className="input"
                    type="email"
                    value={row.email}
                    onChange={(e) => {
                      const next = [...invites];
                      next[index] = { ...next[index], email: e.target.value };
                      setInvites(next);
                    }}
                    autoComplete="email"
                  />
                </label>
                <label className="onboarding-field">
                  <span>{t('onboarding.steps.team.role')}</span>
                  <select
                    className="input"
                    value={row.role}
                    onChange={(e) => {
                      const next = [...invites];
                      next[index] = { ...next[index], role: e.target.value as InviteRoleOption };
                      setInvites(next);
                    }}
                  >
                    {INVITE_ROLE_OPTIONS.map((key) => (
                      <option key={key} value={key}>
                        {t(`onboarding.roles.${key}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
            <button
              type="button"
              className="btn onboarding-add-row"
              onClick={() => setInvites((rows) => [...rows, emptyInvite()])}
              disabled={!hasTeamManagement(plan)}
            >
              {t('common.addAnother')}
            </button>
          </div>
          {inviteLinks.length > 0 ? (
            <div className="invite-link-row">
              {inviteLinks.map((url) => (
                <div key={url} className="onboarding-invite-link">
                  <code className="invite-link-code">{url}</code>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void navigator.clipboard.writeText(url)}
                  >
                    {t('onboarding.copyInviteLink')}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <OnboardingActions
            continueLabel={actionLabels.continue}
            skipThisStepLabel={exitActions.skipThisStepLabel}
            skipAllLabel={exitActions.skipAllLabel}
            cancelLabel={exitActions.cancelLabel}
            backLabel={actionLabels.back}
            onBack={() => goBack(2)}
            onContinue={() => void sendInvites()}
            onSkipThisStep={() => void skipStep(4)}
            onSkipAll={exitActions.onSkipAll}
            onCancel={exitActions.onCancel}
            busy={busy}
          />
        </OnboardingCard>
      )}

      {step === 4 && (
        <OnboardingCard stepLabel={stepLabel}>
          <h2 className="onboarding-title">{t('onboarding.steps.calendar.title')}</h2>
          <p className="onboarding-subtitle">{t('onboarding.steps.calendar.subtitle')}</p>
          <div className="onboarding-calendar-options">
            <p className="onboarding-option-label">{t('onboarding.steps.calendar.google')}</p>
            {!calendarStatus.configured ? (
              <>
                <p className="muted">{t('onboarding.calendarNotConfigured')}</p>
                <Link className="btn" href="/settings/integrations">
                  {t('onboarding.openIntegrations')}
                </Link>
              </>
            ) : calendarStatus.connected ? (
              <p className="muted">{t('onboarding.calendarConnected')}</p>
            ) : (
              <a className="btn btn-primary" href="/api/integrations/google-calendar/connect">
                {t('onboarding.connectGoogleCalendar')}
              </a>
            )}
          </div>
          <OnboardingActions
            continueLabel={
              calendarStatus.configured && !calendarStatus.connected ? t('common.connectLater') : actionLabels.continue
            }
            skipThisStepLabel={exitActions.skipThisStepLabel}
            skipAllLabel={exitActions.skipAllLabel}
            cancelLabel={exitActions.cancelLabel}
            backLabel={actionLabels.back}
            onBack={() => goBack(3)}
            onContinue={() => void completeStep(5)}
            onSkipThisStep={() => void skipStep(5)}
            onSkipAll={exitActions.onSkipAll}
            onCancel={exitActions.onCancel}
            busy={busy}
          />
        </OnboardingCard>
      )}

      {step === 5 && (
        <OnboardingCard stepLabel={stepLabel}>
          <h2 className="onboarding-title">{t('onboarding.steps.firstJob.title')}</h2>
          <p className="onboarding-subtitle">{t('onboarding.steps.firstJob.subtitle')}</p>
          <div className="onboarding-form">
            <label className="onboarding-field">
              <span>{t('onboarding.steps.firstJob.jobName')}</span>
              <input className="input" value={jobName} onChange={(e) => setJobName(e.target.value)} />
            </label>
            <label className="onboarding-field">
              <span>{t('onboarding.steps.firstJob.customer')}</span>
              <input className="input" value={jobCustomer} onChange={(e) => setJobCustomer(e.target.value)} />
            </label>
            <label className="onboarding-field">
              <span>{t('onboarding.steps.firstJob.date')}</span>
              <input className="input" type="date" value={jobDate} onChange={(e) => setJobDate(e.target.value)} />
            </label>
          </div>
          <OnboardingActions
            continueLabel={actionLabels.continue}
            skipThisStepLabel={exitActions.skipThisStepLabel}
            skipAllLabel={exitActions.skipAllLabel}
            cancelLabel={exitActions.cancelLabel}
            backLabel={actionLabels.back}
            onBack={() => goBack(4)}
            onContinue={() => void saveFirstJob()}
            onSkipThisStep={() => void skipStep(6)}
            onSkipAll={exitActions.onSkipAll}
            onCancel={exitActions.onCancel}
            busy={busy}
          />
        </OnboardingCard>
      )}

      {step === 6 && (
        <OnboardingCard>
          <h2 className="onboarding-title">{t('onboarding.steps.complete.title')}</h2>
          <p className="onboarding-subtitle">{t('onboarding.steps.complete.message')}</p>
          <OnboardingSupportPromo variant="welcome" className="onboarding-support-inline" />
          <OnboardingActions
            continueLabel={t('common.goToDashboard')}
            skipThisStepLabel={exitActions.skipThisStepLabel}
            skipAllLabel={exitActions.skipAllLabel}
            cancelLabel={exitActions.cancelLabel}
            onContinue={() => void advance(ONBOARDING_STEP_COUNT, true)}
            onSkipAll={exitActions.onSkipAll}
            onCancel={exitActions.onCancel}
            showSkipThisStep={false}
            busy={busy}
          />
          <div className="onboarding-complete-extra">
            <OnboardingExploreLink href="/jobs" />
          </div>
        </OnboardingCard>
      )}
    </OnboardingShell>
  );
}
