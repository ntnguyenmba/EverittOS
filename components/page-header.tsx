'use client';

/**
 * Every signed-in page/view should use this header.
 * Title + subtitle are required so new pages stay consistent.
 */
type PageHeaderProps = {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  flush?: boolean;
};

export function PageHeader({ title, subtitle, action, flush = false }: PageHeaderProps) {
  return (
    <header className={flush ? 'page-header page-header-flush' : 'page-header'}>
      <div className="page-header-text">
        <h1>{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </header>
  );
}
