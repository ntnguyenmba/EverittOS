'use client';

import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { useTranslation } from '@/components/locale-provider';
import { SUPPORT_EMAIL, supportMailtoHref } from '@/lib/support';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || '1.0.0';
const BUILD_NUMBER = process.env.NEXT_PUBLIC_BUILD_NUMBER || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || '';

const copy = {
  en: {
    title: 'About EverittOS',
    subtitle: 'Business operations software built from real work.',
    appInfo: 'App information',
    version: 'Version',
    support: 'Support',
    supportBody: 'Need help with your account, billing, access, or app features? Email',
    legalPrivacy: 'Legal and privacy',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    cookies: 'Cookie Policy',
    security: 'Security',
    accountDeletion: 'Account deletion',
    subscription: 'Subscription and purchases',
    thirdParty: 'Third-party notices',
    company: 'Company',
    companyBody: 'EverittOS is provided by Everitt Ventures. Product information is available at',
    back: 'Back to settings'
  },
  es: {
    title: 'Acerca de EverittOS',
    subtitle: 'Software de operaciones empresariales creado a partir del trabajo real.',
    appInfo: 'Información de la aplicación',
    version: 'Versión',
    support: 'Soporte',
    supportBody: '¿Necesita ayuda con su cuenta, facturación, acceso o funciones de la aplicación? Escriba a',
    legalPrivacy: 'Legal y privacidad',
    privacy: 'Política de privacidad',
    terms: 'Términos de servicio',
    cookies: 'Política de cookies',
    security: 'Seguridad',
    accountDeletion: 'Eliminación de cuenta',
    subscription: 'Suscripción y compras',
    thirdParty: 'Avisos de terceros',
    company: 'Empresa',
    companyBody: 'EverittOS es proporcionado por Everitt Ventures. La información del producto está disponible en',
    back: 'Volver a configuración'
  },
  vi: {
    title: 'Giới thiệu EverittOS',
    subtitle: 'Phần mềm vận hành doanh nghiệp được xây dựng từ công việc thực tế.',
    appInfo: 'Thông tin ứng dụng',
    version: 'Phiên bản',
    support: 'Hỗ trợ',
    supportBody: 'Cần trợ giúp về tài khoản, thanh toán, quyền truy cập hoặc tính năng ứng dụng? Gửi email tới',
    legalPrivacy: 'Pháp lý và quyền riêng tư',
    privacy: 'Chính sách quyền riêng tư',
    terms: 'Điều khoản dịch vụ',
    cookies: 'Chính sách cookie',
    security: 'Bảo mật',
    accountDeletion: 'Xóa tài khoản',
    subscription: 'Đăng ký và mua hàng',
    thirdParty: 'Thông báo bên thứ ba',
    company: 'Công ty',
    companyBody: 'EverittOS được cung cấp bởi Everitt Ventures. Thông tin sản phẩm có tại',
    back: 'Quay lại cài đặt'
  }
} as const;

export default function AboutPage() {
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;

  return (
    <main className="section">
      <div className="container legal-document" style={{ maxWidth: 720 }}>
        <h2>{c.title}</h2>
        <p className="muted">{c.subtitle}</p>

        <h3>{c.appInfo}</h3>
        <p>
          <strong>EverittOS</strong>
          <br />
          {c.version} {APP_VERSION}
          {BUILD_NUMBER ? ` (${BUILD_NUMBER})` : ''}
        </p>

        <h3>{c.support}</h3>
        <p>
          {c.supportBody} <a href={supportMailtoHref()}>{SUPPORT_EMAIL}</a>.
        </p>

        <h3>{c.legalPrivacy}</h3>
        <ul>
          <li>
            <Link href="/privacy">{c.privacy}</Link>
          </li>
          <li>
            <Link href="/terms">{c.terms}</Link>
          </li>
          <li>
            <Link href="/cookies">{c.cookies}</Link>
          </li>
          <li>
            <Link href="/security">{c.security}</Link>
          </li>
          <li>
            <Link href="/account-deletion">{c.accountDeletion}</Link>
          </li>
          <li>
            <Link href="/settings/billing">{c.subscription}</Link>
          </li>
          <li>
            <Link href="/third-party-notices">{c.thirdParty}</Link>
          </li>
        </ul>

        <h3>{c.company}</h3>
        <p>
          {c.companyBody}{' '}
          <a href="https://everittventures.com/tech" target="_blank" rel="noopener noreferrer">
            everittventures.com/tech
          </a>
          .
        </p>

        <LegalNotice />
        <Link className="btn" href="/settings/account">
          {c.back}
        </Link>
      </div>
    </main>
  );
}
