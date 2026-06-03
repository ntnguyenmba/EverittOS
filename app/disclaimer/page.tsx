import Link from 'next/link';

export default function DisclaimerPage() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 640 }}>
        <h2>Disclaimer</h2>
        <p>EverittOS helps record field work. It does not replace licensed trade, legal, or safety advice. You are responsible for compliance in your market.</p>
        <p>Reports and photos are operational records. Verify accuracy before sharing with clients or insurers.</p>
        <Link className="btn" href="/login">
          Back to login
        </Link>
      </div>
    </main>
  );
}
