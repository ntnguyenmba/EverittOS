import { LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY, normalizeLocale, type Locale } from '@/lib/i18n/config';

/** Standard success labels for action feedback toasts. */
export type FeedbackLabelKey =
  | 'saved'
  | 'updated'
  | 'created'
  | 'deleted'
  | 'sent'
  | 'submitted'
  | 'connected'
  | 'disconnected'
  | 'uploadComplete'
  | 'syncComplete'
  | 'copied'
  | 'removed'
  | 'invited'
  | 'paymentRecorded'
  | 'loading';

const LABELS: Record<Locale, Record<FeedbackLabelKey, string>> = {
  en: {
    saved: 'Saved',
    updated: 'Updated',
    created: 'Created',
    deleted: 'Deleted',
    sent: 'Sent',
    submitted: 'Submitted',
    connected: 'Connected',
    disconnected: 'Disconnected',
    uploadComplete: 'Upload complete',
    syncComplete: 'Sync complete',
    copied: 'Copied',
    removed: 'Removed',
    invited: 'Invitation sent',
    paymentRecorded: 'Payment recorded',
    loading: 'Working…'
  },
  es: {
    saved: 'Guardado',
    updated: 'Actualizado',
    created: 'Creado',
    deleted: 'Eliminado',
    sent: 'Enviado',
    submitted: 'Enviado',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    uploadComplete: 'Carga completa',
    syncComplete: 'Sincronización completa',
    copied: 'Copiado',
    removed: 'Eliminado',
    invited: 'Invitación enviada',
    paymentRecorded: 'Pago registrado',
    loading: 'Trabajando…'
  },
  vi: {
    saved: 'Đã lưu',
    updated: 'Đã cập nhật',
    created: 'Đã tạo',
    deleted: 'Đã xóa',
    sent: 'Đã gửi',
    submitted: 'Đã gửi',
    connected: 'Đã kết nối',
    disconnected: 'Đã ngắt kết nối',
    uploadComplete: 'Tải lên hoàn tất',
    syncComplete: 'Đồng bộ hoàn tất',
    copied: 'Đã sao chép',
    removed: 'Đã gỡ',
    invited: 'Đã gửi lời mời',
    paymentRecorded: 'Đã ghi nhận thanh toán',
    loading: 'Đang xử lý…'
  }
};

function readClientLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const fromStorage = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (fromStorage) return normalizeLocale(fromStorage);
    const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]+)`));
    if (match?.[1]) return normalizeLocale(decodeURIComponent(match[1]));
  } catch {
    // ignore storage/cookie access failures
  }
  return 'en';
}

export function getFeedbackLabels(locale?: Locale | string | null): Record<FeedbackLabelKey, string> {
  return LABELS[normalizeLocale(locale || readClientLocale())];
}

/**
 * Locale-aware feedback labels.
 * Prefer `useAppFeedback().feedbackMessage(key)` or `t('feedback.*')` in new code.
 * Existing `FEEDBACK.*` reads follow the active client locale.
 */
export const FEEDBACK: Record<FeedbackLabelKey, string> = new Proxy({} as Record<FeedbackLabelKey, string>, {
  get(_target, prop: string) {
    const labels = getFeedbackLabels();
    if (prop in labels) return labels[prop as FeedbackLabelKey];
    return LABELS.en.loading;
  }
});
