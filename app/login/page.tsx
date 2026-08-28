'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { PasswordField } from '@/components/auth/password-field';
import { authApiFetch, LOGIN_API_PATH, SETUP_API_PATH } from '@/lib/auth-fetch';
import { logAuthDebug } from '@/lib/auth-debug';
import { mapAccessError, mapAuthError } from '@/lib/auth-errors';
import { parseFetchFailure, parseLoginApiResponse, type LoginClientError } from '@/lib/auth-request-error';
import { resolveClientApiUrl } from '@/lib/client-api-url';
import { planDisplayName, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { safeNextPath } from '@/lib/app-url';
import { storeTabSessionId } from '@/lib/session-client';
import { useTranslation } from '@/components/locale-provider';
import { normalizeEmail } from '@/lib/input-validation';
import { isBrowserSupabaseMisconfigured } from '@/lib/supabase-config';
import { PasskeySignInButton } from '@/components/passkey-sign-in-button';
import './login-page.css';

const LAST_ACTIVITY_STORAGE_KEY = 'everittos_last_activity_client';

const loginCopy = {
  en: {
    title: 'Sign in',
    email: 'Email',
    emailPlaceholder: 'you@company.com',
    password: 'Password',
    passwordPlaceholder: 'Your password',
    signingIn: 'Signing in...',
    signIn: 'Sign in',
    forgotPassword: 'Forgot password',
    createAccount: 'Create account',
    startFree: 'Start free',
    storyTitle: 'Built from real work.',
    storyBody: 'We use it every day.',
    storyClose: 'Now you can too.',
    aboutLabel: 'About EverittOS',
    selectedPlan: 'Selected plan:',
    continueSetup: 'Sign in to continue setup.',
    accountDeleted: 'Your account has been permanently deleted.',
    passwordUpdated: 'Password updated. Sign in with your new password.',
    emailVerified: 'Email verified. You can sign in now.',
    configTitle: 'Configuration required',
    configMessage: 'Authentication is not configured for this deployment. Set Supabase environment variables and redeploy.'
  },
  es: {
    title: 'Iniciar sesión',
    email: 'Correo electrónico',
    emailPlaceholder: 'usted@empresa.com',
    password: 'Contraseña',
    passwordPlaceholder: 'Su contraseña',
    signingIn: 'Iniciando sesión...',
    signIn: 'Iniciar sesión',
    forgotPassword: 'Olvidé mi contraseña',
    createAccount: 'Crear cuenta',
    startFree: 'Comenzar gratis',
    storyTitle: 'Creado a partir del trabajo real.',
    storyBody: 'Lo usamos todos los días.',
    storyClose: 'Ahora usted también puede usarlo.',
    aboutLabel: 'Acerca de EverittOS',
    selectedPlan: 'Plan seleccionado:',
    continueSetup: 'Inicie sesión para continuar la configuración.',
    accountDeleted: 'Su cuenta se eliminó permanentemente.',
    passwordUpdated: 'Contraseña actualizada. Inicie sesión con su nueva contraseña.',
    emailVerified: 'Correo verificado. Ya puede iniciar sesión.',
    configTitle: 'Configuración requerida',
    configMessage: 'La autenticación no está configurada para este despliegue. Configure las variables de Supabase y vuelva a desplegar.'
  },
  vi: {
    title: 'Đăng nhập',
    email: 'Email',
    emailPlaceholder: 'ban@congty.com',
    password: 'Mật khẩu',
    passwordPlaceholder: 'Mật khẩu của bạn',
    signingIn: 'Đang đăng nhập...',
    signIn: 'Đăng nhập',
    forgotPassword: 'Quên mật khẩu',
    createAccount: 'Tạo tài khoản',
    startFree: 'Bắt đầu miễn phí',
    storyTitle: 'Được xây dựng từ công việc thực tế.',
    storyBody: 'Chúng tôi dùng nó mỗi ngày.',
    storyClose: 'Giờ bạn cũng có thể dùng.',
    aboutLabel: 'Giới thiệu EverittOS',
    selectedPlan: 'Gói đã chọn:',
    continueSetup: 'Đăng nhập để tiếp tục thiết lập.',
    accountDeleted: 'Tài khoản của bạn đã bị xóa vĩnh viễn.',
    passwordUpdated: 'Mật khẩu đã được cập nhật. Đăng nhập bằng mật khẩu mới.',
    emailVerified: 'Email đã được xác minh. Bạn có thể đăng nhập ngay.',
    configTitle: 'Cần cấu hình',
    configMessage: 'Xác thực chưa được cấu hình cho bản triển khai này. Hãy thiết lập biến môi trường Supabase và triển khai lại.'
  }
};

function resetActivityClock() {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
  } catch {
    /* Storage can be unavailable in strict browser modes; login should still continue. */
  }
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const selectedPlan = normalizePlan(searchParams.get('plan'));
  const loginUrl = resolveClientApiUrl(LOGIN_API_PATH);

  const accessBlock = useMemo(() => {
    const reason = searchParams.get('reason');
    if (!reason) return null;
    const mapped = mapAccessError(reason);
    return { title: mapped.title, message: mapped.message };
  }, [searchParams]);

  const authErrorMapped = useMemo(() => {
    const message = searchParams.get('error');
    const code = searchParams.get('error_code');
    if (!message) return null;
    const mapped = mapAuthError(code || decodeURIComponent(message));
    return { title: mapped.title, message: mapped.message };
  }, [searchParams]);

  const verified = searchParams.get('verified');
  const passwordReset = searchParams.get('reset');
  const accountDeleted = searchParams.get('deleted') === '1';
  const configError = isBrowserSupabaseMisconfigured();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<LoginClientError | null>(null);
  const [loading, setLoading] = useState(false);

  const signupHref = `/signup?next=${encodeURIComponent(next)}${selectedPlan !== 'free' ? `&plan=${selectedPlan}` : ''}`;
  const { locale } = useTranslation();
  const copy = loginCopy[locale] || loginCopy.en;

  function showError(nextError: LoginClientError) {
    setError(nextError);
    logAuthDebug('login_client_error', {
      endpoint: nextError.debug.endpoint,
      status: nextError.debug.httpStatus || 0,
      code: nextError.debug.apiCode || 'client'
    });
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (configError) {
      const mapped = mapAuthError('config_error', 'config_error');
      showError({
        title: mapped.title,
        message: mapped.message,
        details: '',
        debug: {
          endpoint: LOGIN_API_PATH,
          requestedUrl: loginUrl,
          method: 'POST',
          apiCode: 'config_error'
        }
      });
      setLoading(false);
      return;
    }

    try {
      const { response, url, method } = await authApiFetch(LOGIN_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizeEmail(email), password, next })
      });

      const parsed = await parseLoginApiResponse(response, LOGIN_API_PATH, url, method);

      if (!parsed.ok) {
        const setupRequired = Boolean(parsed.json?.setupRequired);
        const retryable = Boolean(parsed.json?.retryable);

        if (setupRequired && retryable) {
          try {
            const setup = await authApiFetch(SETUP_API_PATH, { method: 'POST' });
            const setupParsed = await parseLoginApiResponse(setup.response, SETUP_API_PATH, setup.url, setup.method);
            if (setupParsed.ok) {
              const redirectTo = (setupParsed.json.redirectTo as string) || next;
              resetActivityClock();
              window.location.assign(redirectTo);
              return;
            }
          } catch {
            /* fall through to login error */
          }
        }

        showError(parsed.error);
        setLoading(false);
        return;
      }

      const json = parsed.json;
      const redirectTo = (json.redirectTo as string) || next;

      if (typeof json.tabSessionId === 'string' && json.tabSessionId) {
        storeTabSessionId(json.tabSessionId);
      }

      resetActivityClock();
      window.location.assign(redirectTo);
    } catch (err) {
      showError(parseFetchFailure(err, LOGIN_API_PATH, loginUrl, 'POST'));
      setLoading(false);
    }
  }

  const successMessage = accountDeleted
    ? copy.accountDeleted
    : passwordReset
      ? copy.passwordUpdated
      : verified
        ? copy.emailVerified
        : undefined;

  return (
    <AuthShell title={copy.title}>
      <section className="login-origin-story" aria-label={copy.aboutLabel}>
        <h2>{copy.storyTitle}</h2>
        <p>{copy.storyBody}</p>
        <p>{copy.storyClose}</p>
        <div className="login-origin-actions">
          <Link className="btn btn-primary" href="/signup?plan=free">
            {copy.startFree}
          </Link>
        </div>
      </section>

      {configError ? <AuthMessages errorTitle={copy.configTitle} error={copy.configMessage} /> : null}

      {accessBlock ? <AuthMessages errorTitle={accessBlock.title} error={accessBlock.message} /> : null}

      {selectedPlan !== 'free' ? (
        <p className="auth-plan-note">
          {copy.selectedPlan} <strong>{planDisplayName(selectedPlan as EverittosPlan)}</strong>. {copy.continueSetup}
        </p>
      ) : null}

      <form className="auth-form card" onSubmit={handleLogin}>
        <div className="auth-field">
          <label htmlFor="email">{copy.email}</label>
          <input
            id="email"
            className="input"
            placeholder={copy.emailPlaceholder}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />
        </div>

        <PasswordField
          id="password"
          label={copy.password}
          placeholder={copy.passwordPlaceholder}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          disabled={loading}
          required
        />

        <AuthMessages
          error={error?.message || authErrorMapped?.message}
          errorTitle={error?.title || authErrorMapped?.title}
          success={successMessage}
        />

        <button className="btn btn-primary" type="submit" disabled={loading || configError || !email || !password}>
          {loading ? copy.signingIn : copy.signIn}
        </button>
      </form>

      <PasskeySignInButton next={next} disabled={loading || Boolean(configError)} />

      <div className="auth-links">
        <Link href="/forgot-password">{copy.forgotPassword}</Link>
        <Link href={signupHref}>{copy.createAccount}</Link>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
