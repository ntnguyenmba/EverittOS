'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { isNativePlatform } from '@/lib/platform/detect';
import { clearNativePin, nativePinIsEnabled, setNativePin } from '@/lib/native-pin';

const copy = {
  en: { title: 'App PIN', body: 'Use a 4-digit PIN to reopen the app without signing in again.', newPin: '4-digit PIN', confirm: 'Confirm PIN', set: 'Set PIN', change: 'Change PIN', remove: 'Turn off PIN', saved: 'PIN saved.', removed: 'PIN turned off.', mismatch: 'PINs do not match.', invalid: 'Enter exactly 4 digits.' },
  es: { title: 'PIN de la app', body: 'Use un PIN de 4 dígitos para volver a abrir la app sin iniciar sesión de nuevo.', newPin: 'PIN de 4 dígitos', confirm: 'Confirmar PIN', set: 'Configurar PIN', change: 'Cambiar PIN', remove: 'Desactivar PIN', saved: 'PIN guardado.', removed: 'PIN desactivado.', mismatch: 'Los PIN no coinciden.', invalid: 'Ingrese exactamente 4 dígitos.' },
  vi: { title: 'Mã PIN ứng dụng', body: 'Dùng mã PIN 4 số để mở lại ứng dụng mà không cần đăng nhập lại.', newPin: 'Mã PIN 4 số', confirm: 'Xác nhận PIN', set: 'Đặt PIN', change: 'Đổi PIN', remove: 'Tắt PIN', saved: 'Đã lưu PIN.', removed: 'Đã tắt PIN.', mismatch: 'Hai mã PIN không khớp.', invalid: 'Nhập đúng 4 chữ số.' }
} as const;

export function NativePinSettings() {
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;
  const [native, setNative] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { const value = isNativePlatform(); setNative(value); if (value) setEnabled(nativePinIsEnabled()); }, []);
  if (!native) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (!/^\d{4}$/.test(pin)) { setError(c.invalid); return; }
    if (pin !== confirmPin) { setError(c.mismatch); return; }
    await setNativePin(pin); setEnabled(true); setPinValue(''); setConfirmPin(''); setMessage(c.saved);
  }

  function remove() { clearNativePin(); setEnabled(false); setPinValue(''); setConfirmPin(''); setError(''); setMessage(c.removed); }

  return <div className="settings-card">
    <h3>{c.title}</h3><p className="muted">{c.body}</p>
    <form className="form" onSubmit={save}>
      <div className="auth-field"><label htmlFor="native-pin">{c.newPin}</label><input id="native-pin" className="input" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0,4))} /></div>
      <div className="auth-field"><label htmlFor="native-pin-confirm">{c.confirm}</label><input id="native-pin-confirm" className="input" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0,4))} /></div>
      {error ? <p role="alert">{error}</p> : null}{message ? <p>{message}</p> : null}
      <div className="settings-actions"><button className="btn btn-primary" type="submit">{enabled ? c.change : c.set}</button>{enabled ? <button className="btn" type="button" onClick={remove}>{c.remove}</button> : null}</div>
    </form>
  </div>;
}
