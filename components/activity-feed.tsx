'use client';

type ActivityItem = {
  id: string;
  action: string;
  message: string | null;
  entity_type: string;
  created_at: string | null;
  actor_name: string | null;
};

type ActivityFeedProps = {
  items: ActivityItem[];
  loading?: boolean;
  emptyLabel?: string;
};

export function ActivityFeed({ items, loading, emptyLabel = 'No activity yet' }: ActivityFeedProps) {
  if (loading) return <p>Loading activity...</p>;
  if (items.length === 0) return <p>{emptyLabel}</p>;

  return (
    <div className="activity-feed">
      {items.map((item) => (
        <div key={item.id} className="activity-item">
          <div className="activity-item-head">
            <strong>{item.action.replace(/_/g, ' ')}</strong>
            <span>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</span>
          </div>
          <p>{item.message || `${item.entity_type} update`}</p>
          {item.actor_name && <span className="muted">{item.actor_name}</span>}
        </div>
      ))}
    </div>
  );
}
