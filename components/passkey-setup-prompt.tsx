'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { browserSupportsPasskeys, passkeyApiEnabled, registerPasskey } from '@/lib/passkey-auth';
import { getPasskeyManagerCopy, getPasskeySetupCopy } from '@/lib/i18n/ui-chrome-copy';

type PasskeySetupPromptProps = {
  onDone: () => void;
};

export function PasskeySetupPrompt({ onDone }: PasskeySetupPromptProps) {
  const { locale } = useTranslation();
  const c = getPasskeySetupCopy(locale);
  const managerCopy = getPasskeyManagerCopy(locale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!browserSupportsPasskeys() || !passkeyApiEnabled()) {
    return null;
  }

  async function addNow() {
    setLoading(true);
    setError('');
    const result = await registerPasskey();
    setLoading(false);
    if (!result.ok) {
      setError(result.error || managerCopy.addError);
      return;
    }
    onDone();
  }

  return (
    <div className="card passkey-setup-prompt" role="region" aria-label={c.aria}>
      <h3>{c.title}</h3>
      <p className="muted">{c.body}</p>
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}
      <div className="settings-actions">
        <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void addNow()}>
          {loading ? managerCopy.working : c.enable}
        </button>
        <button type="button" className="btn" disabled={loading} onClick={onDone}>
          {c.notNow}
        </button>
      </div>
    </div>
  );
}
