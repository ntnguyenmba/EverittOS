import { notFound } from 'next/navigation';
import { ReceiptActions } from '@/components/receipt-actions';
import { fetchJobPaymentHistory } from '@/lib/finance/job-payments';
import { fetchJobProfitability } from '@/lib/finance-server';
import { formatCurrency } from '@/lib/finance-format';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { isValidUuid } from '@/lib/input-validation';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string; source: string; paymentId: string }>;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : value;
}

function textOrDash(value: string | null | undefined) {
  return value?.trim() || 'Not provided';
}

function contactLink(type: 'email' | 'phone', value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return 'Not provided';

  const href = type === 'email' ? `mailto:${trimmed}` : `tel:${trimmed.replace(/[^+\d]/g, '')}`;
  return <a href={href}>{trimmed}</a>;
}

export default async function PaymentReceiptPage({ params }: PageProps) {
  const { id: jobId, source, paymentId } = await params;
  if (!isValidUuid(jobId) || !isValidUuid(paymentId) || !['job', 'invoice'].includes(source)) {
    notFound();
  }

  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) notFound();

  const [{ data: job }, history, profitability] = await Promise.all([
    ctx.supabase
      .from('jobs')
      .select('id, title, address, customer_id, customers(name, email, phone, address)')
      .eq('id', jobId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle(),
    fetchJobPaymentHistory(ctx.supabase, ctx.organizationId, jobId),
    fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId)
  ]);

  if (!job) notFound();

  const payment = history.payments.find((entry) => entry.id === paymentId && entry.source === source);
  if (!payment) notFound();

  const customerRelation = job.customers as
    | { name?: string | null; email?: string | null; phone?: string | null; address?: string | null }
    | { name?: string | null; email?: string | null; phone?: string | null; address?: string | null }[]
    | null;
  const customer = Array.isArray(customerRelation) ? customerRelation[0] : customerRelation;
  const receiptNumber = `RCPT-${payment.id.slice(0, 8).toUpperCase()}`;

  return (
    <main className="page-shell receipt-page">
      <ReceiptActions jobId={jobId} />

      <article className="card receipt-card">
        <header className="receipt-header">
          <div>
            <p className="eyebrow">Payment receipt</p>
            <h1>{receiptNumber}</h1>
            <p className="muted">Payment received on {formatDate(payment.paidAt)}</p>
          </div>
          <div className="receipt-total">
            <span>Client paid</span>
            <strong>{formatCurrency(payment.amount)}</strong>
          </div>
        </header>

        <section className="receipt-section">
          <h2>Client</h2>
          <dl className="receipt-details">
            <div><dt>Name</dt><dd>{textOrDash(customer?.name)}</dd></div>
            <div><dt>Email</dt><dd>{contactLink('email', customer?.email)}</dd></div>
            <div><dt>Phone</dt><dd>{contactLink('phone', customer?.phone)}</dd></div>
            <div><dt>Address</dt><dd>{textOrDash(customer?.address || job.address)}</dd></div>
          </dl>
        </section>

        <section className="receipt-section">
          <h2>Payment details</h2>
          <dl className="receipt-details">
            <div><dt>Job</dt><dd>{job.title || 'Service job'}</dd></div>
            <div><dt>Payment date</dt><dd>{formatDate(payment.paidAt)}</dd></div>
            <div><dt>Payment method</dt><dd>{textOrDash(payment.paymentMethod)}</dd></div>
            <div><dt>Reference</dt><dd>{textOrDash(payment.paymentReference)}</dd></div>
            <div><dt>Payment source</dt><dd>{payment.source === 'invoice' ? 'Invoice payment' : 'Direct job payment'}</dd></div>
            <div><dt>Balance remaining</dt><dd>{formatCurrency(profitability.outstanding || 0)}</dd></div>
          </dl>
          {payment.notes ? <p className="receipt-notes"><strong>Notes:</strong> {payment.notes}</p> : null}
        </section>

        <footer className="receipt-footer">
          <p>Thank you for your payment.</p>
          <p className="muted">Keep this receipt for your records.</p>
        </footer>
      </article>
    </main>
  );
}
