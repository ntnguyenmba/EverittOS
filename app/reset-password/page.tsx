import { redirect } from 'next/navigation';
import { mapAuthError } from '@/lib/auth-errors';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

type ResetPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

/** Server page: exchanges a fresh recovery code before checking the recovery session cookie. */
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = searchParams ? await searchParams : {};
  const code = firstParam(params.code);
  const authError = firstParam(params.error_description) || firstParam(params.error);

  if (code) {
    redirect(`/api/auth/reset-session?code=${encodeURIComponent(code)}`);
  }

  if (authError) {
    redirect(
      `/api/auth/reset-session?error=${encodeURIComponent(authError)}`
    );
  }

  const { supabase } = await createRouteHandlerSupabase();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  const sessionReady = Boolean(user && !userError);

  const initialError = sessionReady
    ? null
    : (() => {
        const mapped = mapAuthError('reset_link_expired', 'reset_link_expired');
        return {
          title: mapped.title,
          message: 'Open the newest password reset link from your email, or request another link below.',
          details: mapped.details
        };
      })();

  return <ResetPasswordForm sessionReady={sessionReady} initialError={initialError} />;
}
