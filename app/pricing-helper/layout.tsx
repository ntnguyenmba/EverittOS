import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { fetchOrganizationContextWithRepair } from '@/lib/workspace-server';
import { canShowNavHref } from '@/lib/nav-access';
import { defaultPathForRole } from '@/lib/role-routes';
import { normalizeRole } from '@/lib/roles';

export default async function PricingHelperLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined
  });
  const role = normalizeRole(org?.role || 'owner');

  if (!org || !canShowNavHref(role, '/pricing-helper')) {
    redirect(defaultPathForRole(role, '/dashboard'));
  }

  return children;
}
