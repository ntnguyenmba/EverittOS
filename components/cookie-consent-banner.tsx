'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  defaultConsent,
  hasCookieConsentChoice,
  readCookieConsent,
  writeCookieConsent,
  type CookieConsent
} from '@/lib/cookie-consent';
import { useTranslation } from '@/components/locale-provider';
import { getAppPlatform } from '@/lib/platform/detect';

export function CookieConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [prefs, setPrefs] = useState<CookieConsent>(defaultConsent());

  useEffect(() => {
    // Apple App Review does not allow a custom tracking-permission prompt in the iOS app.
    // The native iOS build therefore uses essential session storage only and never shows
    // this web cookie banner. Optional analytics is separately disabled in AnalyticsGate.
    if (getAppPlatform() === 'ios') {
      setVisible(false);
      setManageOpen(false);
      return;
    }

    if (!hasCookieConsentChoice()) {
      setVisible(true);
      return;
    }
    setPrefs(readCookieConsent() || defaultConsent());
  }, []);

  function save(consent: CookieConsent) {
    writeCookieConsent(consent);
    setPrefs(consent);
    setVisible(false);
    setManageOpen(false);
    window.dispatchEvent(new CustomEvent('everittos:cookie-consent'));
  }

  function acceptAll() {
    save({ ...defaultConsent(), analytics: true, marketing: true, updatedAt: new Date().toISOString() });
  }

  function rejectNonEssential() {
    save(defaultConsent());
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-labelledby="cookie-banner-title" aria-modal="true">
      <div className="cookie-banner-inner">
        <div>
          <h2 id="cookie-banner-title" className="cookie-banner-title">
            {t('cookies.banner.title')}
          </h2>
          <p className="muted">{t('cookies.banner.description')}</p>
          <p className="muted cookie-banner-links">
            <Link href="/cookies" className="legal-inline-link">
              {t('cookies.banner.policy')}
            </Link>{' '}
            ·{' '}
            <Link href="/privacy" className="legal-inline-link">
              {t('legal.privacyPolicy')}
            </Link>
          </p>
        </div>

        {manageOpen ? (
          <div className="cookie-preferences">
            <label className="cookie-pref-row">
              <input type="checkbox" checked disabled aria-readonly />
              <span>
                <strong>{t('cookies.categories.necessary')}</strong>
                <span className="muted">{t('cookies.categories.necessaryDesc')}</span>
              </span>
            </label>
            <label className="cookie-pref-row">
              <input
                type="checkbox"
                checked={prefs.analytics}
                onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))}
              />
              <span>
                <strong>{t('cookies.categories.analytics')}</strong>
                <span className="muted">{t('cookies.categories.analyticsDesc')}</span>
              </span>
            </label>
            <label className="cookie-pref-row">
              <input
                type="checkbox"
                checked={prefs.marketing}
                onChange={(e) => setPrefs((p) => ({ ...p, marketing: e.target.checked }))}
              />
              <span>
                <strong>{t('cookies.categories.marketing')}</strong>
                <span className="muted">{t('cookies.categories.marketingDesc')}</span>
              </span>
            </label>
            <div className="cookie-banner-actions">
              <button type="button" className="btn btn-primary" onClick={() => save({ ...prefs, updatedAt: new Date().toISOString() })}>
                {t('cookies.banner.save')}
              </button>
              <button type="button" className="btn" onClick={() => setManageOpen(false)}>
                {t('common.back')}
              </button>
            </div>
          </div>
        ) : (
          <div className="cookie-banner-actions">
            <button type="button" className="btn btn-primary" onClick={acceptAll}>
              {t('cookies.banner.acceptAll')}
            </button>
            <button type="button" className="btn" onClick={rejectNonEssential}>
              {t('cookies.banner.reject')}
            </button>
            <button type="button" className="btn" onClick={() => setManageOpen(true)}>
              {t('cookies.banner.manage')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
