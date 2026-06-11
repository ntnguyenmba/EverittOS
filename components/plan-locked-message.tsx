type PlanLockedMessageProps = {
  feature: string;
  requiredPlan?: string;
};

export function PlanLockedMessage({ feature, requiredPlan = 'Growth' }: PlanLockedMessageProps) {
  return (
    <div className="settings-card">
      <h3>{feature}</h3>
      <p className="muted">
        {requiredPlan} or Enterprise is required for {feature.toLowerCase()}. Upgrade in{' '}
        <a href="/settings/billing">billing settings</a>.
      </p>
    </div>
  );
}
