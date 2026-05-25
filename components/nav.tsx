import Link from 'next/link';

export function Nav() {
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="logo"><span className="logo-mark" />EverittOS</Link>
        <nav className="nav-links">
          <Link href="/product">Product</Link>
          <Link href="/industries">Industries</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/demo">Demo</Link>
        </nav>
        <div className="nav-actions">
          <Link className="btn" href="/login">Login</Link>
          <Link className="btn btn-primary" href="/dashboard">Open Dashboard</Link>
        </div>
      </div>
    </header>
  );
}
