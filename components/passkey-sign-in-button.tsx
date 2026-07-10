'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserSupportsPasskeys, passkeyApiEnabled, signInWithPasskey } from '@/lib/passkey-auth';
import { safeNextPath } from '@/lib/app-url';
import { useTranslation } from '@/components/locale-provider';

type PasskeySignInButtonProps = {
  next?: string;
  disabled?: boolean;
};

const passkeyCopy = {
  en: {
    loading: 'Signing in…',
    button: 'Sign in with passkey',
    retry: 'Try passkey again',
    canceled: 'Passkey sign-in was canceled. Continue with your password above or try again.',
    password: 'Continue with password',
    error: 'Unable to sign in with passkey.'
  },
  es: {
    loading: 'Iniciando sesión…',
    button: 'Iniciar sesión con passkey',
    retry: 'Intentar passkey de nuevo',
    canceled: 'Se canceló el inicio con passkey. Continúe con su contraseña arriba o inténtelo de nuevo.',
    password: 'Continuar con contraseña',
    error: 'No se pudo iniciar sesión con passkey.'
  },
  vi: {
    loading: 'Đang đăng nhập…',
    button: 'Đăng nhập bằng passkey',
    retry: 'Thử lại passkey',
    canceled: 'Đăng nhập bằng passkey đã bị hủy. Tiếp tục bằng mật khẩu ở trên hoặc thử lại.',
    password: 'Tiếp tục bằng mật khẩu',
    error: 'Không thể đăng nhập bằng passkey.'
  }
};

export function PasskeySignInButton({ next = '/dashboard', disabled = false }: PasskeySignInButtonProps) {
  const router = useRouter();
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const [error, setError] = useState('');
  const { locale } = useTranslation();
  const copy = passkeyCopy[locale] || passkeyCopy.en;

  useEffect(() => {
    setAvailable(browserSupportsPasskeys() && passkeyApiEnabled());
  }, []);

  if (!available) return null;

  function focusPassword() {
    const password = document.getElementById('password');
    if (password instanceof HTMLElement) {
      password.focus();
      password.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  async function handlePasskeySignIn() {
    setLoading(true);
    setCanceled(false);
    setError('');

    try {
      const result = await signInWithPasskey();

      if (result.canceled) {
        setCanceled(true);
        return;
      }

      if (!result.ok) {
        setError(result.error || copy.error);
        return;
      }

      router.push(safeNextPath(next, '/dashboard'));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="passkey-sign-in">
      <button
        type="button"
        className="btn btn-block"
        disabled={disabled || loading}
        onClick={() => void handlePasskeySignIn()}
      >
        {loading ? copy.loading : canceled ? copy.retry : copy.button}
      </button>
      {canceled ? (
        <div className="auth-message" role="status">
          <p>{copy.canceled}</p>
          <button type="button" className="btn btn-link" onClick={focusPassword}>
            {copy.password}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="auth-message auth-message-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
