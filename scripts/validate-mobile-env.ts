import { validateMobilePublicEnv } from '@/lib/platform/environment';

const result = validateMobilePublicEnv(process.env);

for (const warning of result.warnings) {
  console.warn(`[mobile-env] ${warning}`);
}

if (!result.ok) {
  for (const error of result.errors) {
    console.error(`[mobile-env] ${error}`);
  }
  process.exit(1);
}

console.log('Mobile public environment validation passed.');
console.log(`App URL: ${result.values.appUrl}`);
console.log(`Supabase URL: ${result.values.supabaseUrl || '(not set)'}`);
console.log(`Supabase anon key present: ${result.values.hasSupabaseAnonKey}`);
console.log(`iOS bundle ID: ${result.values.iosBundleId}`);
console.log(`Android package: ${result.values.androidPackage}`);
