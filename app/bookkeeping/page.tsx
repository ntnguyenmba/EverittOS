'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ExportMenu } from '@/components/export-menu';
import { PageHeader } from '@/components/page-header';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { fetchDashboardMetricDetails, type DashboardDetailResult, type DashboardDetailRow } from '@/lib/dashboard-metric-details';
import { formatCurrency, type DashboardDateRange } from '@/lib/dashboard-metrics';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { canAccessFinancials } from '@/lib/finance-access';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isAdminRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import '../bookkeeping.css';

const BOOKKEEPING_RANGE_STORAGE_KEY = 'everittos-bookkeeping-range';
const BOOKKEEPING_RANGES: DashboardDateRange[] = ['today', 'week', 'month', 'ytd', 'all_time'];

const copy = {
  en: { title: 'Bookkeeping', subtitle: 'A simple record of money in, business expenses, worker payments, and what is left.', today: 'Today', thisWeek: 'This Week', thisMonth: 'This Month', ytd: 'Year to Date', allTime: 'All Time', income: 'Income', expenses: 'Expenses', contractorPay: 'Worker Payments', net: 'Net', incomeReceived: 'Income Received', expensesPaid: 'Expenses Paid', contractorsPaid: 'Worker Payments', empty: 'No records in this period.', loading: 'Loading bookkeeping…', disclaimer: 'For recordkeeping only. EverittOS does not provide tax, accounting, or legal advice. Consult a qualified professional for guidance applicable to your business.' },
  es: { title: 'Registros financieros', subtitle: 'Un registro simple del dinero recibido, gastos del negocio, pagos a trabajadores y lo que queda.', today: 'Hoy', thisWeek: 'Esta semana', thisMonth: 'Este mes', ytd: 'Año hasta hoy', allTime: 'Todo el tiempo', income: 'Ingresos', expenses: 'Gastos', contractorPay: 'Pagos a trabajadores', net: 'Neto', incomeReceived: 'Ingresos recibidos', expensesPaid: 'Gastos pagados', contractorsPaid: 'Pagos a trabajadores', empty: 'No hay registros en este período.', loading: 'Cargando registros…', disclaimer: 'Solo para mantenimiento de registros. EverittOS no brinda asesoramiento fiscal, contable ni legal. Consulte a un profesional calificado para orientación aplicable a su negocio.' },
  vi: { title: 'Sổ thu chi', subtitle: 'Bản ghi đơn giản về tiền vào, chi phí kinh doanh, tiền trả nhân sự và số còn lại.', today: 'Hôm nay', thisWeek: 'Tuần này', thisMonth: 'Tháng này', ytd: 'Từ đầu năm đến nay', allTime: 'Tất cả thời gian', income: 'Thu nhập', expenses: 'Chi phí', contractorPay: 'Thanh toán nhân sự', net: 'Còn lại', incomeReceived: 'Thu nhập đã nhận', expensesPaid: 'Chi phí đã trả', contractorsPaid: 'Thanh toán nhân sự', empty: 'Không có bản ghi trong khoảng thời gian này.', loading: 'Đang tải sổ thu chi…', disclaimer: 'Chỉ dùng để lưu hồ sơ. EverittOS không cung cấp tư vấn thuế, kế toán hoặc pháp lý. Hãy tham khảo chuyên gia đủ điều kiện về hướng dẫn phù hợp với doanh nghiệp của bạn.' }
} as const;

function TransactionSection({ title, rows, empty, total }: { title: string; rows: DashboardDetailRow[]; empty: string; total: number }) {
  return (
    <details className="bookkeeping-ledger">
      <summary className="bookkeeping-ledger-summary">
        <span><strong>{title}</strong><small className="muted">{rows.length} {rows.length === 1 ? 'record' : 'records'}</small></span>
        <strong className="bookkeeping-ledger-total">{formatCurrency(total)}</strong>
      </summary>
      <div className="bookkeeping-ledger-body">
        {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>{empty}</p> : (
          <div style={{ display: 'grid', gap: 0 }}>
            {rows.map((row, index) => (
              <Link key={row.id} href={row.href} className="bookkeeping-row" style={{ borderBottom: index === rows.length - 1 ? '0' : '1px solid var(--border, rgba(0,0,0,.08))' }}>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', overflowWrap: 'anywhere', lineHeight: 1.32 }}>{row.title}</strong>
                  {row.subtitle ? <small className="muted" style={{ display: 'block', marginTop: 4, overflowWrap: 'anywhere', lineHeight: 1.4 }}>{row.subtitle}</small> : null}
                </span>
                <strong className="bookkeeping-row-amount">{row.amountLabel || formatCurrency(row.amount || 0)}</strong>
              </Link>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

export default function BookkeepingPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const c = copy[locale];
  const exportCopy = getExportCopy(locale);
  const appFeedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [range, setRange] = useState<DashboardDateRange>('month');
  const [rangeReady, setRangeReady] = useState(false);
  const [collected, setCollected] = useState<DashboardDetailResult | null>(null);
  const [netCash, setNetCash] = useState<DashboardDetailResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(BOOKKEEPING_RANGE_STORAGE_KEY) as DashboardDateRange | null;
    if (saved === 'year') setRange('ytd');
    else if (saved && BOOKKEEPING_RANGES.includes(saved)) setRange(saved);
    setRangeReady(true);
  }, []);

  useEffect(() => {
    if (!rangeReady) return;
    window.localStorage.setItem(BOOKKEEPING_RANGE_STORAGE_KEY, range);
  }, [range, rangeReady]);

  useEffect(() => {
    if (!rangeReady) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) { router.replace('/login?next=/bookkeeping'); return; }
      const [{ data: profile }, org] = await Promise.all([
        supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
        fetchOrganizationContext(user.id)
      ]);
      const nextPlan = normalizePlan(profile?.plan);
      const nextRole = normalizeRole(org?.role || profile?.role);
      if (!isAdminRole(nextRole) || !canAccessFinancials(nextRole, nextPlan) || !org?.organizationId) {
        router.replace('/dashboard?reason=financial_access_required');
        return;
      }
      if (!cancelled) { setPlan(nextPlan); setRole(nextRole); }
      const [incomeResult, netCashResult] = await Promise.all([
        fetchDashboardMetricDetails(supabase, org.organizationId, 'collected', range, locale),
        fetchDashboardMetricDetails(supabase, org.organizationId, 'net-cash', range, locale)
      ]);
      if (!cancelled) { setCollected(incomeResult); setNetCash(netCashResult); setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [locale, range, rangeReady, router]);

  const incomeRows = useMemo(() => collected?.sections.flatMap((section) => section.rows) || [], [collected]);
  const contractorSection = netCash?.sections.find((section) => section.id === 'contractor-paid');
  const expenseSection = netCash?.sections.find((section) => section.id === 'expenses');
  const netSection = netCash?.sections.find((section) => section.id === 'net');
  const incomeTotal = collected?.total || 0;
  const contractorTotal = contractorSection?.total || 0;
  const expenseTotal = expenseSection?.total || 0;
  const netTotal = netSection?.total ?? netCash?.total ?? incomeTotal - contractorTotal - expenseTotal;

  const metrics = [[c.income, incomeTotal], [c.expenses, expenseTotal], [c.contractorPay, contractorTotal], [c.net, netTotal]] as const;
  const rangeOptions: Array<{ id: DashboardDateRange; label: string }> = [
    { id: 'today', label: c.today }, { id: 'week', label: c.thisWeek }, { id: 'month', label: c.thisMonth },
    { id: 'ytd', label: c.ytd }, { id: 'all_time', label: c.allTime }
  ];

  return (
    <AppShell plan={plan} role={role}>
      <main className="bookkeeping-page">
        <div style={{ marginBottom: 14 }}>
          <PageHeader title={c.title} subtitle={c.subtitle} action={<ExportMenu endpoint="/api/exports/bookkeeping" query={{ range }} locale={locale} disabled={loading} onError={(message) => appFeedback.error(message || exportCopy.exportFailed)} onSuccess={(format) => { if (format === 'share') appFeedback.success(exportCopy.shareSent); }} />} />
        </div>
        <div className="bookkeeping-range-bar" role="group" aria-label="Bookkeeping period">
          {rangeOptions.map((option) => (
            <button key={option.id} type="button" className={range === option.id ? 'bookkeeping-range is-active' : 'bookkeeping-range'} aria-pressed={range === option.id} disabled={loading && range === option.id} onClick={() => setRange(option.id)}>{option.label}</button>
          ))}
        </div>
        {loading ? <p className="muted" style={{ padding: '10px 2px 30px' }}>{c.loading}</p> : (
          <div style={{ width: '100%', minWidth: 0 }}>
            <section className="bookkeeping-metrics" aria-label="Bookkeeping totals">
              {metrics.map(([label, value]) => <div key={label} className="bookkeeping-metric-card"><span className="bookkeeping-metric-label">{label}</span><strong className="bookkeeping-metric-value">{formatCurrency(value)}</strong></div>)}
            </section>
            <div className="bookkeeping-ledgers">
              <TransactionSection title={c.incomeReceived} rows={incomeRows} empty={c.empty} total={incomeTotal} />
              <TransactionSection title={c.contractorsPaid} rows={contractorSection?.rows || []} empty={c.empty} total={contractorTotal} />
              <TransactionSection title={c.expensesPaid} rows={expenseSection?.rows || []} empty={c.empty} total={expenseTotal} />
            </div>
            <div className="bookkeeping-disclaimer"><p className="muted">{c.disclaimer}</p></div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
