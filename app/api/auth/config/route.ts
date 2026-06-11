import { NextResponse } from 'next/server';
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
    diagnostics
  });
}
