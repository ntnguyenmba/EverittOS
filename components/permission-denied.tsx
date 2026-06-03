import Link from 'next/link';

type PermissionDeniedProps = {
  message?: string;
};

export function PermissionDenied({
  message = 'You do not have permission to view this page.'
}: PermissionDeniedProps) {
  return (
    <div className="card permission-denied">
      <h3>Permission denied</h3>
      <p className="muted">{message}</p>
      <Link href="/dashboard" className="btn">
        Back to dashboard
      </Link>
    </div>
  );
}
