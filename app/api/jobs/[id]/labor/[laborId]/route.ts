import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { buildLaborRow } from '@/lib/finance-server';
import { isValidUuid } from '@/lib/input-validation';

const PAYMENT_STATUSES = new Set(['unpaid', 'pending', 'paid']);
const PAYMENT_METADATA_FIELDS = ['paid_at', 'payment_method', 'payment_reference'];

type RouteParams = { params: Promise<{ id: string; laborId: string }> };

function cleanOptionalText(value: unknown, max = 240): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

function missingColumnName(message?: string | null): string | null {
  if (!message) return null;
  const match = message.match(/Could not find the '([^']+)' column/i) || message.match(/column ["']?([^"'\s]+)["']? does not exist/i);
  return match?.[1] || null;
}

function contractorPaymentMigrationMessage() {
  return 'Contractor payment tracking needs the latest database migration. Contractor pay amounts can still be edited, but paid, pending, method, and reference tracking will be unavailable until the migration is applied.';
}

async function resolveLaborWorkerId(
  ctx: Awaited<ReturnType<typeof requireFinanceApiAccess>>,
  jobId: string,
  laborId: string
): Promise<{ workerId: string | null; error: string | null }> {
  if (!ctx.ok) return { workerId: null, error: 'Unable to verify contractor' };

  const { data: laborRow, error: laborError } = await ctx.supabase
    .from('job_labor')
    .select('worker_id, worker_name')
    .eq('id', laborId)
    .eq('job_id', jobId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (laborError || !laborRow) {
    return { workerId: null, error: laborError?.message || 'Contractor pay not found' };
  }

  if (laborRow.worker_id) return { workerId: String(laborRow.worker_id), error: null };

  const workerName = String(laborRow.worker_name || '').trim();
  if (!workerName) {
    return { workerId: null, error: 'Select the contractor before marking this payment paid' };
  }

  const { data: workers, error: workerError } = await ctx.supabase
    .from('workers')
    .select('id')
    .eq('organization_id', ctx.organizationId)
    .ilike('name', workerName)
    .limit(2);

  if (workerError || !workers || workers.length !== 1) {
    return {
      workerId: null,
      error: 'This payment is not linked to one contractor. Edit the contractor pay entry and select the contractor first.'
    };
  }

  return { workerId: String(workers[0].id), error: null };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id: jobId, laborId } = await params;
  if (!isValidUuid(jobId) || !isValidUuid(laborId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json();
  const patch: Record<string, unknown> = {};

  if (body.worker_id !== undefined) patch.worker_id = body.worker_id || null;
  if (body.worker_name !== undefined) patch.worker_name = body.worker_name?.trim() || null;
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;

  if (body.payment_status !== undefined) {
    const paymentStatus = String(body.payment_status).toLowerCase();
    if (!PAYMENT_STATUSES.has(paymentStatus)) {
      return NextResponse.json({ error: 'Invalid contractor payment status' }, { status: 400 });
    }

    if (paymentStatus === 'paid' && body.worker_id === undefined) {
      const resolvedWorker = await resolveLaborWorkerId(ctx, jobId, laborId);
      if (!resolvedWorker.workerId) {
        return NextResponse.json({ error: resolvedWorker.error }, { status: 400 });
      }
      patch.worker_id = resolvedWorker.workerId;
    }

    patch.payment_status = paymentStatus;
    patch.paid_at = paymentStatus === 'paid' ? body.paid_at || new Date().toISOString() : null;
  } else if (body.paid_at !== undefined) {
    patch.paid_at = body.paid_at || null;
  }

  if (body.payment_method !== undefined) {
    patch.payment_method = cleanOptionalText(body.payment_method, 80);
  }
  if (body.payment_reference !== undefined) {
    patch.payment_reference = cleanOptionalText(body.payment_reference, 240);
  }

  if (
    body.hours !== undefined ||
    body.hourly_cost !== undefined ||
    body.hourlyCost !== undefined ||
    body.payment_basis !== undefined ||
    body.paymentBasis !== undefined
  ) {
    const { data: existing, error: existingError } = await ctx.supabase
      .from('job_labor')
      .select('hours, hourly_cost')
      .eq('id', laborId)
      .eq('job_id', jobId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Contractor pay not found' }, { status: 404 });
    }

    const paymentBasis = body.payment_basis ?? body.paymentBasis ?? 'hourly';
    const labor = buildLaborRow({
      hours: paymentBasis === 'flat' ? 1 : body.hours ?? existing.hours,
      hourlyCost: body.hourly_cost ?? body.hourlyCost ?? existing.hourly_cost,
      paymentBasis
    });
    patch.hours = labor.hours;
    patch.hourly_cost = labor.hourly_cost;
    patch.total_cost = labor.total_cost;
    patch.payment_basis = labor.payment_basis;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No contractor pay changes provided' }, { status: 400 });
  }

  const updateLabor = (changes: Record<string, unknown>) =>
    ctx.supabase
      .from('job_labor')
      .update(changes)
      .eq('id', laborId)
      .eq('job_id', jobId)
      .eq('organization_id', ctx.organizationId)
      .select('*')
      .single();

  let result = await updateLabor(patch);
  let migrationWarning: string | null = null;

  if (result.error) {
    const missingColumn = missingColumnName(result.error.message);

    if (missingColumn === 'payment_basis') {
      const fallbackPatch = { ...patch };
      delete fallbackPatch.payment_basis;
      result = await updateLabor(fallbackPatch);
      migrationWarning = migrationWarning || 'Contractor payment basis will be available after the latest database migration.';
    } else if (missingColumn && PAYMENT_METADATA_FIELDS.includes(missingColumn)) {
      const fallbackPatch = { ...patch };
      for (const field of PAYMENT_METADATA_FIELDS) delete fallbackPatch[field];
      delete fallbackPatch.payment_basis;

      if (Object.keys(fallbackPatch).length === 0) {
        return NextResponse.json(
          {
            error: contractorPaymentMigrationMessage(),
            code: 'CONTRACTOR_PAYMENT_MIGRATION_REQUIRED',
            missingColumn
          },
          { status: 409 }
        );
      }

      result = await updateLabor(fallbackPatch);
      migrationWarning = contractorPaymentMigrationMessage();
    }
  }

  if (result.error) {
    const missingColumn = missingColumnName(result.error.message);
    if (missingColumn === 'payment_status' || (missingColumn && PAYMENT_METADATA_FIELDS.includes(missingColumn))) {
      return NextResponse.json(
        {
          error: contractorPaymentMigrationMessage(),
          code: 'CONTRACTOR_PAYMENT_MIGRATION_REQUIRED',
          missingColumn
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({
    labor: result.data,
    migrationWarning,
    paymentTrackingAvailable: !migrationWarning
  });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id: jobId, laborId } = await params;
  if (!isValidUuid(jobId) || !isValidUuid(laborId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const { error } = await ctx.supabase
    .from('job_labor')
    .delete()
    .eq('id', laborId)
    .eq('job_id', jobId)
    .eq('organization_id', ctx.organizationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
