'use client';

import { useEffect, useState } from 'react';
import { isNativePlatform } from '@/lib/platform/detect';
import { nativePinIsEnabled, verifyNativePin } from '@/lib/native-pin';
import { authApiFetch } from '@/lib/auth-fetch';

const copy = {
  en: { title: 'Welcome back', body: 'Enter your 4-digit PIN to open EverittOS.', placeholder: 'PIN', unlock: 'Open EverittOS', wrong: 'That PIN is not correct.', account: 'Use account sign-in' },
  es: { title: 'Bienvenido de nuevo', body: 'Ingrese su PIN de 4 dígitos para abrir EverittOS.', placeholder: 'PIN', unlock: 'Abrir EverittOS', wrong: 'Ese PIN no es correcto.', account: 'Usar inicio de sesión' },
  vi: { title: 'Chào mừng trở lại', body: 'Nhập mã PIN 4 số để mở EverittOS.', placeholder: 'PIN', unlock: 'Mở EverittOS', wrong: 'Mã PIN không đúng.', account: 'Đăng nhập bằng tài khoản' }
} as const;

type PinLocale = keyof typeof copy;

function currentLocale(): PinLocale {
  if (typeof document === 'undefined') return 'en';
  const value = `${document.documentElement.lang || ''} ${document.documentElement.dataset.locale || ''} ${document.body?.dataset.locale || ''}`.toLowerCase();
  if (value.includes('es')) return 'es';
  if (value.includes('vi')) return 'vi';
  return 'en';
}

function forceAccountSignIn(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/login' && new URLSearchParams(window.location.search).get('force') === '1';
}

export function NativePinLock() {
  const [native, setNative] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [locale, setLocale] = useState<PinLocale>('en');

  useEffect(() => {
    const isNative = isNativePlatform();
    setNative(isNative);
    if (!isNative) return;
    setLocale(currentLocale());

    let cancelled = false;
    let wasBackgrounded = false;

    async function checkLock() {
      if (forceAccountSignIn() || !nativePinIsEnabled()) {
        if (!cancelled) setLocked(false);
        return;
      }

      try {
        const { response } = await authApiFetch('/api/auth/session', { method: 'GET' });
        const json = await response.json().catch(() => null) as { authenticated?: boolean } | null;
        if (!cancelled) setLocked(Boolean(response.ok && json?.authenticated));
      } catch {
        // Never let a stale PIN record block account sign-in when the server session is unavailable.
        if (!cancelled) setLocked(false);
      }
    }

    function relockAfterResume() {
      if (!wasBackgrounded || forceAccountSignIn()) return;
      wasBackgrounded = false;
      setPin('');
      setError('');
      void checkLock();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        wasBackgrounded = true;
        return;
      }
      if (document.visibilityState === 'visible') relockAfterResume();
    }

    function handlePageHide() {
      wasBackgrounded = true;
    }

    void checkLock();

    const syncLocale = () => setLocale(currentLocale());
    window.addEventListener('everittos:locale-changed', syncLocale);
    window.addEventListener('storage', syncLocale);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', relockAfterResume);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const observer = new MutationObserver(syncLocale);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'data-locale'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-locale'] });
    return () => {
      cancelled = true;
      window.removeEventListener('everittos:locale-changed', syncLocale);
      window.removeEventListener('storage', syncLocale);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', relockAfterResume);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
    };
  }, []);

  if (!native || !locked) return null;
  const c = copy[locale];

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    const ok = await verifyNativePin(pin);
    if (!ok) {
      setError(c.wrong);
      setPin('');
      return;
    }
    setError('');
    setLocked(false);
  }

  return <div className="native-pin-lock" role="dialog" aria-modal="true" aria-labelledby="native-pin-title">
    <form className="native-pin-card" onSubmit={unlock}>
      <div className="native-pin-mark">E</div>
      <h1 id="native-pin-title">{c.title}</h1>
      <p>{c.body}</p>
      <input aria-label={c.placeholder} inputMode="numeric" autoComplete="off" type="password" maxLength={4} pattern="[0-9]*" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} autoFocus />
      {error ? <p className="native-pin-error" role="alert">{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={pin.length !== 4}>{c.unlock}</button>
      <button className="native-pin-account" type="button" onClick={() => { setLocked(false); window.location.assign('/login?force=1'); }}>{c.account}</button>
    </form>
  </div>;
}
