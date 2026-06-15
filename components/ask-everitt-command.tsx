'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AiUpgradeModal } from '@/components/ai-upgrade-modal';
import {
  ASK_EVERITT_AI_SUGGESTIONS,
  ASK_EVERITT_SEARCH_SUGGESTIONS
} from '@/lib/ai-features';
import type { ProposedAiAction } from '@/lib/ai-actions';
import type {
  AskEverittMetric,
  AskEverittSearchGroup,
  AskEverittSearchRecord
} from '@/lib/ask-everitt/types';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { useWorkspacePlanOptional } from '@/components/workspace-plan-provider';
import { supabase } from '@/lib/supabase';

const RECORD_TYPE_LABELS: Record<AskEverittSearchRecord['type'], string> = {
  customer: 'Customer',
  job: 'Job',
  lead: 'Lead',
  worker: 'Worker',
  schedule: 'Schedule',
  booking: 'Booking',
  service: 'Service',
  availability: 'Availability',
  calendar: 'Calendar',
  form: 'Form',
  sop: 'SOP',
  document: 'Document',
  review: 'Review',
  note: 'Note',
  invoice: 'Invoice',
  expense: 'Expense',
  revenue: 'Revenue',
  activity: 'Activity',
  photo: 'Photo'
};

type AskEverittStatus = {
  searchAvailable: boolean;
  aiModeAvailable: boolean;
  configured: boolean;
  aiLocked: boolean;
  planLocked: boolean;
  lockedMessage: string | null;
  usage?: { monthlyUsed: number; monthlyCap: number; unlimited: boolean; remaining: number | null };
  staffAi?: {
    applies?: boolean;
    dailyUsed: number;
    dailyCap: number;
    monthlyUsed: number;
    monthlyCap: number;
  };
};

type SearchResponse = {
  mode: 'search';
  summary: string;
  results: AskEverittSearchRecord[];
  groups?: AskEverittSearchGroup[];
  metrics?: AskEverittMetric[];
  noResultsHint?: string;
};

type AiResponse = {
  mode: 'ai';
  reply: string;
  action?: ProposedAiAction | null;
};

type AskEverittCommandProps = {
  plan?: EverittosPlan | string | null;
  embedded?: boolean;
};

export function AskEverittCommand({ plan: planProp, embedded = false }: AskEverittCommandProps) {
  const router = useRouter();
  const workspacePlan = useWorkspacePlanOptional();
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [plan, setPlan] = useState<EverittosPlan | null>(
    workspacePlan?.plan ?? (planProp != null ? normalizePlan(planProp) : null)
  );
  const [query, setQuery] = useState('');
  const [searchSummary, setSearchSummary] = useState('');
  const [searchResults, setSearchResults] = useState<AskEverittSearchRecord[]>([]);
  const [searchGroups, setSearchGroups] = useState<AskEverittSearchGroup[]>([]);
  const [searchMetrics, setSearchMetrics] = useState<AskEverittMetric[]>([]);
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [aiReply, setAiReply] = useState('');
  const [pendingAction, setPendingAction] = useState<ProposedAiAction | null>(null);
  const [status, setStatus] = useState<AskEverittStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [lastMode, setLastMode] = useState<'search' | 'ai' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [kbd, setKbd] = useState('Ctrl+K');

  useEffect(() => {
    setKbd(navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl+K');
  }, []);

  useEffect(() => {
    if (workspacePlan?.plan) setPlan(workspacePlan.plan);
    else if (planProp != null) setPlan(normalizePlan(planProp));
  }, [planProp, workspacePlan?.plan]);

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/ai/status', { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    setStatus({
      searchAvailable: Boolean(json.searchAvailable ?? true),
      aiModeAvailable: Boolean(json.aiModeAvailable),
      configured: Boolean(json.configured),
      aiLocked: Boolean(json.aiLocked ?? !json.aiModeAvailable),
      planLocked: Boolean(json.locked && json.gate?.code === 'plan_required'),
      lockedMessage: json.lockedMessage || null,
      usage: json.usage
        ? {
            monthlyUsed: json.usage.monthlyUsed,
            monthlyCap: json.usage.monthlyCap,
            unlimited: json.usage.unlimited,
            remaining: json.usage.remaining
          }
        : undefined,
      staffAi: json.staffAi || undefined
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

  const openCommand = useCallback(() => {
    setOpen(true);
    setNotice('');
    setAiReply('');
    setSearchSummary('');
    setSearchResults([]);
    setSearchGroups([]);
    setSearchMetrics([]);
    setSearchHint(null);
    setPendingAction(null);
    setLastMode(null);
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

  async function submitAsk(text?: string, forceMode?: 'search' | 'ai') {
    const value = (text ?? query).trim();
    if (!value || busy) return;

    setBusy(true);
    setNotice('');
    setAiReply('');
    setSearchSummary('');
    setSearchResults([]);
    setSearchGroups([]);
    setSearchMetrics([]);
    setSearchHint(null);
    setPendingAction(null);

    const res = await fetch('/api/ask-everitt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: value, forceMode })
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      if (json.code === 'plan_required' || json.locked) {
        if (json.searchAvailable) {
          setNotice(json.error || 'Everitt AI is unavailable on your plan. Try a search question instead.');
        } else {
          setUpgradeOpen(true);
        }
        return;
      }
      if (json.searchAvailable && (json.code === 'staff_daily_limit' || json.code === 'staff_monthly_limit')) {
        setNotice(json.error);
        void loadStatus();
        return;
      }
      setNotice(json.error || 'Unable to complete your request.');
      return;
    }

    if (json.mode === 'search') {
      const payload = json as SearchResponse;
      setLastMode('search');
      setSearchSummary(payload.summary);
      setSearchResults(payload.results || []);
      setSearchGroups(payload.groups || []);
      setSearchMetrics(payload.metrics || []);
      setSearchHint(payload.noResultsHint || null);
      return;
    }

    const payload = json as AiResponse;
    setLastMode('ai');
    setAiReply(payload.reply || '');
    if (payload.action) setPendingAction(payload.action);
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
      if (json.locked) setUpgradeOpen(true);
      else setNotice(json.error || 'Action could not be completed.');
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
            Ask your business anything <span className="muted">{kbd}</span>
          </button>
        </div>
        <p className="muted">Search customers, jobs, leads, schedule, forms, and documents from your workspace.</p>
        <button type="button" className="btn btn-primary" onClick={openCommand}>
          Ask about customers, jobs, leads…
        </button>
        <AiUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
        {open ? (
          <CommandOverlay
            query={query}
            setQuery={setQuery}
            inputRef={inputRef}
            kbd={kbd}
            status={status}
            busy={busy}
            searchSummary={searchSummary}
            searchResults={searchResults}
            searchGroups={searchGroups}
            searchMetrics={searchMetrics}
            searchHint={searchHint}
            aiReply={aiReply}
            notice={notice}
            pendingAction={pendingAction}
            lastMode={lastMode}
            submitAsk={submitAsk}
            confirmAction={confirmAction}
            actionBusy={actionBusy}
            navigate={navigate}
            setPendingAction={setPendingAction}
            setUpgradeOpen={setUpgradeOpen}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </section>
    );
  }

  return (
    <>
      <button type="button" className="everitt-cmd-trigger" onClick={openCommand} aria-label="Ask Everitt">
        <span className="everitt-cmd-placeholder">Ask about customers, jobs, leads, workers, schedule, invoices…</span>
        <span className="everitt-cmd-kbd">{kbd}</span>
      </button>
      {open ? (
        <CommandOverlay
          query={query}
          setQuery={setQuery}
          inputRef={inputRef}
          kbd={kbd}
          status={status}
          busy={busy}
          searchSummary={searchSummary}
          searchResults={searchResults}
          searchGroups={searchGroups}
          searchMetrics={searchMetrics}
          searchHint={searchHint}
          aiReply={aiReply}
          notice={notice}
          pendingAction={pendingAction}
          lastMode={lastMode}
          submitAsk={submitAsk}
          confirmAction={confirmAction}
          actionBusy={actionBusy}
          navigate={navigate}
          setPendingAction={setPendingAction}
          setUpgradeOpen={setUpgradeOpen}
          onClose={() => setOpen(false)}
        />
      ) : null}
      <AiUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </>
  );
}

type OverlayProps = {
  query: string;
  setQuery: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  kbd: string;
  status: AskEverittStatus | null;
  busy: boolean;
  searchSummary: string;
  searchResults: AskEverittSearchRecord[];
  searchGroups: AskEverittSearchGroup[];
  searchMetrics: AskEverittMetric[];
  searchHint: string | null;
  aiReply: string;
  notice: string;
  pendingAction: ProposedAiAction | null;
  lastMode: 'search' | 'ai' | null;
  submitAsk: (text?: string, forceMode?: 'search' | 'ai') => Promise<void>;
  confirmAction: () => Promise<void>;
  actionBusy: boolean;
  navigate: (href: string) => void;
  setPendingAction: (a: ProposedAiAction | null) => void;
  setUpgradeOpen: (v: boolean) => void;
  onClose: () => void;
};

function CommandOverlay({
  query,
  setQuery,
  inputRef,
  kbd,
  status,
  busy,
  searchSummary,
  searchResults,
  searchGroups,
  searchMetrics,
  searchHint,
  aiReply,
  notice,
  pendingAction,
  lastMode,
  submitAsk,
  confirmAction,
  actionBusy,
  navigate,
  setPendingAction,
  setUpgradeOpen,
  onClose
}: OverlayProps) {
  return (
    <div className="everitt-cmd-overlay" role="presentation" onClick={onClose}>
      <div className="everitt-cmd-palette" role="dialog" aria-label="Ask Everitt" onClick={(e) => e.stopPropagation()}>
        <div className="everitt-cmd-bar">
          <input
            ref={inputRef}
            className="everitt-cmd-input"
            placeholder="Ask about customers, jobs, leads, workers, schedule, invoices, reviews, documents, or SOPs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitAsk();
            }}
          />
          <span className="everitt-cmd-kbd everitt-cmd-kbd-muted">{kbd}</span>
        </div>

        <p className="everitt-cmd-tagline muted">Searches your business records first.</p>

        {!query && !lastMode ? (
          <div className="everitt-cmd-suggestions">
            <p className="everitt-cmd-section-label">Try asking</p>
            {ASK_EVERITT_SEARCH_SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="everitt-cmd-chip" onClick={() => void submitAsk(s, 'search')}>
                {s}
              </button>
            ))}
            {ASK_EVERITT_AI_SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                type="button"
                className="everitt-cmd-chip everitt-cmd-chip-premium"
                onClick={() => {
                  if (status?.aiLocked && status.planLocked) {
                    setUpgradeOpen(true);
                    return;
                  }
                  void submitAsk(s.text, 'ai');
                }}
              >
                {s.text}
                <span className="everitt-cmd-premium-badge">AI</span>
              </button>
            ))}
          </div>
        ) : null}

        {status?.staffAi ? (
          <p className="muted everitt-cmd-usage">
            Your AI today: {status.staffAi.dailyUsed}/{status.staffAi.dailyCap} · This month:{' '}
            {status.staffAi.monthlyUsed}/{status.staffAi.monthlyCap} prompts
          </p>
        ) : status?.usage && status.aiModeAvailable ? (
          <p className="muted everitt-cmd-usage">
            {status.usage.unlimited
              ? 'Everitt AI unlimited (Enterprise)'
              : `Everitt AI: ${status.usage.monthlyUsed} / ${status.usage.monthlyCap} this month`}
          </p>
        ) : null}

        {status?.aiLocked && status.planLocked ? (
          <p className="everitt-cmd-hint muted">
            Everitt AI writing and analysis requires Business or Enterprise.{' '}
            <button type="button" className="link-button" onClick={() => setUpgradeOpen(true)}>
              View plans
            </button>
          </p>
        ) : null}

        {busy ? <p className="everitt-cmd-hint">Searching your workspace…</p> : null}

        {searchSummary ? (
          <div className="everitt-cmd-search-answer">
            <p className="everitt-cmd-summary">{searchSummary}</p>
            {searchHint ? <p className="muted everitt-cmd-hint">{searchHint}</p> : null}

            {searchMetrics.length > 0 ? (
              <div className="everitt-cmd-metrics">
                {searchMetrics.map((m) => (
                  <div key={m.label} className="everitt-cmd-metric-card">
                    <span className="everitt-cmd-metric-label">{m.label}</span>
                    <strong className="everitt-cmd-metric-value">{m.value}</strong>
                    {m.href ? (
                      <button type="button" className="btn btn-sm" onClick={() => navigate(m.href!)}>
                        View
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {(searchGroups.length > 0 ? searchGroups : [{ sourceId: 'all', label: 'Results', results: searchResults }]).map(
              (group) =>
                group.results.length > 0 ? (
                  <div key={group.sourceId} className="everitt-cmd-result-group">
                    {searchGroups.length > 1 ? (
                      <p className="everitt-cmd-section-label">{group.label}</p>
                    ) : null}
                    <ul className="everitt-cmd-result-cards">
                      {group.results.map((item) => (
                        <RecordResultCard key={`${item.type}-${item.id}`} item={item} onOpen={navigate} />
                      ))}
                    </ul>
                  </div>
                ) : null
            )}
          </div>
        ) : null}

        {aiReply ? (
          <div className="everitt-cmd-ai-block">
            <p className="everitt-cmd-section-label">Everitt AI</p>
            <div className="everitt-cmd-reply">{aiReply}</div>
          </div>
        ) : null}

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

        {notice ? <p className="everitt-cmd-notice">{notice}</p> : null}

        <p className="muted everitt-cmd-footer">
          Search uses your workspace data · AI only when needed · Esc to close ·{' '}
          <Link href="/settings/billing">Usage</Link>
        </p>
      </div>
    </div>
  );
}

function RecordResultCard({
  item,
  onOpen
}: {
  item: AskEverittSearchRecord;
  onOpen: (href: string) => void;
}) {
  return (
    <li className="everitt-cmd-result-card">
      <div className="everitt-cmd-result-card-head">
        <span className="everitt-cmd-result-type">{RECORD_TYPE_LABELS[item.type]}</span>
        {item.status ? <span className="everitt-cmd-result-status">{item.status}</span> : null}
        {item.date ? <span className="muted everitt-cmd-result-date">{item.date}</span> : null}
      </div>
      <p className="everitt-cmd-result-title">{item.title}</p>
      {item.subtitle ? <p className="muted everitt-cmd-result-sub">{item.subtitle}</p> : null}
      {item.owner ? <p className="muted everitt-cmd-result-owner">Owner: {item.owner}</p> : null}
      <button type="button" className="btn btn-sm" onClick={() => onOpen(item.href)}>
        {item.actionLabel}
      </button>
    </li>
  );
}
