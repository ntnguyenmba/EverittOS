'use client';

type AppPageContentProps = {
  children: React.ReactNode;
  className?: string;
};

/** Shared responsive page wrapper — consistent padding and vertical rhythm. */
export function AppPageContent({ children, className }: AppPageContentProps) {
  const classes = className ? `app-page-content ${className}` : 'app-page-content';
  return <div className={classes}>{children}</div>;
}
