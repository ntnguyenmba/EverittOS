'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AiUpgradeModal } from '@/components/ai-upgrade-modal';
import type { ProposedAiAction } from '@/lib/ai-actions';
import type { AskEverittMetric, AskEverittSearchGroup, AskEverittSearchRecord } from '@/lib/ask-everitt/types';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { useTranslation } from '@/components/locale-provider';

type AskLocale = 'en' | 'es' | 'vi';
type AskSuggestion = { label: string; prompt: string; mode?: 'search' | 'ai' };
type AskCopy = {
  title: string;
  trigger: string;
  inlineTrigger: string;
  embeddedDescription: string;
  embeddedButton: string;
  placeholder: string;
  tagline: string;
  tryAsking: string;
  aiBadge: string;
  staffUsage: string;
  unlimited: string;
  monthlyUsage: string;
  aiLocked: string;
  viewPlans: string;
  searching: string;
  view: string;
  results: string;
  owner: string;
  confirmAction: string;
  running: string;
  confirm: string;
  cancel: string;
  actionError: string;
  actionComplete: string;
  requestError: string;
  aiPlanNotice: string;
  footerPrefix: string;
  usage: string;
  recordLabels: Record<AskEverittSearchRecord['type'], string>;
  suggestions: AskSuggestion[];
};

const SEARCH_PROMPTS = [
  'What needs attention today?',
  "Show today's schedule.",
  'Which jobs are overdue?',
  'Which invoices are unpaid?',
  'Which leads need follow-up?',
  'What changed this week?',
  'Who are my best customers?',
  'Show revenue this month.',
  'Show new leads this week.',
  'Show customers who have not booked in 90 days.'
] as const;

const AI_PROMPTS = [
  "Write today's business brief.",
  'Tell me what to focus on next.',
  'Draft a follow-up message for open leads.',
  'Write a payment reminder for unpaid invoices.',
  'Summarize recent reviews.',
  'Draft a reactivation message for inactive customers.'
] as const;

const COPY: Record<AskLocale, AskCopy> = {
  en: {
    title: 'Ask Everitt',
    trigger: 'Ask about customers, jobs, leads, workers, schedule, invoices…',
    inlineTrigger: 'Ask your business anything',
    embeddedDescription: 'Search customers, jobs, leads, schedule, forms, and documents from your workspace.',
    embeddedButton: 'Ask about customers, jobs, leads…',
    placeholder: 'Ask about customers, jobs, leads, people, schedule, invoices, reviews, documents, or SOPs…',
    tagline: 'Searches your business records first.',
    tryAsking: 'Try asking',
    aiBadge: 'AI',
    staffUsage: 'Your AI today: {dailyUsed}/{dailyCap} · This month: {monthlyUsed}/{monthlyCap} prompts',
    unlimited: 'Everitt AI unlimited (Enterprise)',
    monthlyUsage: 'Everitt AI: {used} / {cap} this month',
    aiLocked: 'Everitt AI writing and analysis requires Business or Enterprise.',
    viewPlans: 'View plans',
    searching: 'Searching your workspace…',
    view: 'View',
    results: 'Results',
    owner: 'Owner',
    confirmAction: 'Confirm action:',
    running: 'Running…',
    confirm: 'Confirm',
    cancel: 'Cancel',
    actionError: 'Action could not be completed.',
    actionComplete: 'Action completed.',
    requestError: 'Unable to complete your request.',
    aiPlanNotice: 'Everitt AI is unavailable on your plan. Try a search question instead.',
    footerPrefix: 'Search uses your workspace data · AI only when needed · Esc to close ·',
    usage: 'Usage',
    recordLabels: {
      customer: 'Customer', job: 'Job', lead: 'Lead', worker: 'Team member', schedule: 'Schedule', booking: 'Booking',
      service: 'Service', availability: 'Availability', calendar: 'Calendar', form: 'Form', sop: 'SOP', document: 'Document',
      review: 'Review', note: 'Note', invoice: 'Invoice', expense: 'Expense', revenue: 'Revenue', activity: 'Activity', photo: 'Photo'
    },
    suggestions: [
      ...SEARCH_PROMPTS.map((prompt) => ({ label: prompt, prompt, mode: 'search' as const })),
      ...AI_PROMPTS.map((prompt) => ({ label: prompt, prompt, mode: 'ai' as const }))
    ]
  },
  es: {
    title: 'Preguntar a Everitt',
    trigger: 'Pregunte sobre clientes, trabajos, prospectos, equipo, agenda, facturas…',
    inlineTrigger: 'Pregunte cualquier cosa sobre su negocio',
    embeddedDescription: 'Busque clientes, trabajos, prospectos, agenda, formularios y documentos de su espacio.',
    embeddedButton: 'Preguntar sobre clientes, trabajos y prospectos…',
    placeholder: 'Pregunte sobre clientes, trabajos, prospectos, personas, agenda, facturas, reseñas, documentos o SOP…',
    tagline: 'Primero busca en los registros de su negocio.',
    tryAsking: 'Pruebe preguntar',
    aiBadge: 'IA',
    staffUsage: 'Su IA hoy: {dailyUsed}/{dailyCap} · Este mes: {monthlyUsed}/{monthlyCap} solicitudes',
    unlimited: 'Everitt IA ilimitada (Enterprise)',
    monthlyUsage: 'Everitt IA: {used} / {cap} este mes',
    aiLocked: 'La escritura y el análisis de Everitt IA requieren Business o Enterprise.',
    viewPlans: 'Ver planes',
    searching: 'Buscando en su espacio…',
    view: 'Ver',
    results: 'Resultados',
    owner: 'Responsable',
    confirmAction: 'Confirmar acción:',
    running: 'Ejecutando…',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    actionError: 'No se pudo completar la acción.',
    actionComplete: 'Acción completada.',
    requestError: 'No se pudo completar la solicitud.',
    aiPlanNotice: 'Everitt IA no está disponible en su plan. Pruebe una pregunta de búsqueda.',
    footerPrefix: 'La búsqueda usa los datos de su espacio · IA solo cuando se necesita · Esc para cerrar ·',
    usage: 'Uso',
    recordLabels: {
      customer: 'Cliente', job: 'Trabajo', lead: 'Prospecto', worker: 'Miembro del equipo', schedule: 'Agenda', booking: 'Reserva',
      service: 'Servicio', availability: 'Disponibilidad', calendar: 'Calendario', form: 'Formulario', sop: 'SOP', document: 'Documento',
      review: 'Reseña', note: 'Nota', invoice: 'Factura', expense: 'Gasto', revenue: 'Ingresos', activity: 'Actividad', photo: 'Foto'
    },
    suggestions: [
      { label: '¿Qué necesita atención hoy?', prompt: SEARCH_PROMPTS[0], mode: 'search' },
      { label: 'Mostrar la agenda de hoy.', prompt: SEARCH_PROMPTS[1], mode: 'search' },
      { label: '¿Qué trabajos están atrasados?', prompt: SEARCH_PROMPTS[2], mode: 'search' },
      { label: '¿Qué facturas están sin pagar?', prompt: SEARCH_PROMPTS[3], mode: 'search' },
      { label: '¿Qué prospectos necesitan seguimiento?', prompt: SEARCH_PROMPTS[4], mode: 'search' },
      { label: '¿Qué cambió esta semana?', prompt: SEARCH_PROMPTS[5], mode: 'search' },
      { label: '¿Quiénes son mis mejores clientes?', prompt: SEARCH_PROMPTS[6], mode: 'search' },
      { label: 'Mostrar ingresos de este mes.', prompt: SEARCH_PROMPTS[7], mode: 'search' },
      { label: 'Mostrar prospectos nuevos de esta semana.', prompt: SEARCH_PROMPTS[8], mode: 'search' },
      { label: 'Mostrar clientes sin reserva en 90 días.', prompt: SEARCH_PROMPTS[9], mode: 'search' },
      { label: 'Escribir el resumen comercial de hoy.', prompt: AI_PROMPTS[0], mode: 'ai' },
      { label: 'Dime en qué enfocarme después.', prompt: AI_PROMPTS[1], mode: 'ai' },
      { label: 'Redactar seguimiento para prospectos abiertos.', prompt: AI_PROMPTS[2], mode: 'ai' },
      { label: 'Escribir recordatorio de pago para facturas sin pagar.', prompt: AI_PROMPTS[3], mode: 'ai' },
      { label: 'Resumir reseñas recientes.', prompt: AI_PROMPTS[4], mode: 'ai' },
      { label: 'Redactar mensaje para reactivar clientes inactivos.', prompt: AI_PROMPTS[5], mode: 'ai' }
    ]
  },
  vi: {
    title: 'Hỏi Everitt',
    trigger: 'Hỏi về khách hàng, công việc, khách tiềm năng, đội ngũ, lịch, hóa đơn…',
    inlineTrigger: 'Hỏi bất cứ điều gì về doanh nghiệp',
    embeddedDescription: 'Tìm khách hàng, công việc, khách tiềm năng, lịch, biểu mẫu và tài liệu trong không gian làm việc.',
    embeddedButton: 'Hỏi về khách hàng, công việc, khách tiềm năng…',
    placeholder: 'Hỏi về khách hàng, công việc, khách tiềm năng, nhân sự, lịch, hóa đơn, đánh giá, tài liệu hoặc SOP…',
    tagline: 'Tìm trong dữ liệu doanh nghiệp của bạn trước.',
    tryAsking: 'Thử hỏi',
    aiBadge: 'AI',
    staffUsage: 'AI hôm nay: {dailyUsed}/{dailyCap} · Tháng này: {monthlyUsed}/{monthlyCap} lượt hỏi',
    unlimited: 'Everitt AI không giới hạn (Enterprise)',
    monthlyUsage: 'Everitt AI: {used} / {cap} tháng này',
    aiLocked: 'Viết và phân tích bằng Everitt AI cần gói Business hoặc Enterprise.',
    viewPlans: 'Xem gói',
    searching: 'Đang tìm trong không gian làm việc…',
    view: 'Xem',
    results: 'Kết quả',
    owner: 'Phụ trách',
    confirmAction: 'Xác nhận thao tác:',
    running: 'Đang chạy…',
    confirm: 'Xác nhận',
    cancel: 'Hủy',
    actionError: 'Không thể hoàn tất thao tác.',
    actionComplete: 'Đã hoàn tất thao tác.',
    requestError: 'Không thể hoàn tất yêu cầu.',
    aiPlanNotice: 'Everitt AI không có trong gói của bạn. Hãy thử câu hỏi tìm kiếm.',
    footerPrefix: 'Tìm kiếm dùng dữ liệu không gian của bạn · Chỉ dùng AI khi cần · Esc để đóng ·',
    usage: 'Mức dùng',
    recordLabels: {
      customer: 'Khách hàng', job: 'Công việc', lead: 'Khách tiềm năng', worker: 'Thành viên nhóm', schedule: 'Lịch', booking: 'Đặt lịch',
      service: 'Dịch vụ', availability: 'Thời gian trống', calendar: 'Lịch', form: 'Biểu mẫu', sop: 'SOP', document: 'Tài liệu',
      review: 'Đánh giá', note: 'Ghi chú', invoice: 'Hóa đơn', expense: 'Chi phí', revenue: 'Doanh thu', activity: 'Hoạt động', photo: 'Ảnh'
    },
    suggestions: [
      { label: 'Hôm nay cần chú ý gì?', prompt: SEARCH_PROMPTS[0], mode: 'search' },
      { label: 'Hiển thị lịch hôm nay.', prompt: SEARCH_PROMPTS[1], mode: 'search' },
      { label: 'Công việc nào đang quá hạn?', prompt: SEARCH_PROMPTS[2], mode: 'search' },
      { label: 'Hóa đơn nào chưa thanh toán?', prompt: SEARCH_PROMPTS[3], mode: 'search' },
      { label: 'Khách tiềm năng nào cần theo dõi?', prompt: SEARCH_PROMPTS[4], mode: 'search' },
      { label: 'Tuần này có gì thay đổi?', prompt: SEARCH_PROMPTS[5], mode: 'search' },
      { label: 'Khách hàng tốt nhất của tôi là ai?', prompt: SEARCH_PROMPTS[6], mode: 'search' },
      { label: 'Hiển thị doanh thu tháng này.', prompt: SEARCH_PROMPTS[7], mode: 'search' },
      { label: 'Hiển thị khách tiềm năng mới tuần này.', prompt: SEARCH_PROMPTS[8], mode: 'search' },
      { label: 'Hiển thị khách chưa đặt lịch trong 90 ngày.', prompt: SEARCH_PROMPTS[9], mode: 'search' },
      { label: 'Viết tóm tắt kinh doanh hôm nay.', prompt: AI_PROMPTS[0], mode: 'ai' },
      { label: 'Cho tôi biết nên tập trung vào việc gì tiếp theo.', prompt: AI_PROMPTS[1], mode: 'ai' },
      { label: 'Soạn tin nhắn theo dõi khách tiềm năng.', prompt: AI_PROMPTS[2], mode: 'ai' },
      { label: 'Viết nhắc thanh toán cho hóa đơn chưa trả.', prompt: AI_PROMPTS[3], mode: 'ai' },
      { label: 'Tóm tắt đánh giá gần đây.', prompt: AI_PROMPTS[4], mode: 'ai' },
      { label: 'Soạn tin nhắn kích hoạt lại khách hàng cũ.', prompt: AI_PROMPTS[5], mode: 'ai' }
    ]
  }
};

function normalizeAskLocale(locale: string | null | undefined): AskLocale {
  if (locale?.startsWith('es')) return 'es';
  if (locale?.startsWith('vi')) return 'vi';
  return 'en';
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

type AskEverittStatus = {
  searchAvailable: boolean;
  aiModeAvailable: boolean;
  configured: boolean;
  aiLocked: boolean;
  planLocked: boolean;
  lockedMessage: string | null;
  usage?: { monthlyUsed: number; monthlyCap: number; unlimited: boolean; remaining: number | null };
  staffAi?: { applies?: boolean; dailyUsed: number; dailyCap: number; monthlyUsed: number; monthlyCap: number };
};

type SearchResponse = {
  mode: 'search';
  summary: string;
  results: AskEverittSearchRecord[];
  groups?: AskEverittSearchGroup[];
  metrics?: AskEverittMetric[];
  noResultsHint?: string;
};

type AiResponse = { mode: 'ai'; reply: string; action?: ProposedAiAction | null };
type AskEverittCommandProps = { plan?: EverittosPlan | string | null; embedded?: boolean };

export function AskEverittCommand({ plan: _planProp, embedded = false }: AskEverittCommandProps) {
  const router = useRouter();
  const { locale } = useTranslation();
  const askLocale = normalizeAskLocale(locale);
  const copy = COPY[askLocale];
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
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
        ? { monthlyUsed: json.usage.monthlyUsed, monthlyCap: json.usage.monthlyCap, unlimited: json.usage.unlimited, remaining: json.usage.remaining }
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
      body: JSON.stringify({ prompt: value, forceMode, locale: askLocale })
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      if (json.code === 'plan_required' || json.locked) {
        if (json.searchAvailable) setNotice(json.error || copy.aiPlanNotice);
        else setUpgradeOpen(true);
        return;
      }
      if (json.searchAvailable && (json.code === 'staff_daily_limit' || json.code === 'staff_monthly_limit')) {
        setNotice(json.error);
        void loadStatus();
        return;
      }
      setNotice(json.error || copy.requestError);
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
      else setNotice(json.error || copy.actionError);
      return;
    }
    setNotice(json.message || copy.actionComplete);
    setPendingAction(null);
  }

  function navigate(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  const overlay = open ? (
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
      copy={copy}
    />
  ) : null;

  if (embedded) {
    return (
      <section className="card command-ask-everitt">
        <div className="command-ask-head">
          <h2>{copy.title}</h2>
          <button type="button" className="everitt-cmd-trigger everitt-cmd-trigger-inline" onClick={openCommand}>
            {copy.inlineTrigger} <span className="muted">{kbd}</span>
          </button>
        </div>
        <p className="muted">{copy.embeddedDescription}</p>
        <button type="button" className="btn btn-primary" onClick={openCommand}>{copy.embeddedButton}</button>
        <AiUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
        {overlay}
      </section>
    );
  }

  return (
    <>
      <button type="button" className="everitt-cmd-trigger" onClick={openCommand} aria-label={copy.title}>
        <span className="everitt-cmd-placeholder">{copy.trigger}</span>
        <span className="everitt-cmd-kbd">{kbd}</span>
      </button>
      {overlay}
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
  copy: AskCopy;
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
  onClose,
  copy
}: OverlayProps) {
  return (
    <div className="everitt-cmd-overlay" role="presentation" onClick={onClose}>
      <div className="everitt-cmd-palette" role="dialog" aria-label={copy.title} onClick={(e) => e.stopPropagation()}>
        <div className="everitt-cmd-bar">
          <input
            ref={inputRef}
            className="everitt-cmd-input"
            placeholder={copy.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitAsk();
            }}
          />
          <span className="everitt-cmd-kbd everitt-cmd-kbd-muted">{kbd}</span>
        </div>

        <p className="everitt-cmd-tagline muted">{copy.tagline}</p>

        {!query && !lastMode ? (
          <div className="everitt-cmd-suggestions">
            <p className="everitt-cmd-section-label">{copy.tryAsking}</p>
            {copy.suggestions.map((s) => (
              <button
                key={`${s.mode}-${s.label}`}
                type="button"
                className={s.mode === 'ai' ? 'everitt-cmd-chip everitt-cmd-chip-premium' : 'everitt-cmd-chip'}
                onClick={() => {
                  if (s.mode === 'ai' && status?.aiLocked && status.planLocked) {
                    setUpgradeOpen(true);
                    return;
                  }
                  void submitAsk(s.prompt, s.mode);
                }}
              >
                {s.label}
                {s.mode === 'ai' ? <span className="everitt-cmd-premium-badge">{copy.aiBadge}</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        {status?.staffAi ? (
          <p className="muted everitt-cmd-usage">
            {fill(copy.staffUsage, {
              dailyUsed: status.staffAi.dailyUsed,
              dailyCap: status.staffAi.dailyCap,
              monthlyUsed: status.staffAi.monthlyUsed,
              monthlyCap: status.staffAi.monthlyCap
            })}
          </p>
        ) : status?.usage && status.aiModeAvailable ? (
          <p className="muted everitt-cmd-usage">
            {status.usage.unlimited ? copy.unlimited : fill(copy.monthlyUsage, { used: status.usage.monthlyUsed, cap: status.usage.monthlyCap })}
          </p>
        ) : null}

        {status?.aiLocked && status.planLocked ? (
          <p className="everitt-cmd-hint muted">
            {copy.aiLocked}{' '}
            <button type="button" className="link-button" onClick={() => setUpgradeOpen(true)}>{copy.viewPlans}</button>
          </p>
        ) : null}

        {busy ? <p className="everitt-cmd-hint">{copy.searching}</p> : null}

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
                    {m.href ? <button type="button" className="btn btn-sm" onClick={() => navigate(m.href!)}>{copy.view}</button> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {(searchGroups.length > 0 ? searchGroups : [{ sourceId: 'all', label: copy.results, results: searchResults }]).map((group) =>
              group.results.length > 0 ? (
                <div key={group.sourceId} className="everitt-cmd-result-group">
                  {searchGroups.length > 1 ? <p className="everitt-cmd-section-label">{group.label || copy.results}</p> : null}
                  <ul className="everitt-cmd-result-cards">
                    {group.results.map((item) => <RecordResultCard key={`${item.type}-${item.id}`} item={item} onOpen={navigate} copy={copy} />)}
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
            <p><strong>{copy.confirmAction}</strong> {pendingAction.label}</p>
            <div className="settings-actions">
              <button type="button" className="btn btn-primary" disabled={actionBusy} onClick={() => void confirmAction()}>
                {actionBusy ? copy.running : copy.confirm}
              </button>
              <button type="button" className="btn" onClick={() => setPendingAction(null)}>{copy.cancel}</button>
            </div>
          </div>
        ) : null}

        {notice ? <p className="everitt-cmd-notice">{notice}</p> : null}
        <p className="muted everitt-cmd-footer">{copy.footerPrefix} <Link href="/settings/billing">{copy.usage}</Link></p>
      </div>
    </div>
  );
}

function RecordResultCard({ item, onOpen, copy }: { item: AskEverittSearchRecord; onOpen: (href: string) => void; copy: AskCopy }) {
  return (
    <li className="everitt-cmd-result-card">
      <div className="everitt-cmd-result-card-head">
        <span className="everitt-cmd-result-type">{copy.recordLabels[item.type]}</span>
        {item.status ? <span className="everitt-cmd-result-status">{item.status}</span> : null}
        {item.date ? <span className="muted everitt-cmd-result-date">{item.date}</span> : null}
      </div>
      <p className="everitt-cmd-result-title">{item.title}</p>
      {item.subtitle ? <p className="muted everitt-cmd-result-sub">{item.subtitle}</p> : null}
      {item.owner ? <p className="muted everitt-cmd-result-owner">{copy.owner}: {item.owner}</p> : null}
      <button type="button" className="btn btn-sm" onClick={() => onOpen(item.href)}>{copy.view}</button>
    </li>
  );
}
