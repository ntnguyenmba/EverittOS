import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures: string[] = [];

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

requireText('capacitor.config.ts', "appId: 'com.everittventures.everittos'", 'Capacitor bundle ID');
requireText('capacitor.config.ts', "appName: 'EverittOS'", 'Capacitor app name');
requireText('android/app/build.gradle', 'applicationId "com.everittventures.everittos"', 'Android application ID');
requireText('android/app/build.gradle', 'versionName "1.0.0"', 'Android version name');
requireText('android/app/src/main/AndroidManifest.xml', 'com.android.vending.BILLING', 'Google Play Billing permission');
requireText('ios/App/App.xcodeproj/project.pbxproj', 'PRODUCT_BUNDLE_IDENTIFIER = com.everittventures.everittos;', 'iOS bundle ID');
requireText('ios/App/App.xcodeproj/project.pbxproj', 'MARKETING_VERSION = 1.0;', 'iOS marketing version');
requireText('ios/App/App/Info.plist', 'NSCameraUsageDescription', 'iOS camera usage description');
requireText('ios/App/App/Info.plist', 'NSPhotoLibraryUsageDescription', 'iOS photo library usage description');
requireText('lib/billing/product-catalog.ts', 'com.everittventures.everittos.pro.monthly', 'Apple Pro product ID');
requireText('lib/billing/product-catalog.ts', 'com.everittventures.everittos.business.monthly', 'Apple Business product ID');
requireText('lib/billing/product-catalog.ts', 'everittos_pro', 'Google Pro product ID');
requireText('lib/billing/product-catalog.ts', 'everittos_business', 'Google Business product ID');
requireText('app/layout.tsx', "import './native-tablet-release-polish.css';", 'Native tablet stylesheet import');

if (failures.length > 0) {
  console.error('\nMobile release validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Mobile release validation passed. Bundle IDs, versions, permissions, billing products, and native visual safeguards are present.');
