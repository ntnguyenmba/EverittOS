'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { useAuthErrors } from '@/lib/i18n-client';
import { defaultPathForRole } from '@/lib/role-routes';
import { supabase } from '@/lib/supabase';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const { mapAuthError } = useAuthErrors();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<{ title?: string; message: string; details?: string } | null>(null);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function establishSession() {
      setCheckingSession(true);
      setError(null);

      const code = searchParams.get('code');

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          const mapped = mapAuthError(exchangeError.message, 'reset_link_expired');
          setError({ title: mapped.title, message: mapped.message, details: exchangeError.message });
          setCheckingSession(false);
          return;
        }
        setSessionReady(true);
        setCheckingSession(false);
        return;
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session) {
        setSessionReady(true);
        setCheckingSession(false);
        return;
      }

      const mapped = mapAuthError('reset_link_expired', 'reset_link_expired');
      setError({
        title: mapped.title,
        message: t('resetLinkOpenFromEmail'),
        details: mapped.details
      });
      setCheckingSession(false);
    }

    establishSession();
  }, [searchParams, mapAuthError, t]);

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();

    if (!sessionReady || loading) {
      if (!sessionReady) {
        const mapped = mapAuthError('reset_link_expired', 'reset_link_expired');
        setError({ title: mapped.title, message: mapped.message, details: mapped.details });
      }
      return;
    }

    if (password.length < 6) {
      setError({ title: t('passwordTooShortTitle'), message: t('passwordTooShort') });
      return;
    }

    if (password !== confirmPassword) {
      setError({ title: t('passwordsNoMatchTitle'), message: t('passwordsNoMatch') });
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess('');

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      const mapped = mapAuthError(updateError.message);
      setError({ title: mapped.title, message: mapped.message, details: updateError.message });
      return;
    }

    setSuccess(t('passwordUpdatedRedirect'));

    const {
      data: { user }
    } = await supabase.auth.getUser();
    let destination = '/dashboard';
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      destination = defaultPathForRole(profile?.role);
    }

    setTimeout(() => {
      window.location.href = destination;
    }, 900);
  }

  return (
    <AuthShell title={t('chooseNewPassword')}>
      {checkingSession ? <p className="muted">{t('verifyingResetLink')}</p> : null}

      <form className="auth-form card" onSubmit={updatePassword}>
        <div className="auth-field">
          <label htmlFor="password">{t('newPassword')}</label>
          <input
            id="password"
            className="input"
            placeholder={t('passwordMinPlaceholder')}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!sessionReady || loading}
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="confirm_password">{t('confirmPassword')}</label>
          <input
            id="confirm_password"
            className="input"
            placeholder={t('repeatPassword')}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={!sessionReady || loading}
            required
          />
        </div>

        <AuthMessages
          error={error?.message}
          errorTitle={error?.title}
          errorDetails={error?.details}
          success={success}
        />

        <button className="btn btn-primary" type="submit" disabled={!sessionReady || loading}>
          {loading ? t('updating') : t('updatePassword')}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/forgot-password">{t('requestNewResetLink')}</Link>
        <Link href="/login">{t('backToSignIn')}</Link>
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
