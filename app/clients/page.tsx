'use client';

import Link from 'next/link';
import { OsModulePage } from '@/components/os-module-page';
import { useTranslation } from '@/components/locale-provider';
import { limitsForPlan } from '@/lib/everittos-limits';

const copy = {
  en: { customers: 'Customers' },
  es: { customers: 'Clientes' },
  vi: { customers: 'Khách hàng' }
} as const;

export default function ClientsPage() {
  const { locale } = useTranslation();
  const c = copy[locale];

  return (
    <OsModulePage
      title="Clients"
      description="Customer dashboard access, shared jobs, and secure customer-facing records."
      requiredPlan="growth"
      requiredFeature="Customer dashboard"
      featureCheck={(plan) => limitsForPlan(plan).clientPortal}
      actions={[
        { label: 'Open customer dashboard', href: '/portal/client' },
        { label: c.customers, href: '/customers' }
      ]}
    >
      <div className="card">
        <p>
          Grant clients access from a job detail page. Clients can view shared jobs, invoices, proposals, and progress in
          the customer dashboard.
        </p>
        <p className="muted" style={{ marginTop: 12 }}>
          Requires Growth or higher. Manage branding under <Link href="/settings/branding">Branding</Link>.
        </p>
      </div>
    </OsModulePage>
  );
}
