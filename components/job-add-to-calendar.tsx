'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import {
  downloadCalendarIcs,
  googleCalendarEventUrl,
  outlookCalendarEventUrl
} from '@/lib/calendar-links';
import { jobCalendarEvent, type JobCalendarFields } from '@/lib/job-calendar';

const copy = {
  en: { addToAppleCalendar: 'Add to Apple Calendar', downloadCalendarFile: 'Download calendar file' },
  es: { addToAppleCalendar: 'Agregar a Apple Calendar', downloadCalendarFile: 'Descargar archivo de calendario' },
  vi: { addToAppleCalendar: 'Thêm vào Apple Calendar', downloadCalendarFile: 'Tải tệp lịch xuống' }
} as const;

export function JobAddToCalendar({ job }: { job: JobCalendarFields }) {
  const { locale } = useTranslation();
  const c = copy[locale];
  const [open, setOpen] = useState(false);
  const [isAppleDevice, setIsAppleDevice] = useState(false);
  const event = useMemo(() => jobCalendarEvent(job), [job]);

  useEffect(() => {
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } }).userAgentData?.platform
      || navigator.platform
      || navigator.userAgent
      || '';
    setIsAppleDevice(/Mac|iPhone|iPad|iPod/i.test(platform));
  }, []);

  if (!event) {
    return (
      <p className="muted" style={{ marginTop: 8 }}>
        Add a schedule date to enable calendar export.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button type="button" className="btn" onClick={() => setOpen((value) => !value)}>
        {open ? 'Hide calendar options' : 'Add to Calendar'}
      </button>
      {open ? (
        <div className="inline-actions" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="btn" onClick={() => downloadCalendarIcs(event)}>
            {isAppleDevice ? c.addToAppleCalendar : c.downloadCalendarFile}
          </button>
          <a className="btn" href={googleCalendarEventUrl(event)} target="_blank" rel="noreferrer">
            Add to Google Calendar
          </a>
          <a className="btn" href={outlookCalendarEventUrl(event)} target="_blank" rel="noreferrer">
            Add to Outlook Calendar
          </a>
        </div>
      ) : null}
    </div>
  );
}
