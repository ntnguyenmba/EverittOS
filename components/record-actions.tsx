'use client';

import Link from 'next/link';

type RecordActionsProps = {
  viewHref?: string;
  viewLabel?: string;
  editHref?: string;
  onEdit?: () => void;
  editLabel?: string;
  onRemove?: () => void;
  removeLabel?: string;
  removing?: boolean;
  size?: 'sm' | 'md';
  layout?: 'inline' | 'stack';
};

export function RecordActions({
  viewHref,
  viewLabel = 'Open',
  editHref,
  onEdit,
  editLabel = 'Edit',
  onRemove,
  removeLabel = 'Remove',
  removing = false,
  size = 'sm',
  layout = 'inline'
}: RecordActionsProps) {
  const btnClass = size === 'sm' ? 'btn btn-sm' : 'btn';

  return (
    <div className={`record-actions record-actions-${layout}`}>
      {viewHref ? (
        <Link className={btnClass} href={viewHref}>
          {viewLabel}
        </Link>
      ) : null}
      {editHref ? (
        <Link className={btnClass} href={editHref}>
          {editLabel}
        </Link>
      ) : null}
      {onEdit ? (
        <button type="button" className={btnClass} onClick={onEdit}>
          {editLabel}
        </button>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          className={`${btnClass} btn-danger`}
          disabled={removing}
          onClick={onRemove}
        >
          {removing ? 'Removing…' : removeLabel}
        </button>
      ) : null}
    </div>
  );
}
