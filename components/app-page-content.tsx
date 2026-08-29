'use client';

import { Children, isValidElement } from 'react';
import { AskEverittCommand } from '@/components/ask-everitt-command';
import { JobGuidancePanel } from '@/components/job-guidance-panel';
import { JobGuidanceActionBridge } from '@/components/job-guidance-action-bridge';
import { JobsListNextActionHints } from '@/components/jobs-list-next-action-hints';

type AppPageContentProps = {
  children: React.ReactNode;
  className?: string;
};

/** Ask Everitt floats as chrome; all page content lives in one white stage. */
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
      {chrome}
      <div className="app-page-stage">
        <JobGuidanceActionBridge />
        <JobGuidancePanel />
        <JobsListNextActionHints />
        {page}
        <p className="app-stage-copyright">© {new Date().getFullYear()} Everitt Ventures</p>
      </div>
    </div>
  );
}
