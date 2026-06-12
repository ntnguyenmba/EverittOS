import { mapAuthError } from '@/lib/auth-errors';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

/** Server page: shows reset form when a recovery session cookie is present. */
export default async function ResetPasswordPage() {
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
          message: 'Open the password reset link from your email, or request a new link below.',
          details: mapped.details
        };
      })();

  return <ResetPasswordForm sessionReady={sessionReady} initialError={initialError} />;
}
