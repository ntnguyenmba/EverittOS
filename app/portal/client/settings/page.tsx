'use client';

import Link from 'next/link';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { useTranslation } from '@/components/locale-provider';
import { PortalAccountSettings } from '@/components/portal/portal-account-settings';
import { CLIENT_HOME_PATH, CLIENT_SETTINGS_PATH } from '@/lib/client-portal';

const COPY = {
  en: {
    portal: 'Customer portal',
    title: 'Account settings',
    description: 'Manage your profile, notifications, legal links, and account deletion.',
    back: 'Back to overview',
    account: 'Account',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    generalDisclaimer: 'General Disclaimer',
    customerDisclaimer: 'Customer Portal Disclaimer'
  },
  es: {
    portal: 'Portal del cliente',
    title: 'Configuración de la cuenta',
    description: 'Administra tu perfil, notificaciones, enlaces legales y eliminación de la cuenta.',
    back: 'Volver al resumen',
    account: 'Cuenta',
    privacy: 'Política de privacidad',
    terms: 'Términos del servicio',
    generalDisclaimer: 'Aviso legal general',
    customerDisclaimer: 'Aviso del portal del cliente'
  },
  vi: {
    portal: 'Cổng thông tin khách hàng',
    title: 'Cài đặt tài khoản',
    description: 'Quản lý hồ sơ, thông báo, liên kết pháp lý và việc xóa tài khoản của bạn.',
    back: 'Quay lại tổng quan',
    account: 'Tài khoản',
    privacy: 'Chính sách quyền riêng tư',
    terms: 'Điều khoản dịch vụ',
    generalDisclaimer: 'Tuyên bố miễn trừ trách nhiệm chung',
    customerDisclaimer: 'Tuyên bố miễn trừ trách nhiệm của cổng khách hàng'
  }
} as const;

export default function ClientPortalSettingsPage() {
  const { locale } = useTranslation();
  const copy = COPY[locale];

  return (
    <AuthenticatedSection role="client">
      <header style={{ marginBottom: 20 }}>
        <p className="muted" style={{ marginBottom: 4 }}>
          {copy.portal}
        </p>
        <h1>{copy.title}</h1>
        <p className="muted">{copy.description}</p>
        <div className="button-row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
          <Link href={CLIENT_HOME_PATH} className="btn">
            {copy.back}
          </Link>
          <Link href={CLIENT_SETTINGS_PATH} className="btn btn-primary" aria-current="page">
            {copy.account}
          </Link>
        </div>
      </header>

      <PortalAccountSettings
        variant="client"
        homeHref={CLIENT_HOME_PATH}
        legalLinks={[
          { href: '/privacy', label: copy.privacy },
          { href: '/terms', label: copy.terms },
          { href: '/disclaimer', label: copy.generalDisclaimer },
          { href: '/disclaimer/customer', label: copy.customerDisclaimer }
        ]}
      />
    </AuthenticatedSection>
  );
}
