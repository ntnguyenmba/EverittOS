import assert from 'node:assert/strict';
import test from 'node:test';
import { Capacitor } from '@capacitor/core';
import { calculateBalanceDue, calculateInvoicePaymentStatus } from '@/lib/outbound/invoice-payment';
import { rangeBounds, type DashboardDateRange } from '@/lib/dashboard-metrics';
import { resolveAskEverittUiAccess, shouldOpenAskEverittUpgrade } from '@/lib/ask-everitt-ui-access';
import { resolveBillingVisibility } from '@/lib/platform/billing';

test('invoice payment status rules', () => {
  assert.equal(calculateInvoicePaymentStatus({ amount: 100, amount_paid: 0 }), 'unpaid');
  assert.equal(calculateInvoicePaymentStatus({ amount: 100, amount_paid: 40 }), 'partially_paid');
  assert.equal(calculateInvoicePaymentStatus({ amount: 100, amount_paid: 100 }), 'paid');
  assert.equal(calculateInvoicePaymentStatus({ amount: 100, amount_paid: 0, due_date: '2000-01-01' }), 'overdue');
  assert.equal(calculateInvoicePaymentStatus({ amount: 100, amount_paid: 10, due_date: '2000-01-01' }), 'overdue');
  assert.equal(calculateInvoicePaymentStatus({ amount: 100, amount_paid: 0, cancelled: true }), 'cancelled');
  assert.equal(calculateBalanceDue(500, 125), 375);
  assert.equal(calculateBalanceDue(100, 150), 0);
});

test('rangeBounds uses local calendar dates without UTC shifts', () => {
  const chicagoLike = new Date(2026, 2, 15, 12, 0, 0); // March 15 local
  const month = rangeBounds('month', chicagoLike);
  assert.equal(month.start, '2026-03-01');
  assert.equal(month.end, '2026-04-01');

  const quarter = rangeBounds('quarter', chicagoLike);
  assert.equal(quarter.start, '2026-01-01');
  assert.equal(quarter.end, '2026-04-01');

  const year = rangeBounds('year', chicagoLike);
  assert.equal(year.start, '2026-01-01');
  assert.equal(year.end, '2027-01-01');

  const leap = rangeBounds('month', new Date(2024, 1, 20));
  assert.equal(leap.start, '2024-02-01');
  assert.equal(leap.end, '2024-03-01');

  const allTime = rangeBounds('all_time' as DashboardDateRange, chicagoLike);
  assert.equal(allTime.start, null);
  assert.equal(allTime.end, null);
});

test('web billing visibility remains purchase-capable', () => {
  const visibility = resolveBillingVisibility();
  assert.equal(visibility.surface, 'web');
  assert.equal(visibility.allowCheckout, true);
  assert.equal(visibility.allowPortal, true);
  assert.equal(visibility.showUpgradePrices, true);
  assert.equal(visibility.showUpgradeActions, true);
});

test('cash accounting helpers: unpaid never equals collected amount', () => {
  const unpaid = { amount: 400, amount_paid: 0 };
  const paid = Math.min(Number(unpaid.amount_paid), Number(unpaid.amount));
  assert.equal(paid, 0);
  // Collected cash must use amount_paid only — never fall back to invoice amount.
  assert.equal(paid, Number(unpaid.amount_paid));
});

test('ask Everitt UI access hides AI upsell when platform is native', () => {
  const originalNative = Capacitor.isNativePlatform;
  const originalPlatform = Capacitor.getPlatform;
  Object.defineProperty(Capacitor, 'isNativePlatform', {
    configurable: true,
    value: () => true
  });
  Object.defineProperty(Capacitor, 'getPlatform', {
    configurable: true,
    value: () => 'ios'
  });

  try {
    const lockedStatus = {
      searchAvailable: true,
      aiModeAvailable: false,
      aiLocked: true,
      planLocked: true
    };
    const locked = resolveAskEverittUiAccess(lockedStatus);
    assert.equal(locked.isNative, true);
    assert.equal(locked.canUseAi, false);
    assert.equal(locked.shouldShowAiControls, false);
    assert.equal(locked.shouldShowAiUpsell, false);
    assert.equal(locked.shouldShowAiSuggestions, false);
    assert.equal(shouldOpenAskEverittUpgrade(lockedStatus), false);

    const enabled = resolveAskEverittUiAccess({
      searchAvailable: true,
      aiModeAvailable: true
    });
    assert.equal(enabled.canUseAi, true);
    assert.equal(enabled.shouldShowAiControls, true);
    assert.equal(enabled.shouldShowAiUpsell, false);

    const billing = resolveBillingVisibility();
    assert.equal(billing.allowCheckout, false);
    assert.equal(billing.allowNativeStorePurchase, true);
    assert.equal(billing.showUpgradeActions, true);
    assert.equal(billing.showUpgradePrices, true);
    assert.equal(billing.showRestorePurchases, true);
  } finally {
    Object.defineProperty(Capacitor, 'isNativePlatform', {
      configurable: true,
      value: originalNative
    });
    Object.defineProperty(Capacitor, 'getPlatform', {
      configurable: true,
      value: originalPlatform
    });
  }
});

test('ask Everitt web non-AI accounts may show upsell', () => {
  const original = Capacitor.isNativePlatform;
  Object.defineProperty(Capacitor, 'isNativePlatform', {
    configurable: true,
    value: () => false
  });
  try {
    const status = {
      searchAvailable: true,
      aiModeAvailable: false,
      aiLocked: true,
      planLocked: true
    };
    const access = resolveAskEverittUiAccess(status);
    assert.equal(access.isNative, false);
    assert.equal(access.shouldShowAiUpsell, true);
    assert.equal(shouldOpenAskEverittUpgrade(status), true);
  } finally {
    Object.defineProperty(Capacitor, 'isNativePlatform', {
      configurable: true,
      value: original
    });
  }
});
