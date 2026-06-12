import type { OutboundDocument } from '@/lib/outbound/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function syncOutboundEntityOnSend(input: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  document: OutboundDocument;
}): Promise<void> {
  const { supabase, organizationId, userId, document } = input;
  const now = new Date().toISOString();

  if (document.doc_type === 'review') {
    if (document.source_entity_id) {
      await supabase
        .from('review_requests')
        .update({
          status: 'sent',
          sent_at: now,
          customer_email: document.recipient_email,
          message: document.body,
          updated_at: now
        })
        .eq('id', document.source_entity_id)
        .eq('organization_id', organizationId);
      return;
    }

    const { data } = await supabase
      .from('review_requests')
      .insert({
        organization_id: organizationId,
        job_id: document.job_id,
        customer_id: document.customer_id,
        customer_email: document.recipient_email,
        message: document.body,
        status: 'sent',
        sent_at: now,
        created_by: userId
      })
      .select('id')
      .single();

    if (data?.id) {
      await supabase
        .from('outbound_documents')
        .update({
          source_entity_type: 'review_request',
          source_entity_id: data.id
        })
        .eq('id', document.id);
    }
    return;
  }

  if (document.doc_type === 'proposal' || document.doc_type === 'estimate') {
    const title = document.subject?.trim() || (document.doc_type === 'proposal' ? 'Proposal' : 'Estimate');
    if (document.source_entity_id) {
      await supabase
        .from('proposals')
        .update({
          title,
          body: document.body,
          amount: document.amount,
          status: 'sent',
          sent_at: now,
          recipient_email: document.recipient_email,
          updated_at: now
        })
        .eq('id', document.source_entity_id)
        .eq('organization_id', organizationId);
      return;
    }

    const { data } = await supabase
      .from('proposals')
      .insert({
        organization_id: organizationId,
        customer_id: document.customer_id,
        job_id: document.job_id,
        title,
        body: document.body,
        amount: document.amount,
        status: 'sent',
        sent_at: now,
        recipient_email: document.recipient_email,
        created_by: userId
      })
      .select('id')
      .single();

    if (data?.id) {
      await supabase
        .from('outbound_documents')
        .update({
          source_entity_type: 'proposal',
          source_entity_id: data.id,
          metadata: { ...document.metadata, estimate: document.doc_type === 'estimate' }
        })
        .eq('id', document.id);
    }
    return;
  }

  if (document.doc_type === 'invoice') {
    const amount = Number(document.amount || 0);
    if (document.source_entity_id) {
      const invoicePatch: Record<string, unknown> = {
        description: document.body,
        status: 'sent',
        sent_at: now,
        recipient_email: document.recipient_email,
        delivery_status: 'sent',
        updated_at: now
      };
      if (amount > 0) invoicePatch.amount = amount;
      await supabase
        .from('invoices')
        .update(invoicePatch)
        .eq('id', document.source_entity_id)
        .eq('organization_id', organizationId);
      return;
    }

    if (amount <= 0) return;

    const { data } = await supabase
      .from('invoices')
      .insert({
        organization_id: organizationId,
        job_id: document.job_id,
        customer_id: document.customer_id,
        user_id: userId,
        amount,
        amount_paid: 0,
        status: 'sent',
        description: document.body,
        recipient_email: document.recipient_email,
        sent_at: now,
        delivery_status: 'sent',
        invoice_date: now.slice(0, 10)
      })
      .select('id')
      .single();

    if (data?.id) {
      await supabase
        .from('outbound_documents')
        .update({
          source_entity_type: 'invoice',
          source_entity_id: data.id
        })
        .eq('id', document.id);
    }
  }
}
