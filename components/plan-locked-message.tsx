type PlanLockedMessageProps = {
  feature: string;
  requiredPlan?: string;
};

export function PlanLockedMessage({ feature, requiredPlan = 'Growth' }: PlanLockedMessageProps) {
  return (
    <div className="settings-card">
      <h3>{feature}</h3>
      <p className="muted">
        {requiredPlan} or Enterprise is required for {feature.toLowerCase()}. Upgrade on{' '}
        <a href="/settings/billing">billing settings</a> or compare plans on <a href="/pricing">pricing</a>.
      </p>
    </div>
  );
}
