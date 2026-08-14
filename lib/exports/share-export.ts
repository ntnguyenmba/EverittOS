import { sendTransactionalEmail } from '@/lib/email-provider';
import { isValidEmail, normalizeEmail } from '@/lib/input-validation';
import { buildExportAttachment, shareEmailCopy, type PreparedExport } from '@/lib/exports/prepared';
import type { ExportCopy } from '@/lib/i18n/export-copy';

export async function sendPreparedExportEmail(input: {
  to: string;
  format: 'csv' | 'pdf';
  prepared: PreparedExport;
  copy: ExportCopy;
}): Promise<{ ok: true } | { ok: false; error: string; status: number; code: string }> {
  const email = normalizeEmail(input.to);
  if (!isValidEmail(email)) {
    return { ok: false, error: input.copy.invalidEmail, status: 400, code: 'invalid_email' };
  }

  const attachment = buildExportAttachment(input.prepared, input.format, input.copy);
  const message = shareEmailCopy(input.prepared, input.copy);
  const result = await sendTransactionalEmail({
    to: email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    attachments: [
      {
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType
      }
    ]
  });

  if (!result.sent) {
    const notConfigured = /not configured/i.test(result.error || '');
    return {
      ok: false,
      error: notConfigured ? input.copy.emailNotConfigured : input.copy.shareFailed,
      status: 503,
      code: notConfigured ? 'email_failed' : 'send_failed'
    };
  }

  return { ok: true };
}
