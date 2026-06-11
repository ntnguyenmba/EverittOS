import { redirect } from 'next/navigation';

/** Demo entry is signup-first; product onboarding follows sign-in. */
export default function DemoPage() {
  redirect('/signup?next=/onboarding');
}
