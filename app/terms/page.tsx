import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 640 }}>
        <h2>Terms of Use</h2>
        <p>EverittOS is provided for business operations and field documentation. You are responsible for accurate job records and customer data you enter.</p>
        <p>Plans, limits, and features may change with notice. Paid subscriptions are billed through Stripe according to the plan you select.</p>
        <p>Contact Everitt Ventures for account or billing questions.</p>
        <Link className="btn" href="/login">
          Back to login
        </Link>
      </div>
    </main>
  );
}
