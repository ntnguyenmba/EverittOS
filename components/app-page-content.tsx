'use client';

import { Children, isValidElement } from 'react';
import { AskEverittCommand } from '@/components/ask-everitt-command';
import { CompactRecordLists } from '@/components/compact-record-lists';
import { JobGuidancePanel } from '@/components/job-guidance-panel';
import { JobsListNextActionHints } from '@/components/jobs-list-next-action-hints';

type AppPageContentProps = {
  children: React.ReactNode;
  className?: string;
};

/** Ask Everitt floats as chrome; page sections float as separate surfaces on the backdrop. */
export function AppPageContent({ children, className }: AppPageContentProps) {
  const classes = className ? `app-page-content ${className}` : 'app-page-content';
  const items = Children.toArray(children);
  const chrome: React.ReactNode[] = [];
  const page: React.ReactNode[] = [];

  for (const child of items) {
    if (isValidElement(child) && child.type === AskEverittCommand) chrome.push(child);
    else page.push(child);
  }

  return (
    <div className={classes}>
      {chrome}
      <div className="app-page-stage">
        <CompactRecordLists />
        <JobGuidancePanel />
        <JobsListNextActionHints />
        {page}
      </div>
    </div>
  );
}
