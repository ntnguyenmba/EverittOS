export function StatusPill({ status }: { status: string }) {
  const clean = status.toLowerCase().replace(' ', '-');
  return <span className={`status ${clean}`}>{status}</span>;
}
