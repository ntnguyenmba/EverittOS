import { normalizeLocale, type Locale } from '@/lib/i18n/config';

export type CustomerLifecycleCopy = {
  filters: {
    all: string;
    active: string;
    past: string;
    leads: string;
    customers: string;
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
    all: 'Customers',
    active: 'Active',
    past: 'Past',
    leads: 'Leads',
    customers: 'Customers',
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
    lead: 'Request',
    customer: 'Customer'
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
    all: 'Clientes',
    active: 'Activos',
    past: 'Anteriores',
    leads: 'Prospectos',
    customers: 'Clientes',
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
    lead: 'Solicitud',
    customer: 'Cliente'
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
    all: 'Khách hàng',
    active: 'Đang hoạt động',
    past: 'Trước đây',
    leads: 'Tiềm năng',
    customers: 'Khách hàng',
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
    lead: 'Yêu cầu',
    customer: 'Khách hàng'
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
