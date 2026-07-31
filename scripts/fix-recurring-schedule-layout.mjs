import fs from 'node:fs';

// Focused, idempotent patch for the job creator scheduling UX.
const path = 'components/job-creator.tsx';
let source = fs.readFileSync(path, 'utf8');

source = source.replace(
  "    preferredStartTime: visits[0]?.start_time || '09:00',",
  "    preferredStartTime: visits[0]?.start_time || null,"
);

const startMarker = '        <section className="job-create-section">\n          <h4>4. One-time or recurring</h4>';
const endMarker = '        <section className="job-create-section">\n          <h4>5. Contractor</h4>';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  throw new Error('Could not find scheduling sections in components/job-creator.tsx');
}

const replacement = `        <section className="job-create-section">
          <h4>4. Schedule</h4>
          <label htmlFor="recurrence-frequency">Schedule type</label>
          <select
            id="recurrence-frequency"
            className="input"
            value={recurrenceFrequency}
            onChange={(e) => setRecurrenceFrequency(e.target.value as RecurrenceFrequency)}
          >
            <option value="none">One-time</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every two weeks</option>
            <option value="every_four_weeks">Every four weeks</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>

          {recurrenceFrequency !== 'none' ? (
            <>
              <label htmlFor="recurrence-weekday">Weekday</label>
              <select
                id="recurrence-weekday"
                className="input"
                value={recurrenceWeekday}
                onChange={(e) => setRecurrenceWeekday(Number(e.target.value))}
              >
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((label, index) => (
                  <option key={label} value={index}>{label}</option>
                ))}
              </select>

              {recurrenceFrequency === 'custom' ? (
                <div className="grid-2">
                  <div className="form-group">
                    <label>Every</label>
                    <input className="input" type="number" min="1" max="52" value={recurrenceInterval} onChange={(e) => setRecurrenceInterval(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Unit</label>
                    <select className="input" value={recurrenceIntervalUnit} onChange={(e) => setRecurrenceIntervalUnit(e.target.value as 'weeks' | 'months')}>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>
              ) : null}

              <label htmlFor="recurrence-start-date">Start date</label>
              <input
                id="recurrence-start-date"
                className="input"
                type="date"
                value={visits[0]?.visit_date || ''}
                onChange={(e) => updateVisit(visits[0].id, { visit_date: e.target.value })}
              />
              <div className="grid-2">
                <div className="form-group">
                  <label htmlFor="recurrence-start-time">Start time</label>
                  <input
                    id="recurrence-start-time"
                    className="input"
                    type="time"
                    value={visits[0]?.start_time || ''}
                    onChange={(e) => updateVisit(visits[0].id, { start_time: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="recurrence-end-time">End time</label>
                  <input
                    id="recurrence-end-time"
                    className="input"
                    type="time"
                    value={visits[0]?.end_time || ''}
                    onChange={(e) => updateVisit(visits[0].id, { end_time: e.target.value })}
                  />
                </div>
              </div>

              <label htmlFor="job-timezone">Job timezone</label>
              <select id="job-timezone" className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                <option value="">Use workspace default</option>
                {TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <p className="muted">Timezone is filled from the property address when available.</p>

              <details open={showRecurrenceAdvanced} onToggle={(e) => setShowRecurrenceAdvanced((e.target as HTMLDetailsElement).open)}>
                <summary>Advanced recurrence options</summary>
                <label style={{ marginTop: 8 }}>End date (optional)</label>
                <input className="input" type="date" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} />
                <label>Number of visits (optional)</label>
                <input className="input" type="number" min="1" value={recurrenceLimit} onChange={(e) => setRecurrenceLimit(e.target.value)} />
                <p className="muted">Leave end date and visit count blank for no end date.</p>
              </details>

              <p className="muted" style={{ marginTop: 8 }}>
                {recurrenceSummary}
                {timeZone ? <> Timezone: {TIME_ZONE_OPTIONS.find((option) => option.value === timeZone)?.label || timeZone}.</> : null}
              </p>
            </>
          ) : (
            <>
              <p className="muted">Add one or more scheduled visits. Times are saved in the timezone selected below.</p>
              <label htmlFor="job-timezone">Job timezone</label>
              <select id="job-timezone" className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                <option value="">Use workspace default</option>
                {TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <p className="muted">Timezone is filled from the property address when available.</p>
              {visits.map((visit, index) => (
                <div key={visit.id} className="form visit-editor">
                  <label>Visit {index + 1}</label>
                  <input className="input" type="date" value={visit.visit_date} onChange={(e) => updateVisit(visit.id, { visit_date: e.target.value })} />
                  <div className="grid-2">
                    <div className="form-group"><label>Start time</label><input className="input" type="time" value={visit.start_time} onChange={(e) => updateVisit(visit.id, { start_time: e.target.value })} /></div>
                    <div className="form-group"><label>End time</label><input className="input" type="time" value={visit.end_time} onChange={(e) => updateVisit(visit.id, { end_time: e.target.value })} /></div>
                  </div>
                  <label>Visit notes</label>
                  <input className="input" value={visit.notes} onChange={(e) => updateVisit(visit.id, { notes: e.target.value })} />
                  {visits.length > 1 ? <button className="btn" type="button" onClick={() => removeVisit(visit.id)}>Remove visit</button> : null}
                </div>
              ))}
              <button className="btn" type="button" onClick={() => setVisits((rows) => [...rows, newVisit()])}>Add another visit</button>
            </>
          )}
        </section>

`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(path, source);
