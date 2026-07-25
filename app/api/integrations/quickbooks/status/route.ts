import { NextResponse } from 'next/server';
import { quickbooksConfigured, quickbooksMissingCredentialsMessage } from '@/lib/quickbooks';
import { loadQuickBooksConnection } from '@/lib/quickbooks/client';
import { canManageOrganizationSettings } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache'
};

const BACKEND_TIMEOUT_MS = 8000;

class IntegrationTimeoutError extends Error {
  constructor(step: string) {
    super(`${step} timed out`);
    this.name = 'IntegrationTimeoutError';
  }
}

async function withTimeout<T>(promise: PromiseLike<T>, step: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new IntegrationTimeoutError(step)), BACKEND_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET() {
  try {
    const ctx = await withTimeout(requireWorkspaceSession(), 'Workspace session');
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status, headers: NO_CACHE_HEADERS });
    }

    const canConnect = canManageOrganizationSettings(ctx.workspace.role);
    const configured = quickbooksConfigured();
    const admin = createAdminSupabase();

    let connectionSafe: {
      status: string;
      realm_id: string | null;
      company_name: string | null;
      last_sync_at: string | null;
      last_error: string | null;
      updated_at: string | null;
      needsReconnect: boolean;
    } | null = null;

    if (admin) {
      const connection = await withTimeout(
        loadQuickBooksConnection(admin, ctx.workspace.organizationId),
        'QuickBooks connection lookup'
      );
      if (connection) {
        connectionSafe = {
          status: connection.status,
          realm_id: connection.realm_id,
          company_name: connection.company_name,
          last_sync_at: connection.last_sync_at,
          last_error: connection.last_error,
          updated_at: connection.updated_at,
          needsReconnect: connection.status === 'error'
        };
      }
    }

    const logsResult = await withTimeout(
      ctx.supabase
        .from('quickbooks_sync_logs')
        .select('id, entity_type, action, status, error_message, external_id, created_at')
        .eq('organization_id', ctx.workspace.organizationId)
        .order('created_at', { ascending: false })
        .limit(5),
      'QuickBooks sync log lookup'
    );

    const recentLogs = logsResult.data || [];
    const status = connectionSafe?.status || 'disconnected';

    return NextResponse.json(
      {
        configured,
        canConnect,
        canExport: ctx.canManage,
        connection: connectionSafe || { status: 'disconnected', needsReconnect: false },
        recentLogs,
        setupMessage: configured ? null : quickbooksMissingCredentialsMessage(),
        needsReconnect: status === 'error',
        warning: logsResult.error ? 'Recent QuickBooks sync history could not be loaded.' : null
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    const timedOut = error instanceof IntegrationTimeoutError;
    console.error('QuickBooks status error', error);
    return NextResponse.json(
      {
        error: timedOut
          ? 'QuickBooks status timed out while loading workspace data.'
          : 'QuickBooks status could not be loaded.',
        code: timedOut ? 'quickbooks_status_timeout' : 'quickbooks_status_failed'
      },
      { status: timedOut ? 504 : 500, headers: NO_CACHE_HEADERS }
    );
  }
}
