import Link from 'next/link';

const notices = [
  { name: 'Next.js', license: 'MIT License' },
  { name: 'React and React DOM', license: 'MIT License' },
  { name: 'Capacitor', license: 'MIT License' },
  { name: 'Supabase JavaScript libraries', license: 'MIT License' },
  { name: 'TypeScript', license: 'Apache License 2.0' },
  { name: 'Stripe Node.js library', license: 'MIT License' },
  { name: 'geo-tz', license: 'MIT License' },
  { name: 'pngjs', license: 'MIT License' },
  { name: 'tsx', license: 'MIT License' }
];

export default function ThirdPartyNoticesPage() {
  return (
    <main className="section">
      <div className="container legal-document" style={{ maxWidth: 720 }}>
        <h2>Third-Party Notices</h2>
        <p className="muted">
          EverittOS uses open-source software libraries. These libraries remain subject to their respective licenses.
        </p>

        <ul>
          {notices.map((notice) => (
            <li key={notice.name}>
              <strong>{notice.name}</strong>: {notice.license}
            </li>
          ))}
        </ul>

        <p>
          Full license texts and dependency details are available in the source packages distributed through npm. This
          page is provided for transparency and does not change the licenses that apply to those packages.
        </p>

        <Link className="btn" href="/about">
          Back to About
        </Link>
      </div>
    </main>
  );
}
