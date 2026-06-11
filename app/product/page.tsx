import { redirect } from 'next/navigation';
import { MARKETING_SITE_URL } from '@/lib/marketing-site';

export default function ProductPage() {
  redirect(MARKETING_SITE_URL);
}
