'use client';

import { JobGuidancePanel } from '@/components/job-guidance-panel';
import { JobsListNextActionHints } from '@/components/jobs-list-next-action-hints';

type AppPageContentProps = {
  children: React.ReactNode;
  className?: string;
};

/** Shared responsive page wrapper with no reserved desktop sidebar offset. */
export function AppPageContent({ children, className }: AppPageContentProps) {
  const classes = className ? `app-page-content ${className}` : 'app-page-content';

  return (
    <div
      className={classes}
      style={{
        width: '100%',
        maxWidth: 'none',
        minWidth: 0,
        marginLeft: 0,
        marginRight: 0
      }}
    >
      <JobGuidancePanel />
      <JobsListNextActionHints />
      {children}
    </div>
  );
}
