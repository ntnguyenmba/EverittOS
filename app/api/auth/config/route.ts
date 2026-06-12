import { NextResponse } from 'next/server';
import {
  confirmEmailRedirectUrl,
  productionAuthRedirects,
  resetPasswordRedirectUrl,
  supabaseAllowedRedirectUrls
} from '@/lib/auth-redirect-urls';
import { appOrigin } from '@/lib/app-url';
import { getPublicSupabaseConfig, isSupabaseConfigured, supabaseConfigDiagnostics } from '@/lib/supabase-config';

export const runtime = 'nodejs';

/** Public Supabase config for browser clients (anon key is safe to expose). */
export async function GET() {
  const { url, anonKey } = getPublicSupabaseConfig();
  const diagnostics = supabaseConfigDiagnostics();

  return NextResponse.json({
    url,
    anonKey,
    configured: isSupabaseConfigured(),
    diagnostics,
    authEmailProvider: 'supabase',
    appOrigin: appOrigin(),
    authRedirects: {
      production: productionAuthRedirects(),
      signupConfirmation: confirmEmailRedirectUrl('/onboarding'),
      passwordReset: resetPasswordRedirectUrl(),
      authCallback: productionAuthRedirects().authCallback,
      login: productionAuthRedirects().login,
      supabaseAllowList: supabaseAllowedRedirectUrls()
    }
  });
}
