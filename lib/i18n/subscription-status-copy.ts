import { normalizeLocale, type Locale } from '@/lib/i18n/config';
import type { StripeSubscriptionStatus } from '@/lib/stripe-subscription';

export type SubscriptionStatusCopy = {
  free: string;
  freeShort: string;
  active: string;
  activeShort: string;
  trialing: string;
  canceled: string;
  canceledShort: string;
  pastDue: string;
  pastDueShort: string;
  unpaid: string;
  unpaidShort: string;
  incomplete: string;
  incompleteExpired: string;
  incompleteExpiredShort: string;
  paused: string;
  pausedShort: string;
  inactive: string;
  inactiveShort: string;
};

const byLocale: Record<Locale, SubscriptionStatusCopy> = {
  en: {
    free: 'You are on the free plan. Upgrade when you need higher limits.',
    freeShort: 'Free plan. Upgrade when you need higher limits.',
    active: 'Your subscription is active.',
    activeShort: 'Subscription active.',
    trialing: 'Your trial is active. Billing starts when the trial ends.',
    canceled: 'Your subscription is canceled. Access continues until the current period ends.',
    canceledShort: 'Subscription canceled. Access continues until the billing period ends.',
    pastDue: 'Payment failed. Update billing details to keep access.',
    unpaid: 'Your subscription is unpaid. Update payment to restore access.',
    incomplete: 'Checkout is incomplete. Finish payment to activate your plan.',
    incompleteExpired: 'Checkout expired. Start a new subscription to continue.',
    paused: 'Your subscription is paused. Resume when you are ready.',
    pausedShort: 'Subscription is paused. Resume from billing settings.',
    inactive: 'Subscription status is unrecognized. Update billing or contact support to restore access.',
    inactiveShort: 'Subscription status is unrecognized. Update billing to restore paid access.',
    pastDueShort: 'Payment failed. Update billing details to keep full access.',
    unpaidShort: 'Subscription is unpaid. Update payment to restore access.',
    incompleteExpiredShort: 'Checkout expired. Start a new subscription from billing settings.'
  },
  es: {
    free: 'Está en el plan gratuito. Actualice cuando necesite límites más altos.',
    freeShort: 'Plan gratuito. Actualice cuando necesite límites más altos.',
    active: 'Su suscripción está activa.',
    activeShort: 'Suscripción activa.',
    trialing: 'Su prueba está activa. La facturación comienza cuando termine la prueba.',
    canceled: 'Su suscripción está cancelada. El acceso continúa hasta el final del período actual.',
    canceledShort: 'Suscripción cancelada. El acceso continúa hasta el final del período de facturación.',
    pastDue: 'El pago falló. Actualice los datos de facturación para mantener el acceso.',
    unpaid: 'Su suscripción no está pagada. Actualice el pago para restaurar el acceso.',
    incomplete: 'El pago no se completó. Termine el pago para activar su plan.',
    incompleteExpired: 'El pago expiró. Inicie una nueva suscripción para continuar.',
    paused: 'Su suscripción está en pausa. Reanude cuando esté listo.',
    pausedShort: 'La suscripción está en pausa. Reanude desde la configuración de facturación.',
    inactive: 'El estado de la suscripción no se reconoce. Actualice la facturación o contacte soporte para restaurar el acceso.',
    inactiveShort: 'El estado de la suscripción no se reconoce. Actualice la facturación para restaurar el acceso de pago.',
    pastDueShort: 'El pago falló. Actualice los datos de facturación para mantener el acceso completo.',
    unpaidShort: 'La suscripción no está pagada. Actualice el pago para restaurar el acceso.',
    incompleteExpiredShort: 'El pago expiró. Inicie una nueva suscripción desde la configuración de facturación.'
  },
  vi: {
    free: 'Bạn đang dùng gói miễn phí. Nâng cấp khi cần hạn mức cao hơn.',
    freeShort: 'Gói miễn phí. Nâng cấp khi cần hạn mức cao hơn.',
    active: 'Gói đăng ký của bạn đang hoạt động.',
    activeShort: 'Gói đăng ký đang hoạt động.',
    trialing: 'Gói dùng thử đang hoạt động. Thanh toán bắt đầu khi hết thời gian dùng thử.',
    canceled: 'Gói đăng ký đã bị hủy. Bạn vẫn dùng được đến hết kỳ hiện tại.',
    canceledShort: 'Gói đăng ký đã hủy. Bạn vẫn dùng được đến hết kỳ thanh toán.',
    pastDue: 'Thanh toán thất bại. Cập nhật thông tin thanh toán để giữ quyền truy cập.',
    unpaid: 'Gói đăng ký chưa được thanh toán. Cập nhật thanh toán để khôi phục quyền truy cập.',
    incomplete: 'Thanh toán chưa hoàn tất. Hoàn tất thanh toán để kích hoạt gói.',
    incompleteExpired: 'Thanh toán đã hết hạn. Bắt đầu gói đăng ký mới để tiếp tục.',
    paused: 'Gói đăng ký đang tạm dừng. Tiếp tục khi bạn sẵn sàng.',
    pausedShort: 'Gói đăng ký đang tạm dừng. Tiếp tục từ cài đặt thanh toán.',
    inactive: 'Không nhận dạng được trạng thái gói đăng ký. Cập nhật thanh toán hoặc liên hệ hỗ trợ để khôi phục.',
    inactiveShort: 'Không nhận dạng được trạng thái gói đăng ký. Cập nhật thanh toán để khôi phục quyền truy cập trả phí.',
    pastDueShort: 'Thanh toán thất bại. Cập nhật thông tin thanh toán để giữ toàn quyền truy cập.',
    unpaidShort: 'Gói đăng ký chưa thanh toán. Cập nhật thanh toán để khôi phục quyền truy cập.',
    incompleteExpiredShort: 'Thanh toán đã hết hạn. Bắt đầu gói đăng ký mới từ cài đặt thanh toán.'
  }
};

export function getSubscriptionStatusCopy(locale?: string | null): SubscriptionStatusCopy {
  return byLocale[normalizeLocale(locale)];
}

export function localizedSubscriptionStatusMessage(
  status: StripeSubscriptionStatus | 'free',
  locale?: string | null,
  variant: 'full' | 'short' = 'full'
): string {
  const copy = getSubscriptionStatusCopy(locale);
  switch (status) {
    case 'free':
      return variant === 'short' ? copy.freeShort : copy.free;
    case 'active':
      return variant === 'short' ? copy.activeShort : copy.active;
    case 'trialing':
      // subscriptionAccess historically showed the active short message for trials.
      return variant === 'short' ? copy.activeShort : copy.trialing;
    case 'canceled':
      return variant === 'short' ? copy.canceledShort : copy.canceled;
    case 'past_due':
      return variant === 'short' ? copy.pastDueShort : copy.pastDue;
    case 'unpaid':
      return variant === 'short' ? copy.unpaidShort : copy.unpaid;
    case 'incomplete':
      return copy.incomplete;
    case 'incomplete_expired':
      return variant === 'short' ? copy.incompleteExpiredShort : copy.incompleteExpired;
    case 'paused':
      return variant === 'short' ? copy.pausedShort : copy.paused;
    case 'inactive':
    default:
      return variant === 'short' ? copy.inactiveShort : copy.inactive;
  }
}
