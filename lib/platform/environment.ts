import { MOBILE_NATIVE_IDENTIFIERS, mobileProductionOrigin } from '@/lib/platform/config';

export type MobileEnvValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  values: {
    appUrl: string;
    supabaseUrl: string;
    hasSupabaseAnonKey: boolean;
    iosBundleId: string;
    androidPackage: string;
  };
};

const REQUIRED_PUBLIC_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

export function validateMobilePublicEnv(env: Record<string, string | undefined> = process.env): MobileEnvValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const appUrl = (env.NEXT_PUBLIC_APP_URL || env.CAPACITOR_SERVER_URL || mobileProductionOrigin()).replace(/\/$/, '');
  const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

  if (!appUrl.startsWith('https://') && !appUrl.startsWith('http://localhost')) {
    errors.push('NEXT_PUBLIC_APP_URL must be an HTTPS production URL or localhost for development.');
  }

  if (appUrl.includes('192.168.') || appUrl.includes('10.0.') || /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(appUrl)) {
    errors.push('Do not use a personal LAN IP address for mobile application configuration.');
  }

  for (const key of REQUIRED_PUBLIC_KEYS) {
    if (!env[key] && key !== 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
      errors.push(`Missing required public environment variable: ${key}`);
    }
  }

  if (!anonKey) {
    errors.push('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).');
  }

  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push('SUPABASE_SERVICE_ROLE_KEY is present in the environment inspection context; never bundle it in native apps.');
  }

  if (env.STRIPE_SECRET_KEY || env.STRIPE_WEBHOOK_SECRET) {
    warnings.push('Stripe secret values must remain server-only and must not ship in native bundles.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    values: {
      appUrl,
      supabaseUrl,
      hasSupabaseAnonKey: Boolean(anonKey),
      iosBundleId: MOBILE_NATIVE_IDENTIFIERS.iosBundleId,
      androidPackage: MOBILE_NATIVE_IDENTIFIERS.androidPackage
    }
  };
}
