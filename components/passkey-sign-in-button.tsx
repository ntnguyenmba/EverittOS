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
    error: 'Unable to sign in with passkey.'
  },
  es: {
    loading: 'Iniciando sesión…',
    button: 'Iniciar sesión con passkey',
    error: 'No se pudo iniciar sesión con passkey.'
  },
  vi: {
    loading: 'Đang đăng nhập…',
    button: 'Đăng nhập bằng passkey',
    error: 'Không thể đăng nhập bằng passkey.'
  }
};

export function PasskeySignInButton({ next = '/dashboard', disabled = false }: PasskeySignInButtonProps) {
  const router = useRouter();
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { locale } = useTranslation();
  const copy = passkeyCopy[locale] || passkeyCopy.en;

  useEffect(() => {
    setAvailable(browserSupportsPasskeys() && passkeyApiEnabled());
  }, []);

  if (!available) return null;

  async function handlePasskeySignIn() {
    setLoading(true);
    setError('');
    const result = await signInWithPasskey();
    setLoading(false);
    if (!result.ok) {
      setError(result.error || copy.error);
      return;
    }
    router.push(safeNextPath(next, '/dashboard'));
    router.refresh();
  }

  return (
    <div className="passkey-sign-in">
      <button
        type="button"
        className="btn btn-block"
        disabled={disabled || loading}
        onClick={() => void handlePasskeySignIn()}
      >
        {loading ? copy.loading : copy.button}
      </button>
      {error ? (
        <p className="auth-message auth-message-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
