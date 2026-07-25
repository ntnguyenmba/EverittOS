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

function isMissingTableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('does not exist') ||
    normalized.includes('could not find the table') ||
    normalized.includes('schema cache') ||
    normalized.includes('42p01')
  );
}

export async function GET() {
  try {
    const ctx = await withTimeout(requireWorkspaceSession(), 'Workspace session');
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status, headers: NO_CACHE_HEADERS });
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
    let databaseReady = Boolean(admin);
    const warnings: string[] = [];

    if (!admin) {
      warnings.push('The server database connection is not configured.');
    } else {
      try {
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
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown QuickBooks connection lookup error';
        databaseReady = false;
        warnings.push(
          isMissingTableError(message)
            ? 'QuickBooks database tables are missing. Run the QuickBooks Supabase migration before connecting.'
            : 'The saved QuickBooks connection could not be read.'
        );
        console.error('QuickBooks connection lookup failed', {
          organizationId: ctx.workspace.organizationId,
          message
        });
      }
    }

    let recentLogs: Array<Record<string, unknown>> = [];
    try {
      const logsResult = await withTimeout(
        ctx.supabase
          .from('quickbooks_sync_logs')
          .select('id, entity_type, action, status, error_message, external_id, created_at')
          .eq('organization_id', ctx.workspace.organizationId)
          .order('created_at', { ascending: false })
          .limit(5),
        'QuickBooks sync log lookup'
      );

      if (logsResult.error) {
        const message = logsResult.error.message || 'Unknown QuickBooks sync log error';
        if (isMissingTableError(message)) databaseReady = false;
        warnings.push(
          isMissingTableError(message)
            ? 'QuickBooks sync history is unavailable until the database migration is applied.'
            : 'Recent QuickBooks sync history could not be loaded.'
        );
      } else {
        recentLogs = (logsResult.data || []) as Array<Record<string, unknown>>;
      }
    } catch (error) {
      warnings.push('Recent QuickBooks sync history could not be loaded.');
      console.error('QuickBooks sync log lookup failed', error);
    }

    const status = connectionSafe?.status || 'disconnected';
    const setupMessages = [
      configured ? null : quickbooksMissingCredentialsMessage(),
      ...warnings
    ].filter(Boolean);

    return NextResponse.json(
      {
        configured,
        databaseReady,
        canConnect,
        canExport: ctx.canManage,
        connection: connectionSafe || { status: 'disconnected', needsReconnect: false },
        recentLogs,
        setupMessage: setupMessages.length ? setupMessages.join(' ') : null,
        needsReconnect: status === 'error',
        warning: warnings.length ? warnings.join(' ') : null
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    const timedOut = error instanceof IntegrationTimeoutError;
    const message = error instanceof Error ? error.message : 'Unknown QuickBooks status error';
    console.error('QuickBooks status error', { message, error });
    return NextResponse.json(
      {
        error: timedOut
          ? 'QuickBooks status timed out while loading workspace data.'
          : 'QuickBooks status could not be loaded.',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
        code: timedOut ? 'quickbooks_status_timeout' : 'quickbooks_status_failed'
      },
      { status: timedOut ? 504 : 500, headers: NO_CACHE_HEADERS }
    );
  }
}
