'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';

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

const copy = {
  en: { edit: 'Edit' },
  es: { edit: 'Editar' },
  vi: { edit: 'Sửa' }
} as const;

export function RecordActions({
  viewHref,
  viewLabel = 'Open',
  editHref,
  onEdit,
  editLabel,
  onRemove,
  removeLabel = 'Remove',
  removing = false,
  size = 'sm',
  layout = 'inline'
}: RecordActionsProps) {
  const { locale } = useTranslation();
  const resolvedEditLabel = editLabel || copy[locale].edit;
  const btnClass = size === 'sm' ? 'btn btn-sm' : 'btn';
  const actionCount = [Boolean(viewHref), Boolean(editHref || onEdit), Boolean(onRemove)].filter(Boolean).length;

  return (
    <div
      className={`record-actions record-actions-${layout} record-actions-count-${actionCount}`}
      style={{ borderTop: 'none', paddingTop: 0, marginTop: 12 }}
    >
      {viewHref ? (
        <Link className={btnClass} href={viewHref} target="_blank" rel="noopener noreferrer">
          {viewLabel}
        </Link>
      ) : null}
      {editHref ? (
        <Link className={btnClass} href={editHref} target="_blank" rel="noopener noreferrer">
          {resolvedEditLabel}
        </Link>
      ) : null}
      {onEdit ? (
        <button type="button" className={btnClass} onClick={onEdit}>
          {resolvedEditLabel}
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
