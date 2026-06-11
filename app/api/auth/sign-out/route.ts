import { NextResponse } from 'next/server';
import { clearSessionMarkers } from '@/lib/auth-cookies';
import { logActivityServer } from '@/lib/activity-server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { logSecurityEvent, requestClientMeta } from '@/lib/security-events';
import { trackProductEventServer } from '@/lib/product-analytics-server';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const { supabase, attachCookies } = await createRouteHandlerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const org = user ? await fetchOrganizationContextForUser(supabase, user.id) : null;
  const meta = requestClientMeta(request);

  if (user) {
    await logSecurityEvent({
      organizationId: org?.organizationId,
      userId: user.id,
      eventType: 'logout',
      message: 'User signed out',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });
    if (org?.organizationId) {
      await logActivityServer({
        organizationId: org.organizationId,
        userId: user.id,
        entityType: 'auth',
        action: 'logout',
        message: 'User signed out'
      });
    }

    await trackProductEventServer(supabase, 'logout', {
      organizationId: org?.organizationId,
      userId: user.id
    });
  }

  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  clearSessionMarkers(response);
  return attachCookies(response);
}
