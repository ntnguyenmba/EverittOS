/**
 * Resolve an allowlisted export resource using the signed-in session.
 * Never trusts client-supplied user, organization, or role ids.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  loadBookkeepingExport,
  loadDashboardDetailsExport,
  loadDashboardExport
} from '@/lib/exports/dashboard-export-data';
import {
  loadContractorPayExport,
  loadCustomersExport,
  loadExpensesExport,
  loadInvoicesExport,
  loadPaymentsExport
} from '@/lib/exports/business-export-data';
import {
  CONTRACTOR_JOBS_COLUMNS,
  CUSTOMER_JOBS_COLUMNS,
  ownerJobsColumns,
  TEAM_EXPORT_COLUMNS
} from '@/lib/exports/columns';
import { loadOwnerJobsExportData } from '@/lib/exports/job-export-data';
import { loadClientPortalJobsExport, loadContractorPortalJobsExport } from '@/lib/exports/portal-export-data';
import { preparedFromColumns, type PreparedExport } from '@/lib/exports/prepared';
import type { ExportResourceId } from '@/lib/exports/resources';
import { loadTeamExportData } from '@/lib/exports/team-export-data';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { repairClientPortalAccessForUser } from '@/lib/client-portal-repair';
import type { ExportCopy } from '@/lib/i18n/export-copy';
import { canViewTeam, isManagerRole, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export type ResolvedExport =
  | { ok: true; prepared: PreparedExport }
  | { ok: false; error: string; status: number; code?: string };

function fromLoaded(
  loaded: { ok: true; data: PreparedExport } | { ok: false; error: string; status: number }
): ResolvedExport {
  if (!loaded.ok) return loaded;
  return { ok: true, prepared: loaded.data };
}

async function organizationName(supabase: SupabaseClient, organizationId: string): Promise<string> {
  const { data } = await supabase.from('organizations').select('name').eq('id', organizationId).maybeSingle();
  return String(data?.name || '').trim() || 'EverittOS';
}

export async function resolvePreparedExport(input: {
  resource: ExportResourceId;
  searchParams: URLSearchParams;
  copy: ExportCopy;
  locale: string;
}): Promise<ResolvedExport> {
  const { resource, searchParams, copy, locale } = input;

  if (resource === 'jobs') {
    const ctx = await requireWorkspaceSession({ requireManager: true });
    if (!ctx.ok) return { ok: false, error: ctx.error, status: ctx.status, code: ctx.code };
    if (!isManagerRole(normalizeRole(ctx.workspace.role))) {
      return { ok: false, error: 'Forbidden', status: 403, code: 'forbidden' };
    }
    const loaded = await loadOwnerJobsExportData({
      supabase: ctx.supabase,
      userId: ctx.userId,
      workspace: ctx.workspace,
      searchParams
    });
    if (!loaded.ok) return loaded;
    const columns = ownerJobsColumns(loaded.data.includeFinance);
    return {
      ok: true,
      prepared: preparedFromColumns(columns, loaded.data.rows, {
        filenamePrefix: 'jobs',
        title: loaded.data.includeFinance ? copy.jobsFinancialTitle : copy.jobsOperationalTitle,
        companyName: loaded.data.companyName,
        appliedFilters: loaded.data.appliedFilters,
        privateLabel: copy.privateCompanyRecord,
        summary: loaded.data.includeFinance
          ? [
              { label: copy.job, value: String(loaded.data.summary.jobCount) },
              { label: 'Expected revenue', value: loaded.data.summary.expectedRevenueTotal || '0.00' },
              { label: 'Collected', value: loaded.data.summary.actualCollectedTotal || '0.00' },
              { label: 'Expected profit', value: loaded.data.summary.expectedProfitTotal || '0.00' },
              { label: 'Actual profit', value: loaded.data.summary.actualProfitTotal || '0.00' }
            ]
          : [{ label: copy.job, value: String(loaded.data.summary.jobCount) }]
      })
    };
  }

  if (resource === 'team') {
    const ctx = await requireWorkspaceSession();
    if (!ctx.ok) return { ok: false, error: ctx.error, status: ctx.status, code: ctx.code };
    if (!canViewTeam(normalizeRole(ctx.workspace.role))) {
      return { ok: false, error: 'Forbidden', status: 403, code: 'forbidden' };
    }
    const loaded = await loadTeamExportData({
      supabase: ctx.supabase,
      workspace: ctx.workspace,
      admin: createAdminSupabase()
    });
    if (!loaded.ok) return loaded;
    return {
      ok: true,
      prepared: preparedFromColumns(TEAM_EXPORT_COLUMNS, loaded.data.rows, {
        filenamePrefix: 'team',
        title: copy.teamTitle,
        companyName: loaded.data.companyName,
        appliedFilters: loaded.data.appliedFilters,
        privateLabel: copy.privateCompanyRecord,
        summary: [
          { label: copy.membersLabel, value: String(loaded.data.summary.memberCount) },
          { label: copy.pendingInvitationsLabel, value: String(loaded.data.summary.pendingInvitationCount) }
        ]
      })
    };
  }

  if (resource === 'portal-client-jobs') {
    const supabase = await createServerSupabase();
    const admin = createAdminSupabase();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user || !admin) return { ok: false, error: 'Unauthorized', status: 401, code: 'unauthorized' };
    await repairClientPortalAccessForUser(admin, user.id, user.email);
    const loaded = await loadClientPortalJobsExport({
      supabase,
      admin,
      userId: user.id,
      range: searchParams.get('range') || searchParams.get('period')
    });
    if (!loaded.ok) return loaded;
    return {
      ok: true,
      prepared: preparedFromColumns(CUSTOMER_JOBS_COLUMNS, loaded.data.rows, {
        filenamePrefix: 'my-jobs',
        title: copy.myJobHistory,
        companyName: loaded.data.companyName,
        appliedFilters: loaded.data.appliedFilters,
        summary: [{ label: copy.job, value: String(loaded.data.summary.jobCount) }]
      })
    };
  }

  if (resource === 'portal-contractor-jobs') {
    const supabase = await createServerSupabase();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Unauthorized', status: 401, code: 'unauthorized' };
    const loaded = await loadContractorPortalJobsExport({
      supabase,
      userId: user.id,
      email: user.email
    });
    if (!loaded.ok) return loaded;
    return {
      ok: true,
      prepared: preparedFromColumns(CONTRACTOR_JOBS_COLUMNS, loaded.data.rows, {
        filenamePrefix: 'my-jobs',
        title: copy.myAssignedJobs,
        companyName: loaded.data.companyName,
        appliedFilters: loaded.data.appliedFilters,
        summary: [{ label: copy.job, value: String(loaded.data.summary.jobCount) }]
      })
    };
  }

  if (resource === 'customers') {
    const ctx = await requireWorkspaceSession();
    if (!ctx.ok) return { ok: false, error: ctx.error, status: ctx.status, code: ctx.code };
    if (!isManagerRole(normalizeRole(ctx.workspace.role))) {
      return { ok: false, error: 'Forbidden', status: 403, code: 'forbidden' };
    }
    return fromLoaded(
      await loadCustomersExport({
        supabase: ctx.supabase,
        organizationId: ctx.workspace.organizationId,
        companyName: ctx.workspace.organizationName,
        searchParams,
        copy
      })
    );
  }

  const finance = await requireFinanceApiAccess();
  if (!finance.ok) return { ok: false, error: finance.error, status: finance.status, code: 'permission_denied' };
  const companyName = await organizationName(finance.supabase, finance.organizationId);
  const common = {
    supabase: finance.supabase,
    organizationId: finance.organizationId,
    companyName,
    searchParams,
    copy,
    locale
  };

  if (resource === 'expenses') return fromLoaded(await loadExpensesExport(common));
  if (resource === 'invoices') return fromLoaded(await loadInvoicesExport(common));
  if (resource === 'payments') return fromLoaded(await loadPaymentsExport(common));
  if (resource === 'contractor-pay') return fromLoaded(await loadContractorPayExport(common));
  if (resource === 'dashboard') return fromLoaded(await loadDashboardExport(common));
  if (resource === 'dashboard-details') return fromLoaded(await loadDashboardDetailsExport(common));
  if (resource === 'bookkeeping') return fromLoaded(await loadBookkeepingExport(common));

  return { ok: false, error: 'Unknown export.', status: 400, code: 'not_found' };
}
