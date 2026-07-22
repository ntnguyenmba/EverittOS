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
    leads: 'Requests',
    archived: 'Archived'
  },
  stages: {
    open: 'New',
    contacted: 'Contacted',
    qualified: 'Interested',
    quoted: 'Quote sent',
    proposal_sent: 'Quote sent',
    negotiation: 'Following up',
    won: 'Converted',
    lost: 'Not booked',
    cancelled: 'Archived',
    canceled: 'Archived',
    archived: 'Archived',
    active: 'Active',
    past: 'Past',
    inactive: 'Inactive',
    former: 'Past customer',
    recurring: 'Recurring',
    reopened: 'Reopened',
    lead: 'Request'
  },
  actions: {
    markPast: 'Mark as past customer',
    markActive: 'Mark active',
    restore: 'Restore',
    archive: 'Archive',
    convertToCustomer: 'Add as customer'
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
    leads: 'Solicitudes',
    archived: 'Archivados'
  },
  stages: {
    open: 'Nueva',
    contacted: 'Contactada',
    qualified: 'Interesada',
    quoted: 'Cotización enviada',
    proposal_sent: 'Cotización enviada',
    negotiation: 'En seguimiento',
    won: 'Convertida',
    lost: 'No reservada',
    cancelled: 'Archivada',
    canceled: 'Archivada',
    archived: 'Archivada',
    active: 'Activo',
    past: 'Anterior',
    inactive: 'Inactivo',
    former: 'Cliente anterior',
    recurring: 'Recurrente',
    reopened: 'Reabierta',
    lead: 'Solicitud'
  },
  actions: {
    markPast: 'Marcar como cliente anterior',
    markActive: 'Marcar activo',
    restore: 'Restaurar',
    archive: 'Archivar',
    convertToCustomer: 'Agregar como cliente'
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
    leads: 'Yêu cầu',
    archived: 'Đã lưu trữ'
  },
  stages: {
    open: 'Mới',
    contacted: 'Đã liên hệ',
    qualified: 'Quan tâm',
    quoted: 'Đã gửi báo giá',
    proposal_sent: 'Đã gửi báo giá',
    negotiation: 'Đang theo dõi',
    won: 'Đã chuyển đổi',
    lost: 'Không đặt dịch vụ',
    cancelled: 'Đã lưu trữ',
    canceled: 'Đã lưu trữ',
    archived: 'Đã lưu trữ',
    active: 'Đang hoạt động',
    past: 'Trước đây',
    inactive: 'Không hoạt động',
    former: 'Khách hàng cũ',
    recurring: 'Định kỳ',
    reopened: 'Đã mở lại',
    lead: 'Yêu cầu'
  },
  actions: {
    markPast: 'Đánh dấu khách hàng cũ',
    markActive: 'Đánh dấu đang hoạt động',
    restore: 'Khôi phục',
    archive: 'Lưu trữ',
    convertToCustomer: 'Thêm làm khách hàng'
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
