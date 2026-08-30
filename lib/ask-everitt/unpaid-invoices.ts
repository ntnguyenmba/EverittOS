import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCurrency } from '@/lib/dashboard-metrics';
import { buildRecord, response } from '@/lib/ask-everitt/search-helpers';
import type { AskEverittSearchRecord, AskEverittSearchResponse } from '@/lib/ask-everitt/types';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

const CLOSED = new Set(['paid', 'void', 'cancelled', 'canceled', 'written_off', 'write_off']);

function owed(amount?: number | null, paid?: number | null): number {
  return Math.max(0, Number(amount || 0) - Number(paid || 0));
}

function isOpenInvoice(status?: string | null, amount?: number | null, paid?: number | null, paymentStatus?: string | null): boolean {
  const pay = String(paymentStatus || status || '').toLowerCase();
  if (CLOSED.has(pay) || pay === 'paid_in_full') return false;
  return owed(amount, paid) > 0 || ['sent', 'open', 'overdue', 'unpaid', 'past_due', 'partial', 'draft', 'scheduled', 'viewed', 'issued'].includes(pay);
}

export async function queryUnpaidInvoices(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const results: AskEverittSearchRecord[] = [];
  const seen = new Set<string>();

  const table = await supabase
    .from('invoices')
    .select('id, amount, amount_paid, status, due_date, description')
    .eq('organization_id', orgId)
    .limit(500);

  if (!table.error) {
    for (const inv of table.data || []) {
      if (!isOpenInvoice(inv.status, inv.amount, inv.amount_paid)) continue;
      const balance = owed(inv.amount, inv.amount_paid);
      seen.add(inv.id);
      results.push(
        buildRecord('invoices', {
          id: inv.id,
          title: inv.description || `Invoice ${formatCurrency(Number(inv.amount || 0))}`,
          subtitle: balance > 0 ? `${formatCurrency(balance)} outstanding` : null,
          status: inv.status || 'unpaid',
          date: inv.due_date,
          href: `/invoices?invoiceId=${inv.id}`
        })
      );
    }
  } else if (!isMissingSchemaError(table.error)) {
    // Keep going; outbound invoices are the live source in the app.
  }

  const outbound = await supabase
    .from('outbound_documents')
    .select('id, subject, recipient_name, amount, amount_paid, balance_due, payment_status, status, due_date, created_at')
    .eq('organization_id', orgId)
    .eq('doc_type', 'invoice')
    .limit(500);

  if (!outbound.error) {
    for (const doc of outbound.data || []) {
      if (seen.has(doc.id)) continue;
      const paid = doc.amount_paid;
      const balance = doc.balance_due != null ? Number(doc.balance_due) : owed(doc.amount, paid);
      if (!isOpenInvoice(doc.status, doc.amount, paid, doc.payment_status) && !(balance > 0)) continue;
      if (balance <= 0 && String(doc.payment_status || '').toLowerCase() === 'paid') continue;
      results.push(
        buildRecord('invoices', {
          id: doc.id,
          title: doc.subject || doc.recipient_name || `Invoice ${formatCurrency(Number(doc.amount || 0))}`,
          subtitle: balance > 0 ? `${formatCurrency(balance)} outstanding` : doc.recipient_name,
          status: doc.payment_status || doc.status || 'unpaid',
          date: doc.due_date || doc.created_at?.slice?.(0, 10) || null,
          href: `/invoices?invoiceId=${doc.id}`
        })
      );
    }
  }

  return response(
    results.length > 0
      ? `${results.length} unpaid or outstanding invoice${results.length === 1 ? '' : 's'}.`
      : 'No unpaid invoices found.',
    results.slice(0, 40),
    {
      sourcesUsed: ['invoices'],
      noResultsHint: results.length === 0 ? 'Open Invoices to confirm a document still has a balance due.' : undefined
    }
  );
}
