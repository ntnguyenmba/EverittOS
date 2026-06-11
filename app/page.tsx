import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

/** Minimal app entry: logo, one line, sign in or start trial. Marketing lives on everittventures.com/tech. */
export default function HomePage() {
  return (
    <main id="main-content" className="auth-gateway">
      <div className="auth-gateway-inner">
        <BrandLogo href="/" size={48} showName />
        <h1 className="auth-gateway-title">Operations software for field service teams.</h1>
        <div className="auth-gateway-actions">
          <Link className="btn btn-primary" href="/login">
            Sign in
          </Link>
          <Link className="btn" href="/signup">
            Start free trial
          </Link>
        </div>
        <footer className="auth-gateway-footer">
          <Link href="/terms">Terms</Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacy">Privacy</Link>
        </footer>
      </div>
    </main>
  );
}
