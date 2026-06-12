'use client';

import type { OutboundTab } from '@/lib/outbound/types';

const TABS: { id: OutboundTab; label: string }[] = [
  { id: 'sent', label: 'Sent' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'failed', label: 'Failed' }
];

type OutboundStatusTabsProps = {
  active: OutboundTab;
  onChange: (tab: OutboundTab) => void;
  counts?: Partial<Record<OutboundTab, number>>;
};

export function OutboundStatusTabs({ active, onChange, counts }: OutboundStatusTabsProps) {
  return (
    <div className="outbound-status-tabs" role="tablist" aria-label="Document status">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`outbound-status-tab${active === tab.id ? ' active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {counts?.[tab.id] != null ? <span className="outbound-status-count">{counts[tab.id]}</span> : null}
        </button>
      ))}
    </div>
  );
}
