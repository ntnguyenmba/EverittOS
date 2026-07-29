import { redirect } from 'next/navigation';
import { clientPortalJobsPath } from '@/lib/portal-access';

export default function ClientPortalPage() {
  redirect(clientPortalJobsPath());
}
