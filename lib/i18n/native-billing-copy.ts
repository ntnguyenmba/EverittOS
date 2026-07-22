import { normalizeLocale, type Locale } from '@/lib/i18n/config';

export type NativeBillingCopy = {
  appleNotice: string;
  googleNotice: string;
  webNotice: string;
  manageApple: string;
  manageGoogle: string;
  manageStripe: string;
  manageGeneric: string;
};

const byLocale: Record<Locale, NativeBillingCopy> = {
  en: {
    appleNotice: 'Subscriptions are purchased through Apple. Prices shown are provided by the App Store.',
    googleNotice: 'Subscriptions are purchased through Google Play. Prices shown are provided by Google Play.',
    webNotice: 'Subscription changes are managed on the web for Stripe-billed accounts.',
    manageApple: 'Manage Apple Subscription',
    manageGoogle: 'Manage Google Play Subscription',
    manageStripe: 'Manage Stripe Billing',
    manageGeneric: 'Manage Subscription'
  },
  es: {
    appleNotice: 'Las suscripciones se compran a través de Apple. Los precios los muestra la App Store.',
    googleNotice: 'Las suscripciones se compran a través de Google Play. Los precios los muestra Google Play.',
    webNotice: 'Los cambios de suscripción se gestionan en la web para cuentas facturadas con Stripe.',
    manageApple: 'Administrar suscripción de Apple',
    manageGoogle: 'Administrar suscripción de Google Play',
    manageStripe: 'Administrar facturación de Stripe',
    manageGeneric: 'Administrar suscripción'
  },
  vi: {
    appleNotice: 'Gói đăng ký được mua qua Apple. Giá hiển thị do App Store cung cấp.',
    googleNotice: 'Gói đăng ký được mua qua Google Play. Giá hiển thị do Google Play cung cấp.',
    webNotice: 'Thay đổi gói đăng ký được quản lý trên web đối với tài khoản thanh toán qua Stripe.',
    manageApple: 'Quản lý đăng ký Apple',
    manageGoogle: 'Quản lý đăng ký Google Play',
    manageStripe: 'Quản lý thanh toán Stripe',
    manageGeneric: 'Quản lý đăng ký'
  }
};

export function getNativeBillingCopy(locale?: string | null): NativeBillingCopy {
  return byLocale[normalizeLocale(locale)];
}
