'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { useTranslation } from '@/components/locale-provider';
import { fetchDashboardMetricDetails, type DashboardDetailResult, type DashboardDetailRow } from '@/lib/dashboard-metric-details';
import { formatCurrency, type DashboardDateRange } from '@/lib/dashboard-metrics';
import { canAccessFinancials } from '@/lib/finance-access';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isAdminRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

const copy = {
  en: {
    title: 'Bookkeeping',
    subtitle: 'A simple record of money in, business expenses, contractor payments, and what is left.',
    thisYear: 'This Year',
    allTime: 'All Time',
    income: 'Income',
    expenses: 'Expenses',
    contractorPay: 'Contractor Payments',
    net: 'Net',
    incomeReceived: 'Income Received',
    expensesPaid: 'Expenses Paid',
    contractorsPaid: 'Contractor Payments',
    empty: 'No records in this period.',
    loading: 'Loading bookkeeping…',
    disclaimer: 'For recordkeeping only. EverittOS does not provide tax, accounting, or legal advice. Consult a qualified professional for guidance applicable to your business.'
  },
  es: {
    title: 'Registros financieros',
    subtitle: 'Un registro simple del dinero recibido, gastos del negocio, pagos a contratistas y lo que queda.',
    thisYear: 'Este año',
    allTime: 'Todo el tiempo',
    income: 'Ingresos',
    expenses: 'Gastos',
    contractorPay: 'Pagos a contratistas',
    net: 'Neto',
    incomeReceived: 'Ingresos recibidos',
    expensesPaid: 'Gastos pagados',
    contractorsPaid: 'Pagos a contratistas',
    empty: 'No hay registros en este período.',
    loading: 'Cargando registros…',
    disclaimer: 'Solo para mantenimiento de registros. EverittOS no brinda asesoramiento fiscal, contable ni legal. Consulte a un profesional calificado para orientación aplicable a su negocio.'
  },
  vi: {
    title: 'Sổ thu chi',
    subtitle: 'Bản ghi đơn giản về tiền vào, chi phí kinh doanh, tiền trả nhà thầu và số còn lại.',
    thisYear: 'Năm nay',
    allTime: 'Tất cả thời gian',
    income: 'Thu nhập',
    expenses: 'Chi phí',
    contractorPay: 'Thanh toán nhà thầu',
    net: 'Còn lại',
    incomeReceived: 'Thu nhập đã nhận',
    expensesPaid: 'Chi phí đã trả',
    contractorsPaid: 'Thanh toán nhà thầu',
    empty: 'Không có bản ghi trong khoảng thời gian này.',
    loading: 'Đang tải sổ thu chi…',
    disclaimer: 'Chỉ dùng để lưu hồ sơ. EverittOS không cung cấp tư vấn thuế, kế toán hoặc pháp lý. Hãy tham khảo chuyên gia đủ điều kiện về hướng dẫn phù hợp với doanh nghiệp của bạn.'
  }
} as const;

function TransactionSection({ title, rows, empty }: { title: string; rows: DashboardDetailRow[]; empty: string }) {
  return (
    <section className="card" style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {rows.length === 0 ? <p className="muted" style={{ marginBottom: 0 }}>{empty}</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <Link key={row.id} href={row.href} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 16, alignItems: 'start', textDecoration: 'none', padding: '12px 0', borderBottom: '1px solid var(--border, rgba(0,0,0,.08))' }}>
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: 'block' }}>{row.title}</strong>
                {row.subtitle ? <small className="muted" style={{ display: 'block', marginTop: 4 }}>{row.subtitle}</small> : null}
              </span>
              <strong>{row.amountLabel || formatCurrency(row.amount || 0)}</strong>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default function BookkeepingPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const c = copy[locale];
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [range, setRange] = useState<DashboardDateRange>('year');
  const [collected, setCollected] = useState<DashboardDetailResult | null>(null);
  const [netCash, setNetCash] = useState<DashboardDetailResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        router.replace('/login?next=/bookkeeping');
        return;
      }

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

      if (!cancelled) {
        setPlan(nextPlan);
        setRole(nextRole);
      }

      const [incomeResult, netCashResult] = await Promise.all([
        fetchDashboardMetricDetails(supabase, org.organizationId, 'collected', range, locale),
        fetchDashboardMetricDetails(supabase, org.organizationId, 'net-cash', range, locale)
      ]);

      if (!cancelled) {
        setCollected(incomeResult);
        setNetCash(netCashResult);
        setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [locale, range, router]);

  const incomeRows = useMemo(() => collected?.sections.flatMap((section) => section.rows) || [], [collected]);
  const contractorSection = netCash?.sections.find((section) => section.id === 'contractor-paid');
  const expenseSection = netCash?.sections.find((section) => section.id === 'expenses');
  const netSection = netCash?.sections.find((section) => section.id === 'net');

  const incomeTotal = collected?.total || 0;
  const contractorTotal = contractorSection?.total || 0;
  const expenseTotal = expenseSection?.total || 0;
  const netTotal = netSection?.total ?? netCash?.total ?? incomeTotal - contractorTotal - expenseTotal;

  return (
    <AppShell plan={plan} role={role}>
      <div className="today-page">
        <PageHeader title={c.title} subtitle={c.subtitle} />

        <div className="inline-actions" style={{ marginBottom: 18, gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className={range === 'year' ? 'btn btn-primary' : 'btn'} onClick={() => setRange('year')}>{c.thisYear}</button>
          <button type="button" className={range === 'all_time' ? 'btn btn-primary' : 'btn'} onClick={() => setRange('all_time')}>{c.allTime}</button>
        </div>

        {loading ? <p className="muted">{c.loading}</p> : (
          <>
            <section className="dashboard-revenue-grid" style={{ marginBottom: 20 }}>
              <div className="dashboard-revenue-metric is-primary" style={{ minHeight: 110 }}>
                <span className="dashboard-revenue-metric-label">{c.income}</span>
                <strong className="dashboard-revenue-metric-value">{formatCurrency(incomeTotal)}</strong>
              </div>
              <div className="dashboard-revenue-metric is-primary" style={{ minHeight: 110 }}>
                <span className="dashboard-revenue-metric-label">{c.expenses}</span>
                <strong className="dashboard-revenue-metric-value">{formatCurrency(expenseTotal)}</strong>
              </div>
              <div className="dashboard-revenue-metric is-primary" style={{ minHeight: 110 }}>
                <span className="dashboard-revenue-metric-label">{c.contractorPay}</span>
                <strong className="dashboard-revenue-metric-value">{formatCurrency(contractorTotal)}</strong>
              </div>
              <div className="dashboard-revenue-metric is-primary" style={{ minHeight: 110 }}>
                <span className="dashboard-revenue-metric-label">{c.net}</span>
                <strong className="dashboard-revenue-metric-value">{formatCurrency(netTotal)}</strong>
              </div>
            </section>

            <div style={{ display: 'grid', gap: 18 }}>
              <TransactionSection title={c.incomeReceived} rows={incomeRows} empty={c.empty} />
              <TransactionSection title={c.contractorsPaid} rows={contractorSection?.rows || []} empty={c.empty} />
              <TransactionSection title={c.expensesPaid} rows={expenseSection?.rows || []} empty={c.empty} />
            </div>

            <p className="muted" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 18, maxWidth: 760 }}>{c.disclaimer}</p>
          </>
        )}
      </div>
    </AppShell>
  );
}
