import { redirect } from 'next/navigation';
import { MARKETING_SITE_URL } from '@/lib/marketing-site';

export default function PricingPage() {
  redirect(MARKETING_SITE_URL);
}
