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

export type TransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function resendReady(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
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
    return { sent: false, provider: 'none' };
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
      text: input.text
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    return { sent: false, provider: 'resend', error: errText.slice(0, 200) };
  }

  const json = (await res.json()) as { id?: string };
  return { sent: true, provider: 'resend', id: json.id };
}
