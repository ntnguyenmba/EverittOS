'use client';

import Link from 'next/link';

type MetricCardProps = {
  value: React.ReactNode;
  label: string;
  hint?: string;
  href?: string;
  loading?: boolean;
};

export function MetricCard({ value, label, hint, href, loading }: MetricCardProps) {
  const body = (
    <>
      <strong className="metric-value">{loading ? '…' : value}</strong>
      <span className="metric-label">{label}</span>
      {hint ? <span className="metric-hint">{hint}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="progress-card progress-card-link metric-stack">
        {body}
      </Link>
    );
  }

  return <div className="progress-card metric-stack">{body}</div>;
}
