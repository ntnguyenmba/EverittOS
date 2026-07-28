import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { getMessages } from '@/lib/i18n/get-messages';
import { translatePortalJobStatus, translatePortalPaymentStatus } from '@/lib/portal-status-i18n';

describe('portal localization', () => {
  it('exposes portal catalogs for en, es, and vi', () => {
    for (const locale of ['en', 'es', 'vi'] as const) {
      const messages = getMessages(locale);
      assert.equal(typeof messages.portal.client.settingsTitle, 'string');
      assert.equal(typeof messages.portal.contractor.settingsTitle, 'string');
      assert.equal(typeof messages.portal.account.delete.dangerZone, 'string');
      assert.equal(typeof messages.portal.common.signOut, 'string');
      assert.ok(messages.portal.client.settingsTitle.length > 0);
      assert.ok(messages.portal.contractor.todaysJobs.length > 0);
    }
  });

  it('keeps English, Spanish, and Vietnamese account settings titles distinct', () => {
    const en = getMessages('en').portal.client.settingsTitle;
    const es = getMessages('es').portal.client.settingsTitle;
    const vi = getMessages('vi').portal.client.settingsTitle;
    assert.equal(en, 'Account settings');
    assert.equal(es, 'Configuración de la cuenta');
    assert.equal(vi, 'Cài đặt tài khoản');
    assert.notEqual(en, es);
    assert.notEqual(en, vi);
  });

  it('localizes job and payment status helpers', () => {
    const tEn = (path: string) => {
      const parts = path.split('.');
      let current: unknown = getMessages('en');
      for (const part of parts) current = (current as Record<string, unknown>)[part];
      return String(current);
    };
    const tVi = (path: string) => {
      const parts = path.split('.');
      let current: unknown = getMessages('vi');
      for (const part of parts) current = (current as Record<string, unknown>)[part];
      return String(current);
    };

    assert.equal(translatePortalJobStatus(tEn, 'in_progress'), 'In progress');
    assert.equal(translatePortalPaymentStatus(tEn, 'partially_paid'), 'Partially paid');
    assert.equal(translatePortalPaymentStatus(tEn, 'none'), 'None');
    assert.notEqual(translatePortalJobStatus(tVi, 'completed'), 'Completed');
    assert.notEqual(translatePortalPaymentStatus(tVi, 'paid'), 'Paid');
  });

  it('removes PortalViewTranslator from the codebase', () => {
    assert.equal(existsSync(join(process.cwd(), 'components/portal/portal-view-translator.tsx')), false);
    const settings = readFileSync(join(process.cwd(), 'app/portal/client/settings/page.tsx'), 'utf8');
    assert.doesNotMatch(settings, /PortalViewTranslator/);
    assert.match(settings, /useTranslation/);
    assert.match(settings, /portal\.client\.settingsTitle/);
    assert.match(settings, /PortalClientNav/);
  });

  it('keeps Sign Out on client portal navigation', () => {
    const nav = readFileSync(join(process.cwd(), 'components/portal/portal-client-nav.tsx'), 'utf8');
    assert.match(nav, /performClientLogout/);
    assert.match(nav, /portal\.common\.signOut/);
    assert.match(nav, /\/login/);

    for (const file of [
      'app/portal/client/page.tsx',
      'app/portal/client/jobs/page.tsx',
      'app/portal/client/jobs/[id]/page.tsx',
      'app/portal/client/settings/page.tsx'
    ]) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      assert.match(source, /PortalClientNav/);
    }
  });
});
