import { NextResponse } from 'next/server';
import {
  normalizeContractorClassification,
  parseHourlyRateInput,
  type ContractorClassification
} from '@/lib/contractor-compensation';
import { mapWorkspaceSaveError, workspaceScopedFields } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTRACTOR_FIELDS =
  'id, name, email, phone, company_name, hourly_rate, contractor_classification, active, worker_type, auth_user_id, created_at';

function isMissingCompanyId(message: string | null | undefined) {
  const lower = String(message || '').toLowerCase();
  return lower.includes('company_id') && (lower.includes('column') || lower.includes('schema cache') || lower.includes('could not find'));
}

export async function GET() {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { data, error } = await ctx.supabase
    .from('workers')
    .select(CONTRACTOR_FIELDS)
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('worker_type', 'contractor')
    .order('name');

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  return NextResponse.json({
    contractors: (data || []).map((row) => ({
      ...row,
      contractor_classification: normalizeContractorClassification(row.contractor_classification)
    }))
  });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    company_name?: string;
    hourlyRate?: string | number | null;
    hourly_rate?: string | number | null;
    contractorClassification?: string;
    contractor_classification?: string;
  };

  const name = body.name?.trim() || '';
  if (!name) {
    return NextResponse.json({ error: 'Contractor name is required.' }, { status: 400 });
  }

  const rateInput = body.hourlyRate ?? body.hourly_rate;
  const parsedRate = parseHourlyRateInput(rateInput);
  if (!parsedRate.ok) {
    return NextResponse.json({ error: parsedRate.error }, { status: 400 });
  }

  const classification: ContractorClassification = normalizeContractorClassification(
    body.contractorClassification ?? body.contractor_classification
  );

  const baseRow = {
    worker_type: 'contractor',
    contractor_classification: classification,
    name,
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
    company_name: (body.companyName ?? body.company_name)?.trim() || null,
    hourly_rate: parsedRate.value,
    active: true
  };

  const scoped = workspaceScopedFields(ctx.workspace, ctx.userId);
  let result = await ctx.supabase
    .from('workers')
    .insert({ ...scoped, ...baseRow })
    .select(CONTRACTOR_FIELDS)
    .single();

  if (result.error && isMissingCompanyId(result.error.message) && 'company_id' in scoped) {
    const { company_id: _companyId, ...compatibleScope } = scoped;
    result = await ctx.supabase
      .from('workers')
      .insert({ ...compatibleScope, ...baseRow })
      .select(CONTRACTOR_FIELDS)
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(result.error.message) }, { status: 400 });
  }

  return NextResponse.json({
    contractor: {
      ...result.data,
      contractor_classification: normalizeContractorClassification(result.data.contractor_classification)
    },
    message: 'Contractor added.'
  });
}
