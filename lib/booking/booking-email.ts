import { sendTransactionalEmail, transactionalEmailConfigured } from '@/lib/email-provider';
import { formatBookingWhen } from '@/lib/booking/index';
import { generateBookingIcs } from '@/lib/booking/ics';
import { SUPPORT_EMAIL } from '@/lib/support';

export type CustomerConfirmationEmailInput = {
  to: string;
  businessName: string;
  clientName: string;
  appointmentName: string;
  startsAt: string;
  endsAt: string;
  staffName?: string | null;
  notes?: string | null;
  bookingId: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

export type StaffNotificationEmailInput = {
  to: string;
  businessName: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  appointmentName: string;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
  bookingUrl?: string | null;
  source: string;
};

export function buildCustomerBookingConfirmationEmail(input: CustomerConfirmationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const when = formatBookingWhen(input.startsAt, input.endsAt);
  const staffLine = input.staffName?.trim() ? `<p><strong>Staff:</strong> ${input.staffName.trim()}</p>` : '';
  const notesLine = input.notes?.trim() ? `<p><strong>Notes:</strong> ${input.notes.trim()}</p>` : '';
  const contactLines = [
    input.contactPhone?.trim() ? `<p>Phone: ${input.contactPhone.trim()}</p>` : '',
    input.contactEmail?.trim() ? `<p>Email: ${input.contactEmail.trim()}</p>` : '',
    `<p>Questions? Contact ${input.businessName}${input.contactEmail ? ` at ${input.contactEmail}` : ` at ${SUPPORT_EMAIL}`}.</p>`
  ].join('');

  const subject = `Booking confirmed — ${input.appointmentName} with ${input.businessName}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
      <h2 style="margin:0 0 12px;">Your booking is confirmed</h2>
      <p>Hi ${input.clientName},</p>
      <p>Thank you for booking with <strong>${input.businessName}</strong>.</p>
      <p><strong>Appointment:</strong> ${input.appointmentName}</p>
      <p><strong>When:</strong> ${when}</p>
      ${staffLine}
      ${notesLine}
      ${contactLines}
      <p style="color:#666;font-size:13px;">If you need to change or cancel, please contact ${input.businessName} directly.</p>
    </div>
  `.trim();

  const text = [
    `Hi ${input.clientName},`,
    '',
    `Your booking with ${input.businessName} is confirmed.`,
    `Appointment: ${input.appointmentName}`,
    `When: ${when}`,
    input.staffName?.trim() ? `Staff: ${input.staffName.trim()}` : '',
    input.notes?.trim() ? `Notes: ${input.notes.trim()}` : '',
    '',
    'If you need to change or cancel, please contact the business directly.'
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

export function buildStaffBookingNotificationEmail(input: StaffNotificationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const when = formatBookingWhen(input.startsAt, input.endsAt);
  const subject = `New booking — ${input.clientName} · ${input.appointmentName}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
      <h2 style="margin:0 0 12px;">New booking assigned</h2>
      <p><strong>Customer:</strong> ${input.clientName}</p>
      ${input.clientPhone?.trim() ? `<p><strong>Phone:</strong> ${input.clientPhone.trim()}</p>` : ''}
      ${input.clientEmail?.trim() ? `<p><strong>Email:</strong> ${input.clientEmail.trim()}</p>` : ''}
      <p><strong>Appointment:</strong> ${input.appointmentName}</p>
      <p><strong>When:</strong> ${when}</p>
      ${input.notes?.trim() ? `<p><strong>Notes:</strong> ${input.notes.trim()}</p>` : ''}
      <p><strong>Source:</strong> ${input.source}</p>
      ${input.bookingUrl ? `<p><a href="${input.bookingUrl}">View bookings in EverittOS</a></p>` : ''}
    </div>
  `.trim();

  const text = [
    'New booking assigned',
    `Customer: ${input.clientName}`,
    input.clientPhone?.trim() ? `Phone: ${input.clientPhone.trim()}` : '',
    input.clientEmail?.trim() ? `Email: ${input.clientEmail.trim()}` : '',
    `Appointment: ${input.appointmentName}`,
    `When: ${when}`,
    input.notes?.trim() ? `Notes: ${input.notes.trim()}` : '',
    `Source: ${input.source}`,
    input.bookingUrl ? `Bookings: ${input.bookingUrl}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

export function buildCustomerConfirmationIcs(input: CustomerConfirmationEmailInput): string {
  return generateBookingIcs({
    uid: input.bookingId,
    title: `${input.appointmentName} — ${input.businessName}`,
    description: [
      `Customer: ${input.clientName}`,
      input.staffName?.trim() ? `Staff: ${input.staffName.trim()}` : '',
      input.notes?.trim() ? `Notes: ${input.notes.trim()}` : ''
    ]
      .filter(Boolean)
      .join('\n'),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    organizerName: input.businessName,
    organizerEmail: input.contactEmail || undefined
  });
}

export async function sendCustomerBookingConfirmation(
  input: CustomerConfirmationEmailInput
): Promise<{ sent: boolean; warning?: string }> {
  if (!input.to.trim()) {
    return { sent: false, warning: 'No customer email provided.' };
  }
  if (!transactionalEmailConfigured()) {
    return { sent: false, warning: 'Email is not configured. Confirmation was not sent.' };
  }

  const email = buildCustomerBookingConfirmationEmail(input);
  const result = await sendTransactionalEmail({
    to: input.to.trim(),
    subject: email.subject,
    html: email.html,
    text: email.text
  });

  if (!result.sent) {
    return { sent: false, warning: result.error || 'Confirmation email could not be sent.' };
  }
  return { sent: true };
}

export async function sendStaffBookingNotification(
  input: StaffNotificationEmailInput
): Promise<{ sent: boolean; warning?: string }> {
  if (!input.to.trim()) {
    return { sent: false };
  }
  if (!transactionalEmailConfigured()) {
    return { sent: false, warning: 'Email is not configured. Staff notification was not sent.' };
  }

  const email = buildStaffBookingNotificationEmail(input);
  const result = await sendTransactionalEmail({
    to: input.to.trim(),
    subject: email.subject,
    html: email.html,
    text: email.text
  });

  if (!result.sent) {
    return { sent: false, warning: result.error || 'Staff notification could not be sent.' };
  }
  return { sent: true };
}
