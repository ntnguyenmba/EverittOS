import type { SupabaseClient } from '@supabase/supabase-js';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { advanceNextRunOn, type RecurringInvoiceTemplate } from '@/lib/recurring-invoices';
import {
  calculateBalanceDue,
  calculateInvoicePaymentStatus
} from '@/lib/outbound/invoice-payment';

export type RunRecurringInvoiceResult = {
  ok: true;
  invoiceId: string;
  runId: string;
  deliveryMode: 'draft' | 'sent';
} | {
  ok: false;
  error: string;
};

export async function runRecurringInvoiceTemplate(input: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  template: RecurringInvoiceTemplate;
  runForDate?: string;
  sendEmail?: boolean;
}): Promise<RunRecurringInvoiceResult> {
  const { supabase, organizationId, userId, template } = input;
  const runForDate = input.runForDate || new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const amount = Math.max(0, Number(template.amount || 0));

  const { data: runRow, error: runError } = await supabase
    .from('recurring_invoice_runs')
    .insert({
      organization_id: organizationId,
      template_id: template.id,
      run_for_date: runForDate,
      status: 'processing'
    })
    .select('id')
    .single();

  if (runError || !runRow) {
    return { ok: false, error: runError?.message || 'Unable to create run record.' };
  }

  let recipientEmail: string | null = null;
  if (template.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('email')
      .eq('id', template.customer_id)
      .eq('organization_id', organizationId)
      .maybeSingle();
    recipientEmail = customer?.email?.trim() || null;
  }

  const paymentStatus = calculateInvoicePaymentStatus({ amount, amount_paid: 0 });
  const invoicePatch = {
    organization_id: organizationId,
    job_id: template.job_id,
    customer_id: template.customer_id,
    user_id: userId,
    amount,
    amount_paid: 0,
    balance_due: calculateBalanceDue(amount, 0),
    payment_status: paymentStatus,
    status: input.sendEmail ? 'sent' : 'draft',
    description: template.title,
    recipient_email: recipientEmail,
    invoice_date: runForDate,
    delivery_status: input.sendEmail ? 'sent' : 'draft',
    sent_at: input.sendEmail ? now : null
  };

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert(invoicePatch)
    .select('id')
    .single();

  if (invoiceError || !invoice) {
    await supabase
      .from('recurring_invoice_runs')
      .update({ status: 'failed' })
      .eq('id', runRow.id);
    return { ok: false, error: invoiceError?.message || 'Unable to create invoice.' };
  }

  const nextRun = advanceNextRunOn(template.cadence, runForDate);
  await supabase
    .from('recurring_invoice_templates')
    .update({ next_run_on: nextRun, updated_at: now })
    .eq('id', template.id)
    .eq('organization_id', organizationId);

  await supabase
    .from('recurring_invoice_runs')
    .update({ invoice_id: invoice.id, status: 'completed' })
    .eq('id', runRow.id);

  const outboundStatus = input.sendEmail ? 'sent' : 'draft';
  const outboundBase = {
    organization_id: organizationId,
    doc_type: 'invoice' as const,
    status: outboundStatus,
    recipient_email: recipientEmail,
    subject: template.title,
    body: template.title,
    amount,
    customer_id: template.customer_id,
    job_id: template.job_id,
    source_entity_type: 'invoice',
    source_entity_id: invoice.id,
    created_by: userId,
    metadata: {
      recurring_template_id: template.id,
      recurring_run_id: runRow.id
    }
  };

  const { error: outboundError } = await supabase.from('outbound_documents').insert({
    ...outboundBase,
    amount_paid: 0,
    balance_due: calculateBalanceDue(amount, 0),
    payment_status: paymentStatus,
    invoice_date: runForDate
  });

  if (outboundError) {
    await supabase.from('outbound_documents').insert(outboundBase);
  }

  await logWorkspaceActivity(
    organizationId,
    userId,
    'invoice',
    invoice.id,
    'invoice_created',
    `Recurring invoice generated: ${template.title}`,
    { recurring_template_id: template.id, recurring_run_id: runRow.id }
  );

  return {
    ok: true,
    invoiceId: invoice.id,
    runId: runRow.id,
    deliveryMode: input.sendEmail ? 'sent' : 'draft'
  };
}

export async function processDueRecurringTemplates(input: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  asOfDate?: string;
}): Promise<{ processed: number; errors: string[] }> {
  const asOf = input.asOfDate || new Date().toISOString().slice(0, 10);
  const { data: templates } = await input.supabase
    .from('recurring_invoice_templates')
    .select('*')
    .eq('organization_id', input.organizationId)
    .eq('active', true)
    .lte('next_run_on', asOf);

  let processed = 0;
  const errors: string[] = [];

  for (const template of templates || []) {
    const result = await runRecurringInvoiceTemplate({
      supabase: input.supabase,
      organizationId: input.organizationId,
      userId: input.userId,
      template: template as RecurringInvoiceTemplate,
      runForDate: template.next_run_on || asOf,
      sendEmail: false
    });
    if (result.ok) {
      processed += 1;
    } else {
      errors.push(result.error);
    }
  }

  return { processed, errors };
}
