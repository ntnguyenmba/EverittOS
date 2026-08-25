'use client';

import { useEffect, useState } from 'react';
import { isNativePlatform } from '@/lib/platform/detect';
import { nativePinIsEnabled, verifyNativePin } from '@/lib/native-pin';

const copy = {
  en: { title: 'Welcome back', body: 'Enter your 4-digit PIN to open EverittOS.', placeholder: 'PIN', unlock: 'Open EverittOS', wrong: 'That PIN is not correct.', account: 'Use account sign-in' },
  es: { title: 'Bienvenido de nuevo', body: 'Ingrese su PIN de 4 dígitos para abrir EverittOS.', placeholder: 'PIN', unlock: 'Abrir EverittOS', wrong: 'Ese PIN no es correcto.', account: 'Usar inicio de sesión' },
  vi: { title: 'Chào mừng trở lại', body: 'Nhập mã PIN 4 số để mở EverittOS.', placeholder: 'PIN', unlock: 'Mở EverittOS', wrong: 'Mã PIN không đúng.', account: 'Đăng nhập bằng tài khoản' }
} as const;

export function NativePinLock() {
  const [native, setNative] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [locale, setLocale] = useState<'en' | 'es' | 'vi'>('en');

  useEffect(() => {
    const isNative = isNativePlatform();
    setNative(isNative);
    if (!isNative) return;
    const htmlLocale = document.documentElement.lang;
    setLocale(htmlLocale.startsWith('es') ? 'es' : htmlLocale.startsWith('vi') ? 'vi' : 'en');
    setLocked(nativePinIsEnabled());
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
      <button className="native-pin-account" type="button" onClick={() => { window.location.assign('/login?force=1'); }}>{c.account}</button>
    </form>
  </div>;
}
