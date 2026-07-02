import { NO_REFUND_POLICY_SHORT, NO_REFUND_POLICY_TEXT } from '@/lib/no-refund-policy';

type NoRefundDisclosureProps = {
  variant?: 'compact' | 'card' | 'full';
  className?: string;
  /** Override default compact/full copy (e.g. cancel-flow note). */
  text?: string;
};

export function NoRefundDisclosure({
  variant = 'compact',
  className = '',
  text
}: NoRefundDisclosureProps) {
  const copy = text ?? (variant === 'full' ? NO_REFUND_POLICY_TEXT : NO_REFUND_POLICY_SHORT);

  if (variant === 'card') {
    return (
      <aside
        className={`no-refund-disclosure no-refund-disclosure-card ${className}`.trim()}
        aria-label="No refund policy"
      >
        <p className="no-refund-disclosure-text">{copy}</p>
      </aside>
    );
  }

  return (
    <p className={`no-refund-disclosure no-refund-disclosure-${variant} muted ${className}`.trim()}>{copy}</p>
  );
}
