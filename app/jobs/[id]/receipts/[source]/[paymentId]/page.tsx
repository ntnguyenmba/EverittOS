import { notFound } from 'next/navigation';
import { ReceiptActions } from '@/components/receipt-actions';
import { CUSTOMER_ADDRESS_FIELDS } from '@/lib/customer-record';
import { fetchJobPaymentHistory } from '@/lib/finance/job-payments';
import { fetchJobProfitability } from '@/lib/finance-server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { getReceiptCopy } from '@/lib/i18n/receipt-copy';
import { isValidUuid } from '@/lib/input-validation';
import { buildPaymentReceiptView } from '@/lib/payment-receipt';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string; source: string; paymentId: string }>;
};

export default async function PaymentReceiptPage({ params }: PageProps) {
  const { id: jobId, source, paymentId } = await params;
  if (!isValidUuid(jobId) || !isValidUuid(paymentId) || !['job', 'invoice'].includes(source)) {
    notFound();
  }

  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) notFound();

  const customerSelect = `id, company_name, email, phone, ${CUSTOMER_ADDRESS_FIELDS}`;

  const [{ data: job }, history, profitability, orgRes, settingsRes, profileRes] = await Promise.all([
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
      .maybeSingle(),
    ctx.supabase.from('profiles').select('locale').eq('id', ctx.userId).maybeSingle()
  ]);

  if (!job) notFound();

  const payment = history.payments.find((entry) => entry.id === paymentId && entry.source === source);
  if (!payment) notFound();

  const customerRelation = job.customers as Record<string, unknown> | Record<string, unknown>[] | null;
  const linkedCustomer = Array.isArray(customerRelation) ? customerRelation[0] : customerRelation;
  const receiptLocale = profileRes.data?.locale || 'en';
  const receiptCopy = getReceiptCopy(receiptLocale);

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
    quotedPrice: profitability.manualRevenue || profitability.invoiceTotal || profitability.expectedAmount || 0,
    outstanding: profitability.outstanding || 0,
    locale: receiptLocale,
    copy: receiptCopy
  });

  return (
    <main className="receipt-page">
      <ReceiptActions
        jobId={jobId}
        source={source}
        paymentId={paymentId}
        receiptNumber={receipt.receiptNumber}
      />

      <article className="receipt-card">
        <header className="receipt-header">
          {receipt.businessName ? <p className="receipt-business-name">{receipt.businessName}</p> : null}
          {receipt.businessLines.length ? (
            <p className="receipt-business-meta">{receipt.businessLines.join(' · ')}</p>
          ) : null}
          <p className="receipt-eyebrow">{receiptCopy.title}</p>
          <h1 className="receipt-number">{receipt.receiptNumber}</h1>
          <p className="receipt-paid-on">{receipt.paidOnLabel}</p>
        </header>

        <section className="receipt-amount-block" aria-label={receipt.amountPaidLabel}>
          <span className="receipt-amount-label">{receipt.amountPaidLabel}</span>
          <strong className="receipt-amount-value">{receipt.amountPaidValue}</strong>
        </section>

        <section className="receipt-section">
          <h2>{receipt.customerHeading}</h2>
          <div className="receipt-customer-lines">
            {receipt.customerLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>

        <section className="receipt-section">
          <h2>{receiptCopy.detailsHeading}</h2>
          <dl className="receipt-details">
            {receipt.receiptDetails.map((row) => (
              <div key={row.label} className="receipt-detail-row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          {receipt.paidInFull ? <p className="receipt-status-pill">{receiptCopy.paidInFull}</p> : null}
        </section>

        <footer className="receipt-footer">
          <p>{receipt.thankYou}</p>
          <p>{receipt.keepCopy}</p>
        </footer>
      </article>
    </main>
  );
}
