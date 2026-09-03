import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getExpensesPageCopy } from '@/lib/i18n/expenses-copy';
import { getNativeBillingCopy } from '@/lib/i18n/native-billing-copy';
import { getLaborBasisLabels, formatLaborPaymentLabel } from '@/lib/job-labor-basis';

describe('Production readiness polish', () => {
  it('Android manifest includes Play Billing permission', () => {
    const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    assert.match(manifest, /com\.android\.vending\.BILLING/);
  });

  it('iOS Info.plist declares export compliance and PrivacyInfo exists', () => {
    const info = readFileSync('ios/App/App/Info.plist', 'utf8');
    assert.match(info, /ITSAppUsesNonExemptEncryption/);
    assert.match(info, /<false\/>/);
    const privacy = readFileSync('ios/App/App/PrivacyInfo.xcprivacy', 'utf8');
    assert.match(privacy, /NSPrivacyTracking/);
    assert.match(privacy, /<false\/>/);
    const pbx = readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');
    assert.match(pbx, /PrivacyInfo\.xcprivacy/);
  });

  it('dashboard CSS wires mobile alignment sheets', () => {
    const css = readFileSync('app/dashboard.css', 'utf8');
    assert.match(css, /dashboard-mobile-alignment\.css/);
    assert.match(css, /dashboard-metric-responsive-fix\.css/);
    const layout = readFileSync('app/layout.tsx', 'utf8');
    assert.match(layout, /global-content-rhythm\.css/);
  });

  it('labor labels localize for Spanish and Vietnamese', () => {
    assert.match(
      formatLaborPaymentLabel({ paymentBasis: 'flat', quantity: 1, rate: 650, total: 650, locale: 'es' }),
      /Monto fijo/
    );
    assert.equal(getLaborBasisLabels('vi').hoursLabel, 'Số giờ');
  });

  it('native billing and expenses copy cover en/es/vi', () => {
    for (const locale of ['en', 'es', 'vi'] as const) {
      const billing = getNativeBillingCopy(locale);
      const expenses = getExpensesPageCopy(locale);
      assert.equal(billing.appleNotice.length > 0, true);
      assert.equal(expenses.title.length > 0, true);
      assert.doesNotMatch(billing.appleNotice, /Coming soon/i);
      assert.doesNotMatch(expenses.gateBody, /Home Depot/i);
    }
  });

  it('expenses page does not ship fake sample rows', () => {
    const page = readFileSync('app/expenses/page.tsx', 'utf8');
    assert.doesNotMatch(page, /finance-demo-card/);
    assert.doesNotMatch(page, /Home Depot/);
  });
});
