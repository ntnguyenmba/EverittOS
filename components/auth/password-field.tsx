'use client';

import { useId, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';

type PasswordFieldProps = {
  id?: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
};

const passwordToggleCopy = {
  en: { show: 'Show', hide: 'Hide', showLabel: 'Show password', hideLabel: 'Hide password' },
  es: { show: 'Mostrar', hide: 'Ocultar', showLabel: 'Mostrar contraseña', hideLabel: 'Ocultar contraseña' },
  vi: { show: 'Hiện', hide: 'Ẩn', showLabel: 'Hiện mật khẩu', hideLabel: 'Ẩn mật khẩu' }
};

export function PasswordField({
  id,
  label,
  placeholder,
  autoComplete = 'current-password',
  value,
  onChange,
  disabled = false,
  required = false
}: PasswordFieldProps) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const [visible, setVisible] = useState(false);
  const { locale } = useTranslation();
  const copy = passwordToggleCopy[locale] || passwordToggleCopy.en;

  return (
    <div className="auth-field">
      <label htmlFor={fieldId}>{label}</label>
      <div className="auth-password-row">
        <input
          id={fieldId}
          className="input"
          placeholder={placeholder}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
        />
        <button
          type="button"
          className="btn auth-password-toggle"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-pressed={visible}
          aria-label={visible ? copy.hideLabel : copy.showLabel}
        >
          {visible ? copy.hide : copy.show}
        </button>
      </div>
    </div>
  );
}
