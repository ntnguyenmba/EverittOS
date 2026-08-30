type SupabaseLike = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data?: Record<string, unknown> | null }>;
      };
    };
  };
};

export type OnboardingAccessState = {
  completed: boolean;
  skipped: boolean;
};

export async function resolveOnboardingAccessState(
  supabase: SupabaseLike,
  organizationId: string | null | undefined
): Promise<OnboardingAccessState> {
  if (!organizationId) return { completed: true, skipped: false };

  const { data } = await supabase
    .from('organization_settings')
    .select('onboarding_completed, onboarding_skipped')
    .eq('organization_id', organizationId)
    .maybeSingle();

  return {
    completed: Boolean(data?.onboarding_completed),
    skipped: Boolean(data?.onboarding_skipped)
  };
}
