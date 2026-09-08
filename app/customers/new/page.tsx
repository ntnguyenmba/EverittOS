'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { CustomerCreateForm } from '@/components/customer-create-form';
import { PageHeader } from '@/components/page-header';
import { useTranslation } from '@/components/locale-provider';
import { getCustomerCreateCopy } from '@/lib/i18n/customer-create-copy';

export default function NewCustomerPage() {
  const { locale } = useTranslation();
  const copy = getCustomerCreateCopy(locale);

  return (
    <AppShell>
      <PageHeader
        title={copy.pageTitle}
        subtitle={copy.intro}
        action={
          <Link className="btn" href="/customers">
            {copy.back}
          </Link>
        }
      />
      <CustomerCreateForm />
    </AppShell>
  );
}
