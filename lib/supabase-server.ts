import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createSupabaseCookieAdapter } from '@/lib/auth-cookies';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-config';

export type Profile = {
  id: string;
  email?: string | null;
  role?: string | null;
  plan?: EverittosPlan | string | null;
  subscription_status?: string | null;
  business_name?: string | null;
};

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: createSupabaseCookieAdapter({
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* Server Components may not set cookies */
        }
      }
    })
  });
}

export async function getSessionProfile(): Promise<{ userId: string; profile: Profile; role: UserRole; plan: EverittosPlan } | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  const merged: Profile = { id: user.id, email: user.email, ...(profile || {}) };
  return {
    userId: user.id,
    profile: merged,
    role: normalizeRole(merged.role),
    plan: normalizePlan(merged.plan)
  };
}
