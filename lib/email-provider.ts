/**
 * Provider-ready email architecture.
 * Auth email: Supabase Auth only.
 * Transactional email: optional Resend via fetch (no npm dependency).
 */

export type EmailSendResult = {
  sent: boolean;
  provider: 'resend' | 'none';
  id?: string;
  error?: string;
};

export type TransactionalEmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

export type TransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: TransactionalEmailAttachment[];
};

function resendReady(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

function cleanProviderError(errorText: string): string {
  const normalized = errorText.toLowerCase();

  if (normalized.includes('domain is not verified') || normalized.includes('resend.com/domains') || normalized.includes('validation_error')) {
    return 'Email could not be sent because the sending domain is not verified in Resend. Verify everittventures.com in Resend Domains, then try again.';
  }

  if (normalized.includes('api key') || normalized.includes('unauthorized') || normalized.includes('forbidden')) {
    return 'Email could not be sent because the email provider is not configured correctly. Check RESEND_API_KEY and EMAIL_FROM in Vercel.';
  }

  return 'Email could not be sent. Check the email provider settings, then try again.';
}

export function emailProviderName(): 'resend' | 'supabase-auth-only' {
  return resendReady() ? 'resend' : 'supabase-auth-only';
}

export function transactionalEmailConfigured(): boolean {
  return resendReady();
}

/** Send transactional email when Resend is configured. Never blocks app flows. */
export async function sendTransactionalEmail(input: TransactionalEmailInput): Promise<EmailSendResult> {
  if (!resendReady()) {
    return { sent: false, provider: 'none', error: 'Email is not configured yet. Check RESEND_API_KEY and EMAIL_FROM in Vercel.' };
  }

  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from = process.env.EMAIL_FROM!.trim();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        content_type: attachment.contentType
      }))
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    return { sent: false, provider: 'resend', error: cleanProviderError(errText) };
  }

  const json = (await res.json()) as { id?: string };
  return { sent: true, provider: 'resend', id: json.id };
}
