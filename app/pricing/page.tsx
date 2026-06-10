import Link from 'next/link';
import { EVERITTOS_PLANS } from '@/lib/everittos-plans';

export default function PricingPage() {
  return (
    <main className="section">
      <div className="container">
        <h2>Pricing</h2>
        <p className="muted">Every plan lists real limits and features available in the product today.</p>
        <div className="pricing-grid" style={{ marginTop: 28 }}>
          {EVERITTOS_PLANS.map((tier) => (
            <div className={`card${tier.featured ? ' card-featured' : ''}`} key={tier.id}>
              <h3>{tier.name}</h3>
              <h2>{tier.priceLabel}</h2>
              <p>{tier.headline}</p>
              <ul className="plan-feature-list">
                {tier.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <p className="muted" style={{ marginTop: 12 }}>
                <strong>Limits:</strong> {tier.limits.join(' · ')}
              </p>
              {tier.stripeLink ? (
                <a className="btn btn-primary" href={tier.stripeLink} target="_blank" rel="noopener noreferrer">
                  {tier.buttonLabel}
                </a>
              ) : (
                <Link className="btn btn-primary" href={`/signup?plan=${tier.id}`}>
                  {tier.buttonLabel}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
