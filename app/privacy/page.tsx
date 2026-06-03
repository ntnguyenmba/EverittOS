import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 640 }}>
        <h2>Privacy</h2>
        <p>EverittOS stores account, job, customer, photo, and report data in Supabase. Data is used to operate your workspace and is not sold.</p>
        <p>Photos are stored in secure storage tied to your account. You can request account deletion by contacting Everitt Ventures.</p>
        <p>Public marketing pages may use Google Analytics. Authenticated app pages do not load marketing analytics by default.</p>
        <Link className="btn" href="/login">
          Back to login
        </Link>
      </div>
    </main>
  );
}
