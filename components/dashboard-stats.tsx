type DashboardStatsProps = {
  openJobs: number;
  completedJobs: number;
  photoCount: number;
};

export function DashboardStats({ openJobs, completedJobs, photoCount }: DashboardStatsProps) {
  const stats = [
    ['Open jobs', String(openJobs)],
    ['Completed', String(completedJobs)],
    ['Photos on file', String(photoCount)]
  ];

  return (
    <div className="stat-grid">
      {stats.map(([label, value]) => (
        <div className="stat" key={label}>
          <strong>{value}</strong>
          <p>{label}</p>
        </div>
      ))}
    </div>
  );
}
