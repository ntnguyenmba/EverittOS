type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  compact?: boolean;
  icon?: 'default' | 'none';
};

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  compact,
  icon = 'default'
}: EmptyStateProps) {
  return (
    <div className={compact ? 'empty-state empty-state-compact card' : 'empty-state card'} role="status">
      {icon === 'default' ? <div className="empty-state-visual" aria-hidden="true" /> : null}
      <h3>{title}</h3>
      {description ? <p className="muted">{description}</p> : null}
      {action || secondaryAction ? (
        <div className="empty-state-actions">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
