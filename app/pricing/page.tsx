import Link from 'next/link';
import { EVERITTOS_STRIPE_LINKS } from '@/lib/everittos-plans';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    description: 'Customer records, job tracking, and basic reports.',
    cta: { label: 'Start Free', href: '/signup' }
  },
  {
    name: 'Pro',
    price: '$9/mo',
    description: 'Photo storage, crew assignment, and printable reports.',
    cta: { label: 'Start Pro', href: EVERITTOS_STRIPE_LINKS.pro, external: true },
    featured: true
  },
  {
    name: 'Business',
    price: '$39/mo',
    description: 'Multiple crews, locations, and grouped dashboard views.',
    cta: { label: 'Start Business', href: EVERITTOS_STRIPE_LINKS.business, external: true }
  }
];

export default function PricingPage() {
  return (
    <main className="section">
      <div className="container">
        <h2>Pricing</h2>
        <p>Start free. Upgrade when your team needs photos, crews, and reports.</p>
        <div className="grid-3" style={{ marginTop: 24 }}>
          {tiers.map((tier) => (
            <div className={`card${tier.featured ? ' card-featured' : ''}`} key={tier.name}>
              <h3>{tier.name}</h3>
              <h2>{tier.price}</h2>
              <p>{tier.description}</p>
              {tier.cta.external ? (
                <a className="btn btn-primary" href={tier.cta.href} target="_blank" rel="noopener noreferrer">
                  {tier.cta.label}
                </a>
              ) : (
                <Link className="btn btn-primary" href={tier.cta.href}>
                  {tier.cta.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
