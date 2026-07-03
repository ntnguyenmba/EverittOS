import { NextResponse } from 'next/server';
import { ssoProviders } from '@/lib/sso-config';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ providers: ssoProviders() });
}
