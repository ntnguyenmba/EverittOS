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

const BOOKKEEPING_RANGE_STORAGE_KEY = 'everittos-bookkeeping-range';
const BOOKKEEPING_RANGES: DashboardDateRange[] = ['today', 'week', 'month', 'ytd', 'year', 'all_time'];

const copy = {
  en: {
    title: 'Bookkeeping', subtitle: 'A simple record of money in, business expenses, worker payments, and what is left.', today: 'Today', thisWeek: 'This Week', thisMonth: 'This Month', ytd: 'Year to Date', thisYear: 'This Year', allTime: 'All Time', income: 'Income', expenses: 'Expenses', contractorPay: 'Worker Payments', net: 'Net', incomeReceived: 'Income Received', expensesPaid: 'Expenses Paid', contractorsPaid: 'Worker Payments', empty: 'No records in this period.', loading: 'Loading bookkeeping…', disclaimer: 'For recordkeeping only. EverittOS does not provide tax, accounting, or legal advice. Consult a qualified professional for guidance applicable to your business.'
  },
  es: {
    title: 'Registros financieros', subtitle: 'Un registro simple del dinero recibido, gastos del negocio, pagos a trabajadores y lo que queda.', today: 'Hoy', thisWeek: 'Esta semana', thisMonth: 'Este mes', ytd: 'Año hasta hoy', thisYear: 'Este año', allTime: 'Todo el tiempo', income: 'Ingresos', expenses: 'Gastos', contractorPay: 'Pagos a trabajadores', net: 'Neto', incomeReceived: 'Ingresos recibidos', expensesPaid: 'Gastos pagados', contractorsPaid: 'Pagos a trabajadores', empty: 'No hay registros en este período.', loading: 'Cargando registros…', disclaimer: 'Solo para mantenimiento de registros. EverittOS no brinda asesoramiento fiscal, contable ni legal. Consulte a un profesional calificado para orientación aplicable a su negocio.'
  },
  vi: {
    title: 'Sổ thu chi', subtitle: 'Bản ghi đơn giản về tiền vào, chi phí kinh doanh, tiền trả nhân sự và số còn lại.', today: 'Hôm nay', thisWeek: 'Tuần này', thisMonth: 'Tháng này', ytd: 'Từ đầu năm đến nay', thisYear: 'Năm nay', allTime: 'Tất cả thời gian', income: 'Thu nhập', expenses: 'Chi phí', contractorPay: 'Thanh toán nhân sự', net: 'Còn lại', incomeReceived: 'Thu nhập đã nhận', expensesPaid: 'Chi phí đã trả', contractorsPaid: 'Thanh toán nhân sự', empty: 'Không có bản ghi trong khoảng thời gian này.', loading: 'Đang tải sổ thu chi…', disclaimer: 'Chỉ dùng để lưu hồ sơ. EverittOS không cung cấp tư vấn thuế, kế toán hoặc pháp lý. Hãy tham khảo chuyên gia đủ điều kiện về hướng dẫn phù hợp với doanh nghiệp của bạn.'
  }
} as const;

function TransactionSection({ title, rows, empty, total }: { title: string; rows: DashboardDetailRow[]; empty: string; total: number }) {
  return (
    <details className="bookkeeping-ledger">
      <summary className="bookkeeping-ledger-summary">
        <span>
          <strong>{title}</strong>
          <small className="muted">{rows.length} {rows.length === 1 ? 'record' : 'records'}</small>
        </span>
        <strong className="bookkeeping-ledger-total">{formatCurrency(total)}</strong>
      </summary>
      <div className="bookkeeping-ledger-body">
        {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>{empty}</p> : (
          <div style={{ display: 'grid', gap: 0 }}>
            {rows.map((row, index) => (
              <Link
                key={row.id}
                href={row.href}
                className="bookkeeping-row"
                style={{ borderBottom: index === rows.length - 1 ? '0' : '1px solid var(--border, rgba(0,0,0,.08))' }}
              >
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
