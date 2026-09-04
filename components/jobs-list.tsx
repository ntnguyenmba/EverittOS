'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ExportMenu } from '@/components/export-menu';
import { useTranslation } from '@/components/locale-provider';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { canAccessFinancials } from '@/lib/finance-access';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import { formatMoneyUsd } from '@/lib/i18n/locale-format';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { displayPersonName } from '@/lib/exports/format';
import type { JobBillingStatus } from '@/lib/jobs/billing-status';
import { isAdminRole, isClientRole, isContractorRole, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { contractorJobDetailPath } from '@/lib/contractor-job-access';
import { clientPortalJobsPath } from '@/lib/portal-access';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { supabase } from '@/lib/supabase';
import { sortJobs, type JobListSortMode } from '@/lib/jobs-list-sort';
import { normalizeJobStatus } from '@/lib/worker-assignment';

const JOBS_PAGE_SIZE = 10;

const copy = {
  en: {
    newJob: 'New job', subtitle: 'Create jobs, assign workers, and track schedule and pay.', all: 'All', today: 'Today', active: 'Active', finished: 'Finished', needsWorker: 'Needs worker', filtered: 'Filtered', showAll: 'Show all', missingFinish: 'Finished jobs missing a finish date.', loading: 'Loading…', unableLoad: 'Unable to load jobs.', removeConfirm: 'Remove job "{title}"?', unableRemove: 'Unable to remove job.', noCustomer: 'No customer', maps: 'Maps', more: 'More', removing: 'Removing…', remove: 'Remove', bookAgain: 'Book again', creating: 'Creating…', date: 'Date', address: 'Address', assignedTo: 'Assigned to', customerPay: 'Customer Pay', contractorPay: 'Contractor Pay', ownerProfit: 'Owner Profit', status: 'Status', actions: 'Actions', openJob: 'Open job', unscheduled: 'Unscheduled', unassigned: 'Unassigned', sortBy: 'Sort', sortByAssigned: 'Assigned worker', filters: 'Filter jobs', moreFilters: 'More filters', worker: 'Worker', allWorkers: 'All workers', client: 'Client', allClients: 'All clients', property: 'Property', allProperties: 'All properties', month: 'Month', allMonths: 'All months', year: 'Year', allYears: 'All years', clearFilters: 'Clear filters', showMore: 'Show 10 more', showing: 'Showing {visible} of {total}'
  },
  es: {
    newJob: 'Nuevo trabajo', subtitle: 'Cree trabajos, asigne personal y siga el horario y los pagos.', all: 'Todos', today: 'Hoy', active: 'Activos', finished: 'Finalizados', needsWorker: 'Necesita trabajador', filtered: 'Filtrado', showAll: 'Mostrar todos', missingFinish: 'Trabajos finalizados sin fecha de finalización.', loading: 'Cargando…', unableLoad: 'No se pudieron cargar los trabajos.', removeConfirm: '¿Eliminar el trabajo "{title}"?', unableRemove: 'No se pudo eliminar el trabajo.', noCustomer: 'Sin cliente', maps: 'Mapas', more: 'Más', removing: 'Eliminando…', remove: 'Eliminar', bookAgain: 'Reservar de nuevo', creating: 'Creando…', date: 'Fecha', address: 'Dirección', assignedTo: 'Asignado a', customerPay: 'Pago del cliente', contractorPay: 'Pago al contratista', ownerProfit: 'Ganancia del propietario', status: 'Estado', actions: 'Acciones', openJob: 'Abrir trabajo', unscheduled: 'Sin programar', unassigned: 'Sin asignar', sortBy: 'Ordenar', sortByAssigned: 'Trabajador asignado', filters: 'Filtrar trabajos', moreFilters: 'Más filtros', worker: 'Trabajador', allWorkers: 'Todos los trabajadores', client: 'Cliente', allClients: 'Todos los clientes', property: 'Propiedad', allProperties: 'Todas las propiedades', month: 'Mes', allMonths: 'Todos los meses', year: 'Año', allYears: 'Todos los años', clearFilters: 'Borrar filtros', showMore: 'Mostrar 10 más', showing: 'Mostrando {visible} de {total}'
  },
  vi: {
    newJob: 'Công việc mới', subtitle: 'Tạo việc, giao nhân sự và theo dõi lịch cùng thanh toán.', all: 'Tất cả', today: 'Hôm nay', active: 'Đang hoạt động', finished: 'Đã hoàn thành', needsWorker: 'Cần nhân sự', filtered: 'Đã lọc', showAll: 'Hiển thị tất cả', missingFinish: 'Công việc đã hoàn thành nhưng thiếu ngày hoàn tất.', loading: 'Đang tải…', unableLoad: 'Không thể tải công việc.', removeConfirm: 'Xóa công việc "{title}"?', unableRemove: 'Không thể xóa công việc.', noCustomer: 'Không có khách hàng', maps: 'Bản đồ', more: 'Thêm', removing: 'Đang xóa…', remove: 'Xóa', bookAgain: 'Đặt lại', creating: 'Đang tạo…', date: 'Ngày', address: 'Địa chỉ', assignedTo: 'Phân công', customerPay: 'Khách trả', contractorPay: 'Trả nhà thầu', ownerProfit: 'Lợi nhuận chủ', status: 'Trạng thái', actions: 'Thao tác', openJob: 'Mở công việc', unscheduled: 'Chưa lên lịch', unassigned: 'Chưa phân công', sortBy: 'Sắp xếp', sortByAssigned: 'Nhân sự được giao', filters: 'Lọc công việc', moreFilters: 'Bộ lọc khác', worker: 'Nhân sự', allWorkers: 'Tất cả nhân sự', client: 'Khách hàng', allClients: 'Tất cả khách hàng', property: 'Địa điểm', allProperties: 'Tất cả địa điểm', month: 'Tháng', allMonths: 'Tất cả tháng', year: 'Năm', allYears: 'Tất cả năm', clearFilters: 'Xóa bộ lọc', showMore: 'Hiển thị thêm 10', showing: 'Đang hiển thị {visible} trên {total}'
  }
} as const;
