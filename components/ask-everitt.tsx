'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AiUpgradeModal } from '@/components/ai-upgrade-modal';
import { canAccessFeature } from '@/lib/plan-access';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

const SUGGESTIONS = [
  'Draft a follow-up email for a new lead',
  'Create a job onboarding checklist',
  'Summarize open jobs this week',
  'Outline a standard operating procedure',
  'Draft a client proposal outline'
];

type AskEverittProps = {
  plan?: EverittosPlan | string | null;
  embedded?: boolean;
};

export function AskEveritt({ plan: planProp, embedded = false }: AskEverittProps) {
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [plan, setPlan] = useState<EverittosPlan>(normalizePlan(planProp));
  const [prompt, setPrompt] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aiConfigured, setAiConfigured] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const aiAllowed = canAccessFeature(plan, 'aiAccess');

  useEffect(() => {
    if (planProp) setPlan(normalizePlan(planProp));
  }, [planProp]);

  useEffect(() => {
    async function loadPlan() {
      if (planProp) return;
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
    }
    void loadPlan();
  }, [planProp]);

  useEffect(() => {
    if (!open) return;
    void fetch('/api/ai/status')
      .then((r) => r.json())
      .then((j) => setAiConfigured(Boolean(j.configured)))
      .catch(() => setAiConfigured(false));
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  const openPalette = useCallback(() => {
    if (!aiAllowed) {
      setUpgradeOpen(true);
      return;
    }
    setOpen(true);
    setError('');
  }, [aiAllowed]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setUpgradeOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openPalette]);

  async function submitPrompt(text?: string) {
    const value = (text ?? prompt).trim();
    if (!value || busy) return;

    if (!aiAllowed) {
      setUpgradeOpen(true);
      return;
    }

    setBusy(true);
    setError('');
    setReply('');

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: value })
    });

    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      if (json.code === 'plan_required') {
        setUpgradeOpen(true);
        return;
      }
      setError(json.error || 'Unable to reach Everitt.');
      return;
    }

    setReply(json.reply || '');
    setPrompt('');
  }

  if (embedded) {
    return (
      <section className="card command-ask-everitt">
        <div className="command-ask-head">
          <h2>Ask Everitt</h2>
          <span className="muted command-kbd-hint">{typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl+K'}</span>
        </div>
        <p className="muted">Draft proposals, emails, SOPs, and tasks from one place.</p>
        <div className="command-ask-row">
          <input
            className="input"
            placeholder={aiAllowed ? 'Ask Everitt anything...' : 'Upgrade to Business for AI'}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submitPrompt()}
            onFocus={() => !aiAllowed && setUpgradeOpen(true)}
          />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void submitPrompt()}>
            {busy ? 'Thinking...' : 'Ask'}
          </button>
        </div>
        {error ? <p className="auth-message auth-message-error">{error}</p> : null}
        {reply ? <div className="command-ask-reply">{reply}</div> : null}
        <AiUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      </section>
    );
  }

  return (
    <>
      <button type="button" className="ask-everitt-fab" onClick={openPalette} aria-label="Ask Everitt">
        Ask Everitt
      </button>

      {open ? (
        <div className="ai-modal-overlay" role="presentation" onClick={() => setOpen(false)}>
          <div className="ai-palette" role="dialog" aria-label="Ask Everitt" onClick={(e) => e.stopPropagation()}>
            <div className="ai-palette-head">
              <strong>Ask Everitt</strong>
              <span className="muted">AI command center</span>
            </div>
            <input
              ref={inputRef}
              className="input ai-palette-input"
              placeholder={aiConfigured ? 'Create proposal, draft email, build checklist...' : 'AI not configured on server'}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submitPrompt()}
              disabled={!aiConfigured}
            />
            <div className="ai-palette-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="ai-suggestion-chip" onClick={() => void submitPrompt(s)}>
                  {s}
                </button>
              ))}
            </div>
            {busy ? <p className="muted">Everitt is thinking...</p> : null}
            {error ? <p className="auth-message auth-message-error">{error}</p> : null}
            {reply ? <div className="command-ask-reply">{reply}</div> : null}
          </div>
        </div>
      ) : null}

      <AiUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </>
  );
}
