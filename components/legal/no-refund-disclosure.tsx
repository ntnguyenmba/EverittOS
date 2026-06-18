import Link from 'next/link';
import { NO_REFUND_POLICY_SHORT, NO_REFUND_POLICY_TEXT, REFUND_POLICY_PATH } from '@/lib/no-refund-policy';

type NoRefundDisclosureProps = {
  variant?: 'compact' | 'card' | 'full';
  showLink?: boolean;
  className?: string;
  /** Override default compact/full copy (e.g. cancel-flow note). */
  text?: string;
};

export function NoRefundDisclosure({
  variant = 'compact',
  showLink = true,
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
        {showLink ? (
          <p className="no-refund-disclosure-link-row">
            <Link href={REFUND_POLICY_PATH}>No Refund Policy</Link>
          </p>
        ) : null}
      </aside>
    );
  }

  return (
    <p className={`no-refund-disclosure no-refund-disclosure-${variant} muted ${className}`.trim()}>
      {copy}
      {showLink ? (
        <>
          {' '}
          <Link href={REFUND_POLICY_PATH}>No Refund Policy</Link>
        </>
      ) : null}
    </p>
  );
}
