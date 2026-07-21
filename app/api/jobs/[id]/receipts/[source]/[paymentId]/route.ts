import { CUSTOMER_ADDRESS_FIELDS } from '@/lib/customer-record';
import { fetchJobPaymentHistory } from '@/lib/finance/job-payments';
import { fetchJobProfitability } from '@/lib/finance-server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { isValidUuid } from '@/lib/input-validation';
import { buildPaymentReceiptView } from '@/lib/payment-receipt';
import { createSimplePdf } from '@/lib/simple-pdf';

type RouteContext = {
  params: Promise<{ id: string; source: string; paymentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id: jobId, source, paymentId } = await context.params;

  if (!isValidUuid(jobId) || !isValidUuid(paymentId) || !['job', 'invoice'].includes(source)) {
    return Response.json({ error: 'Receipt not found.' }, { status: 404 });
  }

  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const customerSelect = `id, company_name, email, phone, ${CUSTOMER_ADDRESS_FIELDS}`;
  const [{ data: job }, history, profitability, orgRes, settingsRes] = await Promise.all([
    ctx.supabase
      .from('jobs')
      .select(`id, title, address, customer_name, phone, customer_id, customers(${customerSelect})`)
      .eq('id', jobId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle(),
    fetchJobPaymentHistory(ctx.supabase, ctx.organizationId, jobId),
    fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId),
    ctx.supabase.from('organizations').select('name').eq('id', ctx.organizationId).maybeSingle(),
    ctx.supabase
      .from('organization_settings')
      .select('company_phone, company_email, company_address, website')
      .eq('organization_id', ctx.organizationId)
      .maybeSingle()
  ]);

  if (!job) return Response.json({ error: 'Receipt not found.' }, { status: 404 });

  const payment = history.payments.find((entry) => entry.id === paymentId && entry.source === source);
  if (!payment) return Response.json({ error: 'Receipt not found.' }, { status: 404 });

  const customerRelation = job.customers as Record<string, unknown> | Record<string, unknown>[] | null;
  const linkedCustomer = Array.isArray(customerRelation) ? customerRelation[0] : customerRelation;

  const receipt = buildPaymentReceiptView({
    payment: {
      id: payment.id,
      amount: payment.amount,
      paidAt: payment.paidAt,
      paymentMethod: payment.paymentMethod,
      paymentReference: payment.paymentReference,
      notes: payment.notes,
      source: payment.source
    },
    job: {
      title: job.title,
      customer_name: job.customer_name,
      phone: job.phone,
      address: job.address
    },
    linkedCustomer: linkedCustomer as {
      company_name?: string | null;
      email?: string | null;
      phone?: string | null;
      address_line1?: string | null;
      address_line2?: string | null;
      city?: string | null;
      state?: string | null;
      postal_code?: string | null;
      country?: string | null;
      service_address?: string | null;
      property_address?: string | null;
    } | null,
    business: {
      companyName: orgRes.data?.name || null,
      phone: settingsRes.data?.company_phone || null,
      email: settingsRes.data?.company_email || null,
      website: settingsRes.data?.website || null,
      address: settingsRes.data?.company_address || null
    },
    outstanding: profitability.outstanding || 0
  });

  const pdf = createSimplePdf([
    ...(receipt.businessName ? [{ text: receipt.businessName, size: 16, bold: true, gapAfter: 2 }] : []),
    ...receipt.businessLines.map((line) => ({ text: line, size: 9 })),
    { text: 'PAYMENT RECEIPT', size: 10, bold: true, gapAfter: 4 },
    { text: receipt.receiptNumber, size: 18, bold: true },
    { text: receipt.paidOnLabel, size: 10, gapAfter: 10 },
    { text: `${receipt.amountPaidLabel}: ${receipt.amountPaidValue}`, size: 16, bold: true, gapAfter: 12 },
    { text: receipt.customerHeading, size: 12, bold: true },
    ...receipt.customerLines.map((line) => ({ text: line, size: 10 })),
    { text: 'Receipt details', size: 12, bold: true, gapAfter: 2 },
    ...receipt.receiptDetails.map((row) => ({ text: `${row.label}: ${row.value}`, size: 10 })),
    ...(receipt.paidInFull ? [{ text: 'Paid in full', size: 10, bold: true, gapAfter: 8 }] : []),
    { text: receipt.thankYou, size: 11, bold: true },
    { text: receipt.keepCopy, size: 9 }
  ]);

  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${receipt.receiptNumber}.pdf"`,
      'Cache-Control': 'private, no-store'
    }
  });
}
