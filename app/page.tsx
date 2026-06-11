import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BrandLogo } from '@/components/brand-logo';

/** Minimal app entry: logo, one line, sign in or start trial. Marketing lives on everittventures.com/tech. */
export default async function HomePage() {
  const t = await getTranslations('gateway');
  const commonT = await getTranslations('common');

  return (
    <main id="main-content" className="auth-gateway">
      <div className="auth-gateway-inner">
        <BrandLogo href="/" size={48} showName />
        <h1 className="auth-gateway-title">{t('title')}</h1>
        <div className="auth-gateway-actions">
          <Link className="btn btn-primary" href="/login">
            {t('signIn')}
          </Link>
          <Link className="btn" href="/signup">
            {t('startTrial')}
          </Link>
        </div>
        <footer className="auth-gateway-footer">
          <Link href="/terms">{commonT('terms')}</Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacy">{commonT('privacy')}</Link>
        </footer>
      </div>
    </main>
  );
}
