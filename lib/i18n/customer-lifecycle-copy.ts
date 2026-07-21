import { normalizeLocale, type Locale } from '@/lib/i18n/config';

export type CustomerLifecycleCopy = {
  filters: {
    all: string;
    active: string;
    past: string;
    leads: string;
    archived: string;
  };
  stages: Record<string, string>;
  actions: {
    markPast: string;
    markActive: string;
    restore: string;
    archive: string;
    convertToCustomer: string;
  };
  messages: {
    markedPast: string;
    markedActive: string;
    restored: string;
    unableToUpdate: string;
  };
};

const en: CustomerLifecycleCopy = {
  filters: {
    all: 'All',
    active: 'Active',
    past: 'Past',
    leads: 'Leads',
    archived: 'Archived'
  },
  stages: {
    open: 'Open',
    contacted: 'Contacted',
    qualified: 'Qualified',
    quoted: 'Quoted',
    won: 'Won',
    lost: 'Lost',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    archived: 'Archived',
    active: 'Active',
    past: 'Past',
    inactive: 'Inactive',
    former: 'Former customer',
    recurring: 'Recurring',
    reopened: 'Reopened',
    lead: 'Lead'
  },
  actions: {
    markPast: 'Mark as past customer',
    markActive: 'Mark active',
    restore: 'Restore',
    archive: 'Archive',
    convertToCustomer: 'Convert to customer'
  },
  messages: {
    markedPast: 'Customer marked as past.',
    markedActive: 'Customer marked active.',
    restored: 'Customer restored.',
    unableToUpdate: 'Unable to update customer status.'
  }
};

const es: CustomerLifecycleCopy = {
  filters: {
    all: 'Todos',
    active: 'Activos',
    past: 'Anteriores',
    leads: 'Leads',
    archived: 'Archivados'
  },
  stages: {
    open: 'Abierto',
    contacted: 'Contactado',
    qualified: 'Calificado',
    quoted: 'Cotizado',
    won: 'Ganado',
    lost: 'Perdido',
    cancelled: 'Cancelado',
    canceled: 'Cancelado',
    archived: 'Archivado',
    active: 'Activo',
    past: 'Anterior',
    inactive: 'Inactivo',
    former: 'Cliente anterior',
    recurring: 'Recurrente',
    reopened: 'Reabierto',
    lead: 'Lead'
  },
  actions: {
    markPast: 'Marcar como cliente anterior',
    markActive: 'Marcar activo',
    restore: 'Restaurar',
    archive: 'Archivar',
    convertToCustomer: 'Convertir en cliente'
  },
  messages: {
    markedPast: 'Cliente marcado como anterior.',
    markedActive: 'Cliente marcado como activo.',
    restored: 'Cliente restaurado.',
    unableToUpdate: 'No se pudo actualizar el estado del cliente.'
  }
};

const vi: CustomerLifecycleCopy = {
  filters: {
    all: 'Tất cả',
    active: 'Đang hoạt động',
    past: 'Trước đây',
    leads: 'Lead',
    archived: 'Đã lưu trữ'
  },
  stages: {
    open: 'Mở',
    contacted: 'Đã liên hệ',
    qualified: 'Đủ điều kiện',
    quoted: 'Đã báo giá',
    won: 'Thành công',
    lost: 'Thất bại',
    cancelled: 'Đã hủy',
    canceled: 'Đã hủy',
    archived: 'Đã lưu trữ',
    active: 'Đang hoạt động',
    past: 'Trước đây',
    inactive: 'Không hoạt động',
    former: 'Khách hàng cũ',
    recurring: 'Định kỳ',
    reopened: 'Đã mở lại',
    lead: 'Lead'
  },
  actions: {
    markPast: 'Đánh dấu khách hàng cũ',
    markActive: 'Đánh dấu đang hoạt động',
    restore: 'Khôi phục',
    archive: 'Lưu trữ',
    convertToCustomer: 'Chuyển thành khách hàng'
  },
  messages: {
    markedPast: 'Đã đánh dấu khách hàng cũ.',
    markedActive: 'Đã đánh dấu khách hàng đang hoạt động.',
    restored: 'Đã khôi phục khách hàng.',
    unableToUpdate: 'Không cập nhật được trạng thái khách hàng.'
  }
};

const byLocale: Record<Locale, CustomerLifecycleCopy> = { en, es, vi };

export function getCustomerLifecycleCopy(locale: string | null | undefined): CustomerLifecycleCopy {
  return byLocale[normalizeLocale(locale)];
}

export function customerStageLabel(stage: string | null | undefined, locale: string | null | undefined): string {
  const copy = getCustomerLifecycleCopy(locale);
  const key = String(stage || 'active').toLowerCase();
  return copy.stages[key] || key.replace(/_/g, ' ');
}
