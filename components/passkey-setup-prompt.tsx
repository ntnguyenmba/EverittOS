'use client';

import { useState } from 'react';
import { browserSupportsPasskeys, passkeyApiEnabled, registerPasskey } from '@/lib/passkey-auth';

type PasskeySetupPromptProps = {
  onDone: () => void;
};

export function PasskeySetupPrompt({ onDone }: PasskeySetupPromptProps) {
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
      setError(result.error || 'Unable to add passkey.');
      return;
    }
    onDone();
  }

  return (
    <div className="card passkey-setup-prompt" role="region" aria-label="Add a passkey">
      <h3>Add a passkey now?</h3>
      <p className="muted">
        Sign in faster next time with Face ID, Touch ID, Windows Hello, or a security key. You can skip and add one later
        in Security settings.
      </p>
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}
      <div className="settings-actions">
        <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void addNow()}>
          {loading ? 'Setting up…' : 'Add a passkey now'}
        </button>
        <button type="button" className="btn" disabled={loading} onClick={onDone}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
