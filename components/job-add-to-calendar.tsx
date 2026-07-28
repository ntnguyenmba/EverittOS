'use client';

import { useMemo, useState } from 'react';
import {
  downloadCalendarIcs,
  googleCalendarEventUrl,
  outlookCalendarEventUrl
} from '@/lib/calendar-links';
import { jobCalendarEvent, type JobCalendarFields } from '@/lib/job-calendar';

export function JobAddToCalendar({ job }: { job: JobCalendarFields }) {
  const [open, setOpen] = useState(false);
  const event = useMemo(() => jobCalendarEvent(job), [job]);

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
            Download calendar file
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
