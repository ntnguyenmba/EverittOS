import { LEGAL_NOTICE, SUPPORT_EMAIL } from '@/lib/support';

export function LegalNotice() {
  return (
    <p className="muted" style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
      {LEGAL_NOTICE} Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
    </p>
  );
}
