'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTranslation } from '@/components/locale-provider';

type ReferralPayout = {
  payout_status: 'unpaid' | 'pending' | 'paid';
  payout_amount: number | null;
  payout_date: string | null;
  payout_notes: string | null;
};

type ReferralRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  business_name: string | null;
  referral_source: string | null;
  referral_detail: string | null;
  referred_by: string | null;
  created_at: string | null;
  payout: ReferralPayout | null;
};

type PayoutStatus = 'Unpaid' | 'Pending' | 'Paid';

type PayoutDraft = {
  status: PayoutStatus;
  amount: string;
  paidAt: string;
  notes: string;
  referralSource: string;
  referralDetail: string;
  referredBy: string;
};

const copy = {
  en: {
    title: 'Referral report',
    description: 'Track signup sources, referrers, and payout status for EverittOS referrals.',
    intro: 'Referral details and payout status are saved to the EverittOS database and included in CSV export.',
    backToSettings: 'Back to settings',
    dateRange: 'Signup date range',
    from: 'From',
    to: 'To',
    loading: 'Loading...',
    applyRange: 'Apply date range',
    clearDates: 'Clear dates',
    showingRange: 'Showing signups from {from} through {to}.',
    beginning: 'the beginning',
    today: 'today',
    showingAll: 'Showing referral signups from all dates.',
    matchingSignups: 'Matching signups',
    unpaidLiability: 'Unpaid liability',
    pendingPayouts: 'Pending payouts',
    paidReferrals: 'Paid referrals',
    leaderboard: 'Referral leaderboard',
    monthlyTotals: 'Monthly referral totals',
    signupOne: '{count} signup',
    signupMany: '{count} signups',
    paid: 'Paid',
    pending: 'Pending',
    unpaid: 'Unpaid',
    searchLabel: 'Search referrals',
    searchPlaceholder: 'Name, email, company, source, or referrer',
    sourceFilter: 'Source filter',
    allSources: 'All sources',
    payoutStatus: 'Payout status',
    allStatuses: 'All statuses',
    exportCsv: 'Export filtered CSV',
    loadingReferrals: 'Loading referrals...',
    empty: 'No referral signups found for the selected filters.',
    signup: 'Signup',
    noEmail: 'No email',
    signedUp: 'Signed up',
    referralSource: 'Referral source',
    referralDetails: 'Referral details',
    referredBy: 'Referred by',
    referralAmount: 'Referral amount',
    payoutDate: 'Payout date',
    notes: 'Notes',
    notesPlaceholder: 'Payment note or Zelle reference',
    saving: 'Saving...',
    savePayout: 'Save referral payout',
    loadError: 'Unable to load referral report.',
    saveError: 'Unable to save referral payout.',
    savedFor: 'Referral payout saved for {name}.',
    dateOrderError: 'The start date must be before or equal to the end date.',
    unknown: 'Unknown',
    na: 'N/A'
  },
  es: {
    title: 'Informe de referidos',
    description: 'Supervise fuentes de registro, referentes y estado de pagos de referidos de EverittOS.',
    intro: 'Los detalles de referidos y el estado de pago se guardan en la base de datos de EverittOS y se incluyen en la exportación CSV.',
    backToSettings: 'Volver a configuración',
    dateRange: 'Rango de fechas de registro',
    from: 'Desde',
    to: 'Hasta',
    loading: 'Cargando...',
    applyRange: 'Aplicar rango de fechas',
    clearDates: 'Borrar fechas',
    showingRange: 'Mostrando registros desde {from} hasta {to}.',
    beginning: 'el inicio',
    today: 'hoy',
    showingAll: 'Mostrando registros de referidos de todas las fechas.',
    matchingSignups: 'Registros coincidentes',
    unpaidLiability: 'Pendiente por pagar',
    pendingPayouts: 'Pagos en proceso',
    paidReferrals: 'Referidos pagados',
    leaderboard: 'Tabla de referidos',
    monthlyTotals: 'Totales mensuales de referidos',
    signupOne: '{count} registro',
    signupMany: '{count} registros',
    paid: 'Pagado',
    pending: 'Pendiente',
    unpaid: 'Sin pagar',
    searchLabel: 'Buscar referidos',
    searchPlaceholder: 'Nombre, correo, empresa, fuente o referente',
    sourceFilter: 'Filtro de fuente',
    allSources: 'Todas las fuentes',
    payoutStatus: 'Estado del pago',
    allStatuses: 'Todos los estados',
    exportCsv: 'Exportar CSV filtrado',
    loadingReferrals: 'Cargando referidos...',
    empty: 'No se encontraron registros de referidos para los filtros seleccionados.',
    signup: 'Registro',
    noEmail: 'Sin correo',
    signedUp: 'Registrado',
    referralSource: 'Fuente del referido',
    referralDetails: 'Detalles del referido',
    referredBy: 'Referido por',
    referralAmount: 'Monto del referido',
    payoutDate: 'Fecha de pago',
    notes: 'Notas',
    notesPlaceholder: 'Nota de pago o referencia de Zelle',
    saving: 'Guardando...',
    savePayout: 'Guardar pago de referido',
    loadError: 'No se pudo cargar el informe de referidos.',
    saveError: 'No se pudo guardar el pago del referido.',
    savedFor: 'Pago de referido guardado para {name}.',
    dateOrderError: 'La fecha de inicio debe ser anterior o igual a la fecha de fin.',
    unknown: 'Desconocido',
    na: 'N/D'
  },
  vi: {
    title: 'Báo cáo giới thiệu',
    description: 'Theo dõi nguồn đăng ký, người giới thiệu và trạng thái thanh toán giới thiệu EverittOS.',
    intro: 'Chi tiết giới thiệu và trạng thái thanh toán được lưu vào cơ sở dữ liệu EverittOS và đưa vào xuất CSV.',
    backToSettings: 'Quay lại cài đặt',
    dateRange: 'Khoảng ngày đăng ký',
    from: 'Từ',
    to: 'Đến',
    loading: 'Đang tải...',
    applyRange: 'Áp dụng khoảng ngày',
    clearDates: 'Xóa ngày',
    showingRange: 'Đang hiển thị đăng ký từ {from} đến {to}.',
    beginning: 'đầu',
    today: 'hôm nay',
    showingAll: 'Đang hiển thị tất cả đăng ký giới thiệu theo mọi ngày.',
    matchingSignups: 'Đăng ký khớp',
    unpaidLiability: 'Chưa thanh toán',
    pendingPayouts: 'Đang chờ thanh toán',
    paidReferrals: 'Giới thiệu đã trả',
    leaderboard: 'Bảng xếp hạng giới thiệu',
    monthlyTotals: 'Tổng giới thiệu theo tháng',
    signupOne: '{count} đăng ký',
    signupMany: '{count} đăng ký',
    paid: 'Đã trả',
    pending: 'Đang chờ',
    unpaid: 'Chưa trả',
    searchLabel: 'Tìm giới thiệu',
    searchPlaceholder: 'Tên, email, công ty, nguồn hoặc người giới thiệu',
    sourceFilter: 'Lọc nguồn',
    allSources: 'Tất cả nguồn',
    payoutStatus: 'Trạng thái thanh toán',
    allStatuses: 'Tất cả trạng thái',
    exportCsv: 'Xuất CSV đã lọc',
    loadingReferrals: 'Đang tải giới thiệu...',
    empty: 'Không tìm thấy đăng ký giới thiệu cho bộ lọc đã chọn.',
    signup: 'Đăng ký',
    noEmail: 'Không có email',
    signedUp: 'Đã đăng ký',
    referralSource: 'Nguồn giới thiệu',
    referralDetails: 'Chi tiết giới thiệu',
    referredBy: 'Được giới thiệu bởi',
    referralAmount: 'Số tiền giới thiệu',
    payoutDate: 'Ngày thanh toán',
    notes: 'Ghi chú',
    notesPlaceholder: 'Ghi chú thanh toán hoặc mã Zelle',
    saving: 'Đang lưu...',
    savePayout: 'Lưu thanh toán giới thiệu',
    loadError: 'Không thể tải báo cáo giới thiệu.',
    saveError: 'Không thể lưu thanh toán giới thiệu.',
    savedFor: 'Đã lưu thanh toán giới thiệu cho {name}.',
    dateOrderError: 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
    unknown: 'Không xác định',
    na: 'N/A'
  }
} as const;

type ReferralCopy = (typeof copy)[keyof typeof copy];

function formatDate(value: string | null, na: string) {
  if (!value) return na;
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

function statusLabel(value: string | null | undefined): PayoutStatus {
  if (value === 'paid') return 'Paid';
  if (value === 'pending') return 'Pending';
  return 'Unpaid';
}

function statusDisplay(status: PayoutStatus, c: ReferralCopy) {
  if (status === 'Paid') return c.paid;
  if (status === 'Pending') return c.pending;
  return c.unpaid;
}

function signupLabel(count: number, c: ReferralCopy) {
  return (count === 1 ? c.signupOne : c.signupMany).replace('{count}', String(count));
}

function payoutDraft(row: ReferralRow): PayoutDraft {
  return {
    status: statusLabel(row.payout?.payout_status),
    amount: row.payout?.payout_amount === null || row.payout?.payout_amount === undefined ? '' : String(row.payout.payout_amount),
    paidAt: row.payout?.payout_date || '',
    notes: row.payout?.payout_notes || '',
    referralSource: row.referral_source || '',
    referralDetail: row.referral_detail || '',
    referredBy: row.referred_by || ''
  };
}

function downloadCsv(rows: ReferralRow[], payouts: Record<string, PayoutDraft>, from: string, to: string) {
  const headers = ['signup_date', 'customer_email', 'customer_name', 'business_name', 'source', 'referral_detail', 'referred_by', 'payout_status', 'payout_amount', 'payout_date', 'payout_notes'];
  const csvRows = rows.map((row) => {
    const payout = payouts[row.id] || payoutDraft(row);
    const values = [
      row.created_at || '',
      row.email || '',
      row.full_name || '',
      row.business_name || '',
      payout.referralSource,
      payout.referralDetail,
      payout.referredBy,
      payout.status,
      payout.amount,
      payout.paidAt,
      payout.notes
    ];
    return values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',');
  });
  const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const range = from || to ? `-${from || 'start'}-to-${to || 'today'}` : '';
  link.href = url;
  link.download = `everitt-referrals${range}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReferralReportPage() {
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [savingId, setSavingId] = useState('');
  const [payouts, setPayouts] = useState<Record<string, PayoutDraft>>({});

  async function load(from = '', to = '') {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`/api/settings/referrals${params.size ? `?${params.toString()}` : ''}`);
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error || c.loadError);
      return;
    }
    const nextRows = (json.referrals || []) as ReferralRow[];
    setRows(nextRows);
    setPayouts(Object.fromEntries(nextRows.map((row) => [row.id, payoutDraft(row)])));
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  useEffect(() => {
    void load();
  }, []);

  const sources = useMemo(() => Array.from(new Set(rows.map((row) => row.referral_source).filter(Boolean) as string[])).sort(), [rows]);
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const payout = payouts[row.id] || payoutDraft(row);
      if (sourceFilter && payout.referralSource !== sourceFilter) return false;
      if (statusFilter && payout.status !== statusFilter) return false;
      if (!q) return true;
      return [row.email, row.full_name, row.business_name, payout.referralSource, payout.referralDetail, payout.referredBy]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [rows, payouts, search, sourceFilter, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ReferralRow[]>();
    for (const row of filteredRows) {
      const draft = payouts[row.id] || payoutDraft(row);
      const key = draft.referralDetail || draft.referredBy || draft.referralSource || c.unknown;
      const current = map.get(key) || [];
      current.push(row);
      map.set(key, current);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [filteredRows, payouts, c.unknown]);

  const totals = useMemo(() => {
    let unpaid = 0;
    let pending = 0;
    let paid = 0;
    for (const row of filteredRows) {
      const payout = payouts[row.id] || payoutDraft(row);
      const amount = Number.parseFloat(payout.amount) || 0;
      if (payout.status === 'Paid') paid += amount;
      else if (payout.status === 'Pending') pending += amount;
      else unpaid += amount;
    }
    return { unpaid, pending, paid };
  }, [filteredRows, payouts]);

  const leaderboard = useMemo(() => {
    const map = new Map<string, { signups: number; paid: number; pending: number; unpaid: number }>();
    for (const row of filteredRows) {
      const payout = payouts[row.id] || payoutDraft(row);
      const key = payout.referralDetail || payout.referredBy || payout.referralSource || c.unknown;
      const current = map.get(key) || { signups: 0, paid: 0, pending: 0, unpaid: 0 };
      const amount = Number.parseFloat(payout.amount) || 0;
      current.signups += 1;
      if (payout.status === 'Paid') current.paid += amount;
      else if (payout.status === 'Pending') current.pending += amount;
      else current.unpaid += amount;
      map.set(key, current);
    }
    return Array.from(map.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.signups - a.signups || b.paid - a.paid || a.name.localeCompare(b.name));
  }, [filteredRows, payouts, c.unknown]);

  const monthlyTotals = useMemo(() => {
    const map = new Map<string, { signups: number; paid: number; pending: number; unpaid: number }>();
    for (const row of filteredRows) {
      const payout = payouts[row.id] || payoutDraft(row);
      const date = payout.paidAt || row.created_at || '';
      const month = date.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) continue;
      const current = map.get(month) || { signups: 0, paid: 0, pending: 0, unpaid: 0 };
      const amount = Number.parseFloat(payout.amount) || 0;
      current.signups += 1;
      if (payout.status === 'Paid') current.paid += amount;
      else if (payout.status === 'Pending') current.pending += amount;
      else current.unpaid += amount;
      map.set(month, current);
    }
    return Array.from(map.entries())
      .map(([month, values]) => ({ month, ...values }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredRows, payouts]);

  function updatePayout(rowId: string, patch: Partial<PayoutDraft>) {
    setPayouts((current) => ({
      ...current,
      [rowId]: {
        ...(current[rowId] || {
          status: 'Unpaid',
          amount: '',
          paidAt: '',
          notes: '',
          referralSource: '',
          referralDetail: '',
          referredBy: ''
        }),
        ...patch
      }
    }));
  }

  async function savePayout(row: ReferralRow) {
    const payout = payouts[row.id] || payoutDraft(row);
    setSavingId(row.id);
    setError('');
    setSuccess('');
    const res = await fetch('/api/settings/referrals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: row.id,
        referralSource: payout.referralSource,
        referralDetail: payout.referralDetail,
        referredBy: payout.referredBy,
        payoutStatus: payout.status,
        payoutAmount: payout.amount,
        payoutDate: payout.paidAt || null,
        payoutNotes: payout.notes
      })
    });
    const json = await res.json().catch(() => ({}));
    setSavingId('');
    if (!res.ok) {
      setError(json.error || c.saveError);
      return;
    }
    setSuccess(c.savedFor.replace('{name}', row.email || row.business_name || c.signup));
    await load(appliedFrom, appliedTo);
  }

  async function applyDateRange() {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError(c.dateOrderError);
      return;
    }
    await load(dateFrom, dateTo);
  }

  async function clearDateRange() {
    setDateFrom('');
    setDateTo('');
    await load('', '');
  }

  const rangeNote =
    appliedFrom || appliedTo
      ? c.showingRange.replace('{from}', appliedFrom || c.beginning).replace('{to}', appliedTo || c.today)
      : c.showingAll;

  return (
    <SettingsShell title={c.title} description={c.description}>
      <div className="settings-card">
        <p className="muted">{c.intro}</p>
        <p>
          <Link href="/settings">{c.backToSettings}</Link>
        </p>
      </div>

      <div className="settings-card form settings-form-grid">
        <h3>{c.dateRange}</h3>
        <label htmlFor="referral-date-from">{c.from}</label>
        <input id="referral-date-from" className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <label htmlFor="referral-date-to">{c.to}</label>
        <input id="referral-date-to" className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <div className="inline-actions">
          <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void applyDateRange()}>
            {loading ? c.loading : c.applyRange}
          </button>
          <button type="button" className="btn" disabled={loading || (!dateFrom && !dateTo && !appliedFrom && !appliedTo)} onClick={() => void clearDateRange()}>
            {c.clearDates}
          </button>
        </div>
        <p className="muted">{rangeNote}</p>
      </div>

      <div className="finance-metric-grid financials-summary-grid">
        <div className="finance-metric">
          <span className="finance-metric-label">{c.matchingSignups}</span>
          <strong>{filteredRows.length}</strong>
        </div>
        <div className="finance-metric">
          <span className="finance-metric-label">{c.unpaidLiability}</span>
          <strong>${totals.unpaid.toFixed(2)}</strong>
        </div>
        <div className="finance-metric">
          <span className="finance-metric-label">{c.pendingPayouts}</span>
          <strong>${totals.pending.toFixed(2)}</strong>
        </div>
        <div className="finance-metric">
          <span className="finance-metric-label">{c.paidReferrals}</span>
          <strong>${totals.paid.toFixed(2)}</strong>
        </div>
      </div>

      {leaderboard.length > 0 ? (
        <section className="settings-card">
          <h3>{c.leaderboard}</h3>
          <div className="finance-list">
            {leaderboard.map((item, index) => (
              <div key={item.name} className="finance-list-card">
                <div>
                  <strong>
                    #{index + 1} {item.name}
                  </strong>
                  <p className="muted">{signupLabel(item.signups, c)}</p>
                </div>
                <div className="finance-metric-grid financials-summary-grid">
                  <div className="finance-metric">
                    <span className="finance-metric-label">{c.paid}</span>
                    <strong>${item.paid.toFixed(2)}</strong>
                  </div>
                  <div className="finance-metric">
                    <span className="finance-metric-label">{c.pending}</span>
                    <strong>${item.pending.toFixed(2)}</strong>
                  </div>
                  <div className="finance-metric">
                    <span className="finance-metric-label">{c.unpaid}</span>
                    <strong>${item.unpaid.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {monthlyTotals.length > 0 ? (
        <section className="settings-card">
          <h3>{c.monthlyTotals}</h3>
          <div className="finance-list">
            {monthlyTotals.map((item) => (
              <div key={item.month} className="finance-list-card">
                <div>
                  <strong>{monthLabel(item.month)}</strong>
                  <p className="muted">{signupLabel(item.signups, c)}</p>
                </div>
                <div className="finance-metric-grid financials-summary-grid">
                  <div className="finance-metric">
                    <span className="finance-metric-label">{c.paid}</span>
                    <strong>${item.paid.toFixed(2)}</strong>
                  </div>
                  <div className="finance-metric">
                    <span className="finance-metric-label">{c.pending}</span>
                    <strong>${item.pending.toFixed(2)}</strong>
                  </div>
                  <div className="finance-metric">
                    <span className="finance-metric-label">{c.unpaid}</span>
                    <strong>${item.unpaid.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="settings-card form settings-form-grid">
        <label htmlFor="referral-search">{c.searchLabel}</label>
        <input id="referral-search" className="input" placeholder={c.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
        <label htmlFor="referral-source-filter">{c.sourceFilter}</label>
        <select id="referral-source-filter" className="input" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="">{c.allSources}</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
        <label htmlFor="referral-status-filter">{c.payoutStatus}</label>
        <select id="referral-status-filter" className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{c.allStatuses}</option>
          <option value="Unpaid">{c.unpaid}</option>
          <option value="Pending">{c.pending}</option>
          <option value="Paid">{c.paid}</option>
        </select>
        <button type="button" className="btn" onClick={() => downloadCsv(filteredRows, payouts, appliedFrom, appliedTo)} disabled={filteredRows.length === 0}>
          {c.exportCsv}
        </button>
      </div>

      {success ? (
        <div className="settings-card">
          <p className="auth-message">{success}</p>
        </div>
      ) : null}
      {loading ? <p className="loading-state">{c.loadingReferrals}</p> : null}
      {error ? (
        <div className="settings-card">
          <p className="auth-message auth-message-error">{error}</p>
        </div>
      ) : null}
      {!loading && !error && filteredRows.length === 0 ? (
        <div className="settings-card">
          <p className="muted">{c.empty}</p>
        </div>
      ) : null}

      {grouped.map(([referrer, signups]) => (
        <section key={referrer} className="settings-card">
          <div className="job-financials-head">
            <div>
              <h3>{referrer}</h3>
              <p className="muted">{signupLabel(signups.length, c)}</p>
            </div>
          </div>
          <div className="finance-list">
            {signups.map((row) => {
              const payout = payouts[row.id] || payoutDraft(row);
              return (
                <div key={row.id} className="finance-list-card">
                  <div>
                    <strong>{row.business_name || row.full_name || row.email || c.signup}</strong>
                    <p className="muted">
                      {row.email || c.noEmail} · {c.signedUp} {formatDate(row.created_at, c.na)}
                    </p>
                  </div>
                  <div className="finance-form-block compact-finance-form" style={{ minWidth: 280 }}>
                    <label>{c.referralSource}</label>
                    <input className="input" value={payout.referralSource} onChange={(e) => updatePayout(row.id, { referralSource: e.target.value })} />
                    <label>{c.referralDetails}</label>
                    <input className="input" value={payout.referralDetail} onChange={(e) => updatePayout(row.id, { referralDetail: e.target.value })} />
                    <label>{c.referredBy}</label>
                    <input className="input" value={payout.referredBy} onChange={(e) => updatePayout(row.id, { referredBy: e.target.value })} />
                    <label>{c.payoutStatus}</label>
                    <select className="input" value={payout.status} onChange={(e) => updatePayout(row.id, { status: e.target.value as PayoutStatus })}>
                      <option value="Unpaid">{statusDisplay('Unpaid', c)}</option>
                      <option value="Pending">{statusDisplay('Pending', c)}</option>
                      <option value="Paid">{statusDisplay('Paid', c)}</option>
                    </select>
                    <label>{c.referralAmount}</label>
                    <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={payout.amount} onChange={(e) => updatePayout(row.id, { amount: e.target.value })} />
                    <label>{c.payoutDate}</label>
                    <input className="input" type="date" value={payout.paidAt} onChange={(e) => updatePayout(row.id, { paidAt: e.target.value })} />
                    <label>{c.notes}</label>
                    <input className="input" placeholder={c.notesPlaceholder} value={payout.notes} onChange={(e) => updatePayout(row.id, { notes: e.target.value })} />
                    <button type="button" className="btn btn-primary" disabled={savingId === row.id} onClick={() => void savePayout(row)}>
                      {savingId === row.id ? c.saving : c.savePayout}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </SettingsShell>
  );
}
