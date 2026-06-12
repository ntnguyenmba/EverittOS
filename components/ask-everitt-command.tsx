'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AiUpgradeModal } from '@/components/ai-upgrade-modal';
import { ASK_EVERITT_SUGGESTIONS } from '@/lib/ai-features';
import type { ProposedAiAction } from '@/lib/ai-actions';
import type { SearchResultItem } from '@/lib/os-types';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

const SEARCH_TYPE_LABELS: Record<SearchResultItem['type'], string> = {
  customer: 'CRM',
  job: 'Job',
  task: 'Task',
  document: 'Document',
  template: 'Template',
  form: 'Form'
};

type AiStatus = {
  allowed: boolean;
  configured: boolean;
  locked: boolean;
  lockedMessage: string | null;
  usage?: { monthlyUsed: number; monthlyCap: number; unlimited: boolean; remaining: number | null };
};

type AskEverittCommandProps = {
  plan?: EverittosPlan | string | null;
  embedded?: boolean;
};

export function AskEverittCommand({ plan: planProp, embedded = false }: AskEverittCommandProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [plan, setPlan] = useState<EverittosPlan>(normalizePlan(planProp));
  const [query, setQuery] = useState('');
  const [reply, setReply] = useState('');
  const [pendingAction, setPendingAction] = useState<ProposedAiAction | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchDebounce = useRef<number | null>(null);

  const kbd =
    typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl+K';
  const aiLocked = aiStatus?.locked ?? !aiStatus?.allowed;
  const aiReady = Boolean(aiStatus?.allowed && aiStatus?.configured);

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

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/ai/status', { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    setAiStatus({
      allowed: Boolean(json.allowed),
      configured: Boolean(json.configured),
      locked: Boolean(json.locked),
      lockedMessage: json.lockedMessage || null,
      usage: json.usage
        ? {
            monthlyUsed: json.usage.monthlyUsed,
            monthlyCap: json.usage.monthlyCap,
            unlimited: json.usage.unlimited,
            remaining: json.usage.remaining
          }
        : undefined
    });
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!open) return;
    void loadStatus();
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, loadStatus]);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      setSearchResults(res.ok ? json.results || [] : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (searchDebounce.current) window.clearTimeout(searchDebounce.current);
    searchDebounce.current = window.setTimeout(() => void runSearch(query), 220);
    return () => {
      if (searchDebounce.current) window.clearTimeout(searchDebounce.current);
    };
  }, [query, open, runSearch]);

  const openCommand = useCallback(() => {
    setOpen(true);
    setNotice('');
    setReply('');
    setPendingAction(null);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCommand();
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setUpgradeOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openCommand]);

  async function submitAi(text?: string) {
    const value = (text ?? query).trim();
    if (!value || busy) return;

    if (aiLocked) {
      setUpgradeOpen(true);
      return;
    }
    if (!aiReady) {
      setNotice('AI is not available right now. Core EverittOS features are unaffected.');
      return;
    }

    setBusy(true);
    setNotice('');
    setReply('');
    setPendingAction(null);

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: value, feature: 'ask_everitt' })
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      if (json.locked || json.code === 'plan_required') {
        setUpgradeOpen(true);
        return;
      }
      if (json.code === 'rate_limited') {
        setNotice('Monthly AI limit reached. Upgrade to Enterprise for unlimited usage.');
        return;
      }
      setNotice(json.error || 'AI is temporarily unavailable.');
      return;
    }

    setReply(json.reply || '');
    if (json.action) setPendingAction(json.action);
    void loadStatus();
  }

  async function confirmAction() {
    if (!pendingAction || actionBusy) return;
    setActionBusy(true);
    const res = await fetch('/api/ai/actions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: pendingAction, confirmed: true })
    });
    const json = await res.json();
    setActionBusy(false);
    if (!res.ok) {
      if (json.locked) {
        setUpgradeOpen(true);
        return;
      }
      setNotice(json.error || 'Action could not be completed.');
      return;
    }
    setNotice(json.message || 'Action completed.');
    setPendingAction(null);
  }

  function navigate(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  if (embedded) {
    return (
      <section className="card command-ask-everitt">
        <div className="command-ask-head">
          <h2>Ask Everitt</h2>
          <button type="button" className="everitt-cmd-trigger everitt-cmd-trigger-inline" onClick={openCommand}>
            Open command bar <span className="muted">{kbd}</span>
          </button>
        </div>
        <p className="muted">Your business command center: jobs, leads, proposals, and actions in one place.</p>
        {aiLocked ? (
          <button type="button" className="btn" onClick={() => setUpgradeOpen(true)}>
            Unlock AI on Business plan
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={openCommand}>
            Ask Everitt…
          </button>
        )}
        <AiUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
        {open ? <CommandOverlay {...overlayProps()} /> : null}
      </section>
    );
  }

  function overlayProps() {
    return {
      open,
      onClose: () => setOpen(false),
      query,
      setQuery,
      inputRef,
      kbd,
      aiLocked,
      aiReady,
      aiStatus,
      busy,
      searching,
      searchResults,
      reply,
      notice,
      pendingAction,
      setPendingAction,
      submitAi,
      confirmAction,
      actionBusy,
      navigate,
      setUpgradeOpen
    };
  }

  return (
    <>
      <button type="button" className="everitt-cmd-trigger" onClick={openCommand} aria-label="Ask Everitt command bar">
        <span className="everitt-cmd-placeholder">Ask Everitt…</span>
        <span className="everitt-cmd-kbd">{kbd}</span>
      </button>
      {open ? <CommandOverlay {...overlayProps()} /> : null}
      <AiUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </>
  );
}

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  query: string;
  setQuery: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  kbd: string;
  aiLocked: boolean;
  aiReady: boolean;
  aiStatus: AiStatus | null;
  busy: boolean;
  searching: boolean;
  searchResults: SearchResultItem[];
  reply: string;
  notice: string;
  pendingAction: ProposedAiAction | null;
  setPendingAction: (a: ProposedAiAction | null) => void;
  submitAi: (text?: string) => Promise<void>;
  confirmAction: () => Promise<void>;
  actionBusy: boolean;
  navigate: (href: string) => void;
  setUpgradeOpen: (v: boolean) => void;
};

function CommandOverlay({
  onClose,
  query,
  setQuery,
  inputRef,
  kbd,
  aiLocked,
  aiReady,
  aiStatus,
  busy,
  searching,
  searchResults,
  reply,
  notice,
  pendingAction,
  setPendingAction,
  submitAi,
  confirmAction,
  actionBusy,
  navigate,
  setUpgradeOpen
}: OverlayProps) {
  return (
    <div className="everitt-cmd-overlay" role="presentation" onClick={onClose}>
      <div className="everitt-cmd-palette" role="dialog" aria-label="Ask Everitt" onClick={(e) => e.stopPropagation()}>
        <div className="everitt-cmd-bar">
          <input
            ref={inputRef}
            className="everitt-cmd-input"
            placeholder="Ask Everitt…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (aiLocked) setUpgradeOpen(true);
                else void submitAi();
              }
            }}
          />
          <span className="everitt-cmd-kbd everitt-cmd-kbd-muted">{kbd}</span>
        </div>

        {aiLocked ? (
          <div className="everitt-cmd-locked">
            <p>{aiStatus?.lockedMessage || 'Ask Everitt is available on Business and Enterprise plans.'}</p>
            <button type="button" className="btn btn-primary" onClick={() => setUpgradeOpen(true)}>
              Upgrade to unlock AI
            </button>
          </div>
        ) : null}

        {!aiLocked && !aiReady ? (
          <p className="muted everitt-cmd-hint">AI is not configured on this server. CRM, jobs, and billing still work normally.</p>
        ) : null}

        {!aiLocked && aiReady ? (
          <>
            <div className="everitt-cmd-suggestions">
              {ASK_EVERITT_SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="everitt-cmd-chip" onClick={() => void submitAi(s)}>
                  {s}
                </button>
              ))}
            </div>
            {aiStatus?.usage ? (
              <p className="muted everitt-cmd-usage">
                {aiStatus.usage.unlimited
                  ? 'Unlimited AI (Enterprise)'
                  : `${aiStatus.usage.monthlyUsed} / ${aiStatus.usage.monthlyCap} requests this month`}
              </p>
            ) : null}
            {busy ? <p className="everitt-cmd-hint">Everitt is thinking…</p> : null}
            {reply ? <div className="everitt-cmd-reply">{reply}</div> : null}
            {pendingAction ? (
              <div className="everitt-cmd-action">
                <p>
                  <strong>Confirm action:</strong> {pendingAction.label}
                </p>
                <div className="settings-actions">
                  <button type="button" className="btn btn-primary" disabled={actionBusy} onClick={() => void confirmAction()}>
                    {actionBusy ? 'Running…' : 'Confirm'}
                  </button>
                  <button type="button" className="btn" onClick={() => setPendingAction(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {notice ? <p className="everitt-cmd-notice">{notice}</p> : null}

        {query.length >= 2 ? (
          <div className="everitt-cmd-search">
            <p className="everitt-cmd-section-label">Workspace records</p>
            {searching ? <p className="muted everitt-cmd-hint">Searching…</p> : null}
            {!searching && searchResults.length === 0 ? (
              <p className="muted everitt-cmd-hint">No matching records</p>
            ) : null}
            <ul className="everitt-cmd-results">
              {searchResults.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <button type="button" className="everitt-cmd-result" onClick={() => navigate(item.href)}>
                    <span className="everitt-cmd-result-type">{SEARCH_TYPE_LABELS[item.type]}</span>
                    <span>{item.title}</span>
                    {item.subtitle ? <span className="muted">{item.subtitle}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="muted everitt-cmd-footer">
          Press Enter to ask Everitt · Esc to close ·{' '}
          <Link href="/settings/billing">Billing & AI usage</Link>
        </p>
      </div>
    </div>
  );
}
