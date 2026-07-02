import { sendTransactionalEmail, transactionalEmailConfigured } from '@/lib/email-provider';

export type CustomerMessageThread = {
  id: string;
  organization_id: string;
  customer_id: string | null;
  job_id: string | null;
  subject: string | null;
  status: string;
  last_message_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerMessage = {
  id: string;
  organization_id: string;
  thread_id: string;
  customer_id: string | null;
  direction: string;
  sender_email: string | null;
  recipient_email: string | null;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

export function customerMessageEmailHtml(input: { body: string; organizationName: string }): string {
  const escaped = input.body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
  return `<p>${escaped}</p><p style="color:#64748b;font-size:12px;">Sent via ${input.organizationName} on EverittOS.</p>`;
}

export async function sendCustomerMessageEmail(input: {
  to: string;
  subject: string;
  body: string;
  organizationName: string;
}): Promise<{ sent: boolean; error?: string }> {
  if (!transactionalEmailConfigured()) {
    return { sent: false, error: 'Email is not configured yet. Add RESEND_API_KEY and EMAIL_FROM, then verify your sending domain in Resend.' };
  }

  const result = await sendTransactionalEmail({
    to: input.to,
    subject: input.subject,
    html: customerMessageEmailHtml({ body: input.body, organizationName: input.organizationName }),
    text: input.body
  });

  if (!result.sent) {
    return { sent: false, error: result.error || 'Email could not be sent. Check your email provider settings.' };
  }

  return { sent: true };
}
