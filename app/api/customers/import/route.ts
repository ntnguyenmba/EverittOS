import { NextResponse } from 'next/server';
import { buildCustomerWritePayload } from '@/lib/customer-record';
import {
  buildCustomerImportTemplateCsv,
  detectImportDuplicates,
  formattedAddressFromImportRow,
  parseCustomerImportCsv,
  type DuplicateDecision
} from '@/lib/customer-import';
import { buildPropertyWritePayload } from '@/lib/customer-property';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  return new NextResponse(buildCustomerImportTemplateCsv(), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="everittos-customer-import-template.csv"'
    }
  });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    csv?: string;
    preview?: boolean;
    decisions?: Record<string, DuplicateDecision>;
  };

  const csv = String(body.csv || '');
  if (!csv.trim()) {
    return NextResponse.json({ error: 'CSV content is required.' }, { status: 400 });
  }

  const parsed = parseCustomerImportCsv(csv);
  if (parsed.fatalError) {
    return NextResponse.json({ error: parsed.fatalError }, { status: 400 });
  }

  const { data: existing } = await ctx.supabase
    .from('customers')
    .select('id, company_name, email, phone, address_line1, service_address, property_address')
    .eq('organization_id', ctx.workspace.organizationId)
    .limit(5000);

  const rows = detectImportDuplicates(parsed.rows, existing || []);

  if (body.preview !== false && body.preview !== undefined ? body.preview : !body.decisions) {
    return NextResponse.json({
      preview: true,
      rows,
      summary: {
        total: rows.length,
        valid: rows.filter((r) => r.errors.length === 0).length,
        invalid: rows.filter((r) => r.errors.length > 0).length,
        duplicates: rows.filter((r) => r.duplicateOfCustomerId).length
      }
    });
  }

  const decisions = body.decisions || {};
  const createdCustomers: string[] = [];
  const mergedCustomers: string[] = [];
  const createdProperties: string[] = [];
  const skipped: number[] = [];
  const failed: Array<{ rowNumber: number; error: string }> = [];

  for (const row of rows) {
    const blockingErrors = row.errors.filter((e) => !e.includes('will be saved as Other'));
    if (blockingErrors.length) {
      failed.push({ rowNumber: row.rowNumber, error: blockingErrors.join(' ') });
      continue;
    }

    const decision: DuplicateDecision =
      row.duplicateOfCustomerId ? decisions[String(row.rowNumber)] || 'skip' : 'create';

    if (row.duplicateOfCustomerId && decision === 'skip') {
      skipped.push(row.rowNumber);
      continue;
    }

    try {
      let customerId = row.duplicateOfCustomerId || null;

      if (!customerId || decision === 'create') {
        const payload = buildCustomerWritePayload({
          displayName: row.company || row.customerName,
          email: row.email,
          phone: row.phone,
          address: formattedAddressFromImportRow(row),
          notes: row.notes,
          record_type: 'customer',
          pipeline_stage: 'active'
        });

        const { data: created, error } = await ctx.supabase
          .from('customers')
          .insert({
            ...payload,
            organization_id: ctx.workspace.organizationId,
            user_id: ctx.userId
          })
          .select('id')
          .single();

        if (error || !created) {
          failed.push({ rowNumber: row.rowNumber, error: error?.message || 'Unable to create customer.' });
          continue;
        }
        customerId = created.id as string;
        createdCustomers.push(customerId);
      } else if (decision === 'merge' && customerId) {
        const patch: Record<string, unknown> = {};
        if (row.email) patch.email = row.email;
        if (row.phone) patch.phone = row.phone;
        if (row.notes) patch.notes = row.notes;
        if (Object.keys(patch).length) {
          const { error } = await ctx.supabase
            .from('customers')
            .update(patch)
            .eq('id', customerId)
            .eq('organization_id', ctx.workspace.organizationId);
          if (error) {
            failed.push({ rowNumber: row.rowNumber, error: error.message });
            continue;
          }
        }
        mergedCustomers.push(customerId);
      }

      const formatted = formattedAddressFromImportRow(row);
      const resolvedCustomerId = customerId;
      if (resolvedCustomerId && (row.propertyName || formatted)) {
        const propertyPayload = buildPropertyWritePayload({
          name: row.propertyName || 'Imported property',
          property_type: row.propertyType,
          formatted_address: formatted,
          address_line_1: row.address,
          city: row.city,
          state: row.state,
          postal_code: row.zip,
          country: row.country,
          notes: row.notes,
          is_primary: false
        });

        const { data: property, error: propError } = await ctx.supabase
          .from('customer_properties')
          .insert({
            ...propertyPayload,
            organization_id: ctx.workspace.organizationId,
            customer_id: resolvedCustomerId,
            user_id: ctx.userId
          })
          .select('id')
          .single();

        if (propError) {
          if (isMissingSchemaError(propError)) {
            const legacy = await ctx.supabase
              .from('customer_properties')
              .insert({
                organization_id: ctx.workspace.organizationId,
                customer_id: resolvedCustomerId,
                user_id: ctx.userId,
                name: row.propertyName || 'Imported property',
                address: formatted,
                notes: row.notes
              })
              .select('id')
              .single();
            if (legacy.error || !legacy.data) {
              // Do not leave a silent partial import for brand-new customers without property intent.
              failed.push({ rowNumber: row.rowNumber, error: legacy.error?.message || propError.message });
              continue;
            }
            createdProperties.push(legacy.data.id);
          } else {
            failed.push({ rowNumber: row.rowNumber, error: propError.message });
            continue;
          }
        } else if (property) {
          createdProperties.push(property.id);
        }
      }
    } catch (error) {
      failed.push({
        rowNumber: row.rowNumber,
        error: error instanceof Error ? error.message : 'Unexpected import error.'
      });
    }
  }

  return NextResponse.json({
    preview: false,
    summary: {
      createdCustomers: createdCustomers.length,
      mergedCustomers: mergedCustomers.length,
      createdProperties: createdProperties.length,
      skipped: skipped.length,
      failed: failed.length
    },
    createdCustomers,
    mergedCustomers,
    createdProperties,
    skipped,
    failed
  });
}
