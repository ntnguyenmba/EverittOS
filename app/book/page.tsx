import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

export default function BookingEntryPage() {
  return (
    <main className="auth-gateway">
      <div className="auth-gateway-inner">
        <BrandLogo href="/" size={48} showName />
        <p className="eyebrow">EverittOS Booking Suite</p>
        <h1 className="auth-gateway-title">Customer booking pages are being added to EverittOS.</h1>
        <p>Use a business booking link like /book/your-business once booking services are configured.</p>
        <Link className="btn btn-primary" href="/login">Business sign in</Link>
      </div>
    </main>
  );
}
