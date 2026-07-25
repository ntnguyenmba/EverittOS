import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures: string[] = [];
const warnings: string[] = [];
const strictRelease = process.env.MOBILE_RELEASE_STRICT === '1';

function read(path: string): string {
  try {
    return readFileSync(resolve(root, path), 'utf8');
  } catch {
    failures.push(`Missing required file: ${path}`);
    return '';
  }
}

function requireText(path: string, text: string, label: string): void {
  const content = read(path);
  if (content && !content.includes(text)) {
    failures.push(`${label} is missing from ${path}`);
  }
}

function flagPlaceholder(path: string, placeholder: string, label: string): void {
  const content = read(path);
  if (!content || !content.includes(placeholder)) return;

  const message = `${label} still contains placeholder ${placeholder} in ${path}`;
  if (strictRelease) failures.push(message);
  else warnings.push(message);
}

requireText('capacitor.config.ts', "appId: 'com.everittventures.everittos'", 'Capacitor bundle ID');
requireText('capacitor.config.ts', "appName: 'EverittOS'", 'Capacitor app name');
requireText('android/app/build.gradle', 'applicationId "com.everittventures.everittos"', 'Android application ID');
requireText('android/app/build.gradle', 'versionName "1.0.0"', 'Android version name');
requireText('android/app/src/main/AndroidManifest.xml', 'com.android.vending.BILLING', 'Google Play Billing permission');
requireText('android/app/src/main/AndroidManifest.xml', 'android:autoVerify="true"', 'Android verified app links');
requireText('ios/App/App.xcodeproj/project.pbxproj', 'PRODUCT_BUNDLE_IDENTIFIER = com.everittventures.everittos;', 'iOS bundle ID');
requireText('ios/App/App.xcodeproj/project.pbxproj', 'MARKETING_VERSION = 1.0;', 'iOS marketing version');
requireText('ios/App/App/Info.plist', 'NSCameraUsageDescription', 'iOS camera usage description');
requireText('ios/App/App/Info.plist', 'NSPhotoLibraryUsageDescription', 'iOS photo library usage description');
requireText('ios/App/App/PrivacyInfo.xcprivacy', 'NSPrivacyTracking', 'iOS privacy manifest');
requireText('ios/App/App/Billing/EverittBillingPlugin.swift', 'public let jsName = "EverittBilling"', 'iOS billing plugin');
requireText('lib/plugins/everitt-billing.ts', "registerPlugin<EverittBillingPlugin>('EverittBilling'", 'Capacitor billing bridge');
requireText('lib/billing/product-catalog.ts', 'com.everittventures.everittos.pro.monthly', 'Apple Pro product ID');
requireText('lib/billing/product-catalog.ts', 'com.everittventures.everittos.business.monthly', 'Apple Business product ID');
requireText('lib/billing/product-catalog.ts', 'everittos_pro', 'Google Pro product ID');
requireText('lib/billing/product-catalog.ts', 'everittos_business', 'Google Business product ID');
requireText('app/layout.tsx', "import './native-tablet-release-polish.css';", 'Native tablet stylesheet import');
requireText('public/.well-known/apple-app-site-association', 'com.everittventures.everittos', 'Apple universal link app ID');
requireText('public/.well-known/assetlinks.json', 'com.everittventures.everittos', 'Android app-link package');

flagPlaceholder('public/.well-known/apple-app-site-association', 'TEAMID', 'Apple universal links');
flagPlaceholder('public/.well-known/assetlinks.json', 'REPLACE_WITH_RELEASE_KEY_SHA256', 'Android app links');

if (warnings.length > 0) {
  console.warn('\nMobile release validation warnings:\n');
  for (const warning of warnings) console.warn(`- ${warning}`);
  console.warn('- Run with MOBILE_RELEASE_STRICT=1 before store submission to treat these as blockers.');
}

if (failures.length > 0) {
  console.error('\nMobile release validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  strictRelease
    ? 'Strict mobile release validation passed. Store identifiers, permissions, billing, privacy, app links, and native visual safeguards are ready.'
    : 'Mobile release validation passed. Core native safeguards are present.'
);
