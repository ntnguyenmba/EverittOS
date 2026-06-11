'use client';

export function DemoBanner({ organizationName }: { organizationName?: string }) {
  return (
    <div className="demo-banner" role="status">
      <strong>Demo mode</strong>
      <span>
        {organizationName ? `${organizationName} · ` : ''}Sample data is isolated from production workspaces. Changes stay in this demo
        environment.
      </span>
    </div>
  );
}
