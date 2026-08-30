type PortalJobFinanceProps = {
  status: string;
  statusClassName?: string;
  payLabel: string;
  emptyLabel: string;
  amount: string | null;
};

export function PortalJobFinance({
  status,
  statusClassName = 'status-badge',
  payLabel,
  emptyLabel,
  amount
}: PortalJobFinanceProps) {
  return (
    <p className="portal-job-finance">
      <span className={statusClassName}>{status}</span>
      <span className="portal-finance-sep" aria-hidden="true">
        {' \u00b7 '}
      </span>
      {amount == null ? (
        <span className="portal-finance-empty">{emptyLabel}</span>
      ) : (
        <strong className="portal-finance-amount">
          {payLabel}: {amount}
        </strong>
      )}
    </p>
  );
}
