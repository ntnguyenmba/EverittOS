import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

export default function BookingEntryPage() {
  return (
    <main className="auth-gateway">
      <div className="auth-gateway-inner">
        <BrandLogo href="/" size={48} showName />
        <h1 className="auth-gateway-title">Online booking</h1>
        <p className="muted">
          Public booking pages use your workspace booking link. Sign in to open Settings and copy your booking URL, or
          ask your service provider for their booking page.
        </p>
        <div className="button-row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Link className="btn btn-primary" href="/login">
            Business sign in
          </Link>
          <Link className="btn" href="/settings">
            Open settings
          </Link>
        </div>
      </div>
    </main>
  );
}
