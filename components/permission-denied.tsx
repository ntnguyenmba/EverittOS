import { GoToDashboardLink } from '@/components/go-to-dashboard-link';

type PermissionDeniedProps = {
  message?: string;
  role?: string | null;
};

export function PermissionDenied({
  message = 'You do not have permission to view this page.',
  role
}: PermissionDeniedProps) {
  return (
    <div className="card permission-denied">
      <h3>Permission denied</h3>
      <p className="muted">{message}</p>
      <GoToDashboardLink role={role} className="btn">
        Back to dashboard
      </GoToDashboardLink>
    </div>
  );
}
