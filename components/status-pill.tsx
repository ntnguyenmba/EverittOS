'use client';

import { useTranslation } from '@/components/locale-provider';

const statusLabels = {
  en: {
    new: 'New',
    active: 'Active',
    scheduled: 'Scheduled',
    in_progress: 'In progress',
    completed: 'Completed',
    finished: 'Finished',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    pending: 'Pending',
    paid: 'Paid',
    unpaid: 'Unpaid',
    overdue: 'Overdue'
  },
  es: {
    new: 'Nuevo',
    active: 'Activo',
    scheduled: 'Programado',
    in_progress: 'En progreso',
    completed: 'Completado',
    finished: 'Finalizado',
    cancelled: 'Cancelado',
    canceled: 'Cancelado',
    pending: 'Pendiente',
    paid: 'Pagado',
    unpaid: 'No pagado',
    overdue: 'Vencido'
  },
  vi: {
    new: 'Mới',
    active: 'Đang hoạt động',
    scheduled: 'Đã lên lịch',
    in_progress: 'Đang thực hiện',
    completed: 'Đã hoàn thành',
    finished: 'Hoàn tất',
    cancelled: 'Đã hủy',
    canceled: 'Đã hủy',
    pending: 'Đang chờ',
    paid: 'Đã thanh toán',
    unpaid: 'Chưa thanh toán',
    overdue: 'Quá hạn'
  }
} as const;

export function StatusPill({ status }: { status?: string | null }) {
  const { locale } = useTranslation();
  const raw = String(status || 'new');
  const normalized = raw.toLowerCase().trim().replaceAll(' ', '_').replaceAll('-', '_');
  const clean = normalized.replaceAll('_', '-');
  const labels = statusLabels[locale] as Record<string, string>;
  const label = labels[normalized] || raw;
  return <span className={'status ' + clean}>{label}</span>;
}
