type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
};

export function EmptyState({ title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={compact ? 'empty-state empty-state-compact' : 'empty-state card'} role="status">
      <h3>{title}</h3>
      {description ? <p className="muted">{description}</p> : null}
      {action}
    </div>
  );
}
