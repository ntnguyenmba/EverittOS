import Link from 'next/link';
import type { ReactNode } from 'react';

type RecordCardProps = {
  href?: string;
  eyebrow?: string;
  title: string;
  details?: Array<string | null | undefined>;
  meta?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
  className?: string;
};

export function RecordCard({
  href,
  eyebrow,
  title,
  details = [],
  meta,
  status,
  actions,
  leading,
  className
}: RecordCardProps) {
  const content = (
    <>
      {leading ? <div className="record-card-leading">{leading}</div> : null}
      <div className="record-card-copy">
        {eyebrow ? <p className="eyebrow record-card-eyebrow">{eyebrow}</p> : null}
        <h3>{title}</h3>
        {details.filter(Boolean).map((detail, index) => (
          <p className="record-card-detail" key={`${detail}-${index}`}>{detail}</p>
        ))}
      </div>
      {(meta || status) ? (
        <div className="record-card-meta">
          {meta}
          {status}
        </div>
      ) : null}
    </>
  );

  return (
    <article className={className ? `record-card ${className}` : 'record-card'}>
      {href ? (
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="record-card-link"
          aria-label={`Open ${title} in a new tab`}
        >
          {content}
        </Link>
      ) : (
        <div className="record-card-link">{content}</div>
      )}
      {actions ? <div className="record-card-actions">{actions}</div> : null}
    </article>
  );
}
