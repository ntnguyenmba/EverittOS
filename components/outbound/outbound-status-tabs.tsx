'use client';

import { useTranslation } from '@/components/locale-provider';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import type { OutboundTab } from '@/lib/outbound/types';

type OutboundStatusTabsProps = {
  active: OutboundTab;
  onChange: (tab: OutboundTab) => void;
  counts?: Partial<Record<OutboundTab, number>>;
};

export function OutboundStatusTabs({ active, onChange, counts }: OutboundStatusTabsProps) {
  const { locale } = useTranslation();
  const billingCopy = getBillingOpsCopy(locale);
  const tabs: { id: OutboundTab; label: string }[] = [
    { id: 'sent', label: billingCopy.tabSent },
    { id: 'scheduled', label: billingCopy.tabScheduled },
    { id: 'drafts', label: billingCopy.tabDrafts },
    { id: 'failed', label: billingCopy.tabFailed }
  ];

  return (
    <div className="outbound-status-tabs" role="tablist" aria-label={billingCopy.documentStatus}>
      {tabs.map((tab) => (
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
