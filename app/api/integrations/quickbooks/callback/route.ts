import { NextResponse } from 'next/server';
import { appUrl } from '@/lib/app-url';
import { quickbooksConfigured } from '@/lib/quickbooks';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectWithError(code: string) {
  return NextResponse.redirect(appUrl(`/settings/integrations?quickbooks=error&reason=${code}`));
}

export async function GET(request: Request) {
  if (!quickbooksConfigured()) {
    return redirectWithError('not_configured');
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const realmId = url.searchParams.get('realmId');

  if (!code || !state) {
    return redirectWithError('missing_code');
  }

  let parsed: { userId?: string; organizationId?: string };
  try {
    parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
      userId?: string;
      organizationId?: string;
    };
  } catch {
    return redirectWithError('invalid_state');
  }

  if (!parsed.organizationId) {
    return redirectWithError('invalid_state');
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID!.trim();
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!.trim();
  const redirectUri = (process.env.QUICKBOOKS_REDIRECT_URI || appUrl('/api/integrations/quickbooks/callback')).trim();

  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  });

  if (!tokenRes.ok) {
    return redirectWithError('connect_failed');
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const admin = createAdminSupabase();
  if (!admin) {
    return redirectWithError('server_config');
  }

  const expiresAt = tokenJson.expires_in
    ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
    : null;

  await admin.from('quickbooks_connections').upsert(
    {
      organization_id: parsed.organizationId,
      provider: 'quickbooks',
      status: 'connected',
      realm_id: realmId,
      access_token: tokenJson.access_token || null,
      refresh_token: tokenJson.refresh_token || null,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'organization_id' }
  );

  return NextResponse.redirect(appUrl('/settings/integrations?quickbooks=connected'));
}
