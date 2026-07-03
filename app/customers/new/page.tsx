'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CustomerCreateForm } from '@/components/customer-create-form';
import { PageHeader } from '@/components/page-header';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

export default function NewCustomerPage() {
  const router = useRouter();
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
        title="New customer"
        subtitle="Add contact details, notes, and follow-ups for a new customer."
        action={
          <Link className="btn" href="/customers">
            Back to customers
          </Link>
        }
      />
      <CustomerCreateForm />
    </AppShell>
  );
}
