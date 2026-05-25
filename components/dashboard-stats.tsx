export function DashboardStats() {
  const stats = [
    ['Live jobs', '18'],
    ['Completed today', '11'],
    ['Proof reports', '42']
  ];
  return <div className="stat-grid">{stats.map(([label, value]) => <div className="stat" key={label}><strong>{value}</strong><p>{label}</p></div>)}</div>;
}
