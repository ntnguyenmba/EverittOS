import { redirect } from 'next/navigation';
import { isDemoFeatureEnabled } from '@/lib/demo-guard';

export default function DemoPage() {
  redirect(isDemoFeatureEnabled() ? '/signup?next=/onboarding' : '/login');
}
