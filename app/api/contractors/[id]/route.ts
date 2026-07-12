import { NextResponse } from 'next/server';
import {
  normalizeContractorClassification,
  parseHourlyRateInput,
  type ContractorClassification
} from '@/lib/contractor-compensation';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const CONTRACTOR_FIELDS =
  'id, name, email, phone, company_name, hourly_rate, contractor_classification, active, worker_type';

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;
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
    active?: boolean;
  };

  const { data: existing, error: readError } = await ctx.supabase
    .from('workers')
    .select('id, name, worker_type')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(readError.message) }, { status: 400 });
  }
  if (!existing || existing.worker_type !== 'contractor') {
    return NextResponse.json({ error: 'Contractor not found.' }, { status: 404 });
  }

  const payload: Record<string, string | number | boolean | null> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: 'Contractor name is required.' }, { status: 400 });
    }
    payload.name = name;
  }

  if (body.email !== undefined) payload.email = body.email?.trim() || null;
  if (body.phone !== undefined) payload.phone = body.phone?.trim() || null;
  if (body.companyName !== undefined || body.company_name !== undefined) {
    payload.company_name = (body.companyName ?? body.company_name)?.trim() || null;
  }

  if (body.hourlyRate !== undefined || body.hourly_rate !== undefined) {
    const parsedRate = parseHourlyRateInput(body.hourlyRate ?? body.hourly_rate);
    if (!parsedRate.ok) {
      return NextResponse.json({ error: parsedRate.error }, { status: 400 });
    }
    payload.hourly_rate = parsedRate.value;
  }

  if (body.contractorClassification !== undefined || body.contractor_classification !== undefined) {
    const classification: ContractorClassification = normalizeContractorClassification(
      body.contractorClassification ?? body.contractor_classification
    );
    payload.contractor_classification = classification;
  }

  if (body.active !== undefined) payload.active = Boolean(body.active);

  if (!Object.keys(payload).length) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('workers')
    .update(payload)
    .eq('id', id)
    .select(CONTRACTOR_FIELDS)
    .single();

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  return NextResponse.json({
    contractor: {
      ...data,
      contractor_classification: normalizeContractorClassification(data.contractor_classification)
    },
    message: 'Contractor updated.'
  });
}
