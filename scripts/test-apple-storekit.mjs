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
const plugin = read('ios/App/App/Billing/EverittBillingPlugin.swift');
const manager = read('ios/App/App/Billing/StoreKitBillingManager.swift');
const appDelegate = read('ios/App/App/AppDelegate.swift');
const project = read('ios/App/App.xcodeproj/project.pbxproj');
const verifyRoute = read('app/api/billing/apple/verify/route.ts');

const expected = [
  'com.everittventures.everittos.pro.monthly.v3',
  'com.everittventures.everittos.business.monthly.v2',
  'com.everittventures.everittos.starter.monthly.v4',
  'com.everittventures.everittos.growth.monthly.v2',
  'com.everittventures.everittos.enterprise.monthly.v2'
];
for (const id of expected) {
  assert.match(catalog, new RegExp(id.replaceAll('.', '\\.')));
  assert.match(plugin, new RegExp(id.replaceAll('.', '\\.')));
}

assert.match(nativePurchase, /EverittBilling\.purchase/);
assert.match(nativePurchase, /\/api\/billing\/apple\/verify/);
assert.match(nativePurchase, /signedTransaction/);
assert.match(nativePurchase, /notifyWorkspacePlanRefresh/);
assert.match(subscribeButton, /purchaseNativePlan/);
assert.match(subscribeButton, /loadNativeStoreProducts/);
assert.match(subscribeButton, /disabled=\{disabled \|\| busy\}/);

assert.match(plugin, /CAPPluginMethod\(name: "purchase"/);
assert.match(plugin, /CAPPluginMethod\(name: "restorePurchases"/);
assert.match(plugin, /StoreKitBillingManager\.shared\.purchase/);
assert.match(plugin, /StoreKitBillingManager\.shared\.restore/);

assert.match(manager, /Product\.products\(for:/);
assert.match(manager, /product\.purchase\(\)/);
assert.match(manager, /Transaction\.currentEntitlements/);
assert.match(manager, /Transaction\.updates/);
assert.match(manager, /\.jwsRepresentation/);
assert.match(manager, /case \.unverified:/);
assert.match(manager, /case \.verified/);
assert.match(manager, /transaction\.finish\(\)/);
assert.match(manager, /AppStore\.sync\(\)/);

assert.match(appDelegate, /registerPluginInstance\(EverittBillingPlugin\(\)\)/);
assert.match(project, /EverittBillingPlugin\.swift in Sources/);
assert.match(project, /StoreKitBillingManager\.swift in Sources/);

assert.match(verifyRoute, /planFromAppleProductId/);
assert.match(verifyRoute, /verifyAppleSignedTransaction/);
assert.match(verifyRoute, /upsertAppleSubscription/);
assert.match(verifyRoute, /claimBillingEvent/);
assert.doesNotMatch(nativePurchase, /RevenueCat|Purchases\.configure|@revenuecat/i);

console.log('EverittOS Apple StoreKit checks passed');
