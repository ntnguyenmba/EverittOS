'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CustomerCreateForm } from '@/components/customer-create-form';
import { PageHeader } from '@/components/page-header';
import { useTranslation } from '@/components/locale-provider';
import { getCustomerCreateCopy } from '@/lib/i18n/customer-create-copy';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

export default function NewCustomerPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const copy = getCustomerCreateCopy(locale);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/customers/new');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));
    }
    void load();
  }, [router]);

  return (
    <AppShell plan={plan} role={role}>
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
