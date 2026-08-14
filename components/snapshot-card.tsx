'use client';

import Link from 'next/link';

type SnapshotCardProps = {
  title: string;
  value: React.ReactNode;
  actionLabel: string;
  href: string;
  hint?: string;
  loading?: boolean;
};

export function SnapshotCard({ title, value, actionLabel, href, hint, loading }: SnapshotCardProps) {
  return (
    <section className="card snapshot-card">
      <h3 className="card-title-sm">{title}</h3>
      <strong className="metric-value snapshot-card-value">{loading ? '…' : value}</strong>
      {hint ? <p className="metric-hint">{hint}</p> : null}
      <Link href={href} target="_blank" rel="noopener noreferrer" className="snapshot-card-action">
        {actionLabel}
      </Link>
    </section>
  );
}
