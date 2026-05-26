export function StatusPill({ status }: { status?: string | null }) {
  const label = status || 'new';
  const clean = label.toLowerCase().replaceAll(' ', '-');
  return <span className={'status ' + clean}>{label}</span>;
}
