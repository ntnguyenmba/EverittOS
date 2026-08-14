'use client';

import Link from 'next/link';

const cardStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: 'hidden'
};

const valueStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  fontSize: 'clamp(1.35rem, 3.1vw, 1.875rem)'
};

const textStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  overflowWrap: 'anywhere',
  wordBreak: 'break-word'
};

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
      <strong className="metric-value" style={valueStyle}>{loading ? '…' : value}</strong>
      <span className="metric-label" style={textStyle}>{label}</span>
      {hint ? <span className="metric-hint" style={textStyle}>{hint}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} target="_blank" rel="noopener noreferrer" className="progress-card progress-card-link metric-stack" style={cardStyle}>
        {body}
      </Link>
    );
  }

  return <div className="progress-card metric-stack" style={cardStyle}>{body}</div>;
}
