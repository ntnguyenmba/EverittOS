'use client';

import Link from 'next/link';
import { OsModulePage } from '@/components/os-module-page';
import { limitsForPlan } from '@/lib/everittos-limits';

export default function ClientsPage() {
  return (
    <OsModulePage
      title="Clients"
      description="Client portal access, shared jobs, and secure client-facing records."
      requiredPlan="operations"
      requiredFeature="Client portal"
      featureCheck={(plan) => limitsForPlan(plan).clientPortal}
      actions={[
        { label: 'Open client portal', href: '/portal/client' },
        { label: 'CRM records', href: '/customers' }
      ]}
    >
      <div className="card">
        <p>
          Grant clients access from a job detail page. Clients can view shared jobs, invoices, proposals, and progress in
          the portal.
        </p>
        <p className="muted" style={{ marginTop: 12 }}>
          Requires Operations or higher. Manage branding under <Link href="/settings/branding">Branding</Link>.
        </p>
      </div>
    </OsModulePage>
  );
}
