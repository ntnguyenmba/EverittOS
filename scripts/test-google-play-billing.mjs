import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

const catalog = read('lib/billing/product-catalog.ts');
const nativePurchase = read('lib/billing/native-purchase.ts');
const subscribeButton = read('components/native-store-subscribe-button.tsx');
const plugin = read('android/app/src/main/java/com/everittventures/everittos/billing/EverittBillingPlugin.java');
const manager = read('android/app/src/main/java/com/everittventures/everittos/billing/PlayBillingManager.java');
const mainActivity = read('android/app/src/main/java/com/everittventures/everittos/MainActivity.java');
const gradle = read('android/app/build.gradle');
const verifyRoute = read('app/api/billing/google/verify/route.ts');

for (const id of ['everittos_pro', 'everittos_business', 'everittos_starter', 'everittos_growth', 'everittos_enterprise']) {
  assert.match(catalog, new RegExp(id));
}
assert.match(catalog, /DEFAULT_ANDROID_BASE_PLAN = 'monthly'/);
assert.match(nativePurchase, /EverittBilling\.purchase/);
assert.match(nativePurchase, /\/api\/billing\/google\/verify/);
assert.match(nativePurchase, /purchaseToken/);
assert.match(nativePurchase, /notifyWorkspacePlanRefresh/);
assert.match(subscribeButton, /purchaseNativePlan/);
assert.match(subscribeButton, /loadNativeStoreProducts/);

assert.match(plugin, /@CapacitorPlugin\(name = "EverittBilling"\)/);
assert.match(plugin, /void purchase\(/);
assert.match(plugin, /void restorePurchases\(/);
assert.match(manager, /BillingClient\.ProductType\.SUBS/);
assert.match(manager, /queryProductDetailsAsync/);
assert.match(manager, /launchBillingFlow/);
assert.match(manager, /queryPurchasesAsync/);
assert.match(manager, /Purchase\.PurchaseState\.PENDING/);
assert.match(manager, /BillingResponseCode\.USER_CANCELED/);
assert.match(manager, /getPurchaseToken\(\)/);
assert.match(manager, /MONTHLY_BASE_PLAN_ID = "monthly"/);
assert.match(manager, /setOfferToken\(monthlyOffer\.getOfferToken\(\)\)/);
assert.match(manager, /Load the exact[\s\S]*subscription on demand/);

assert.match(mainActivity, /registerPlugin\(EverittBillingPlugin\.class\)/);
assert.match(gradle, /com\.android\.billingclient:billing:/);
assert.match(verifyRoute, /planFromGoogleProductId/);
assert.match(verifyRoute, /verifyGooglePlaySubscription/);
assert.match(verifyRoute, /upsertGoogleSubscription/);
assert.match(verifyRoute, /acknowledgeGooglePlaySubscription/);
assert.match(verifyRoute, /claimBillingEvent/);
assert.match(verifyRoute, /verified\.status === 'pending'/);
assert.doesNotMatch(nativePurchase, /RevenueCat|Purchases\.configure|@revenuecat/i);

console.log('EverittOS Google Play Billing checks passed');
