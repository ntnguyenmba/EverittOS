import { PublicBookingWizard } from '@/components/public-booking-wizard';

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function PublicBookWorkspacePage({ params }: PageProps) {
  const { workspaceSlug } = await params;
  return <PublicBookingWizard workspaceSlug={workspaceSlug} />;
}
