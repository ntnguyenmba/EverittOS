export type RouteStop = {
  job_id: string;
  title: string;
  address: string | null;
  scheduled_start: string | null;
  sort_order: number;
  missing_address?: boolean;
};

export type ScheduledJobForRoute = {
  id: string;
  title: string;
  address: string | null;
  scheduled_start: string | null;
  status: string | null;
};

function addressSortKey(address: string | null): string {
  if (!address) return 'zzz';
  const zip = address.match(/\b\d{5}(?:-\d{4})?\b/);
  if (zip) return zip[0];
  const city = address.split(',').slice(-2, -1)[0]?.trim();
  return (city || address).toLowerCase();
}

/** Basic ordering when no mapping provider is configured. */
export function buildHeuristicRoute(jobs: ScheduledJobForRoute[]): {
  stops: RouteStop[];
  flaggedMissingAddress: number;
  provider: 'heuristic';
} {
  const sorted = [...jobs].sort((a, b) => {
    const keyA = addressSortKey(a.address);
    const keyB = addressSortKey(b.address);
    if (keyA !== keyB) return keyA.localeCompare(keyB);
    const timeA = a.scheduled_start || '';
    const timeB = b.scheduled_start || '';
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    return a.title.localeCompare(b.title);
  });

  let flagged = 0;
  const stops: RouteStop[] = sorted.map((job, index) => {
    const missing = !job.address?.trim();
    if (missing) flagged += 1;
    return {
      job_id: job.id,
      title: job.title,
      address: job.address,
      scheduled_start: job.scheduled_start,
      sort_order: index + 1,
      missing_address: missing
    };
  });

  return { stops, flaggedMissingAddress: flagged, provider: 'heuristic' };
}
