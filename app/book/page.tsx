import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

export default function BookingEntryPage() {
  return (
    <main className="auth-gateway">
      <div className="auth-gateway-inner">
        <BrandLogo href="/" size={48} showName />
        <h1 className="auth-gateway-title">Online booking for your business</h1>
        <p className="muted">Booking pages are coming soon. Configure your booking link in Settings when it is available.</p>
        <Link className="btn btn-primary" href="/login">Business sign in</Link>
      </div>
    </main>
  );
}
