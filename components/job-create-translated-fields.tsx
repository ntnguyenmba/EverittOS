'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Button } from './ui/button';
import { FEEDBACK } from '@/lib/feedback-labels';
import { TIME_ZONE_OPTIONS } from '@/lib/time-zones';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import type { JobCreateCopy } from '@/lib/i18n/job-create-copy';
import type { RecurrenceCopy } from '@/lib/i18n/recurrence-copy';
import {
  RECURRING_GENERATION_WINDOW_DAYS,
  type RecurrenceEndMode,
  type RecurrenceFrequency,
  type RecurrenceIntervalUnit
} from '@/lib/recurring-jobs';

type VisitDraft = { id: string; visit_date: string; start_time: string; end_time: string; notes: string };
type TeamMemberOption = { userId: string; label: string; role: string };
type ContractorPayMode = 'hourly' | 'flat';

export function JobCreateTranslatedFields(props: {
  locale: string;
  createCopy: JobCreateCopy;
  recurrenceCopy: RecurrenceCopy;
  title: string;
  setTitle: (value: string) => void;
  isRecurring: boolean;
  primaryVisit?: VisitDraft;
  recurrenceStartDate: string;
  setSeriesStartDate: (value: string) => void;
  recurrenceFieldErrors: { startDate?: string; weekdays?: string; endDate?: string; limit?: string; startTime?: string };
  setRecurrenceFieldErrors: Dispatch<SetStateAction<{ startDate?: string; weekdays?: string; endDate?: string; limit?: string; startTime?: string }>>;
  updateVisit: (id: string, patch: Partial<VisitDraft>) => void;
  clientIncome: string;
  setClientIncome: (value: string) => void;
  assignedTo: string;
  setAssignedTo: (value: string) => void;
  loadingTeam: boolean;
  teamMembers: TeamMemberOption[];
  roleLabel: (value: string) => string;
  contractorPayMode: ContractorPayMode;
  setContractorPayMode: (value: ContractorPayMode) => void;
  contractorHours: string;
  setContractorHours: (value: string) => void;
  contractorHourlyRate: string;
  setContractorHourlyRate: (value: string) => void;
  contractorFlatRate: string;
  setContractorFlatRate: (value: string) => void;
  previewContractorPay: number;
  notes: string;
  setNotes: (value: string) => void;
  recurrenceFrequency: RecurrenceFrequency;
  setRecurrenceFrequency: (value: RecurrenceFrequency) => void;
  visits: VisitDraft[];
  setVisits: Dispatch<SetStateAction<VisitDraft[]>>;
  newVisit: () => VisitDraft;
  showWeekdays: boolean;
  weekdayLabels: string[];
  recurrenceWeekdays: number[];
  setRecurrenceWeekdays: Dispatch<SetStateAction<number[]>>;
  timeZone: string;
  setTimeZone: (value: string) => void;
  recurrenceEndMode: RecurrenceEndMode;
  setRecurrenceEndMode: (value: RecurrenceEndMode) => void;
  recurrenceEndDate: string;
  setRecurrenceEndDate: (value: string) => void;
  recurrenceLimit: string;
  setRecurrenceLimit: (value: string) => void;
  showRecurrenceAdvanced: boolean;
  setShowRecurrenceAdvanced: (value: boolean) => void;
  recurrenceInterval: string;
  setRecurrenceInterval: (value: string) => void;
  recurrenceIntervalUnit: RecurrenceIntervalUnit;
  setRecurrenceIntervalUnit: (value: RecurrenceIntervalUnit) => void;
  recurrenceSummary: string;
  removeVisit: (id: string) => void;
  additionalExpenses: string;
  setAdditionalExpenses: (value: string) => void;
  expenseDescription: string;
  setExpenseDescription: (value: string) => void;
  contractorNotes: string;
  setContractorNotes: (value: string) => void;
  previewFinance: { expectedRevenue: number; expectedAdditionalExpense: number };
  previewProfit: number;
  showAdvancedProperty: boolean;
  setShowAdvancedProperty: (value: boolean) => void;
  accessInstructions: string;
  setAccessInstructions: (value: string) => void;
  initialPhotos: File[];
  setInitialPhotos: (files: File[]) => void;
  loading: boolean;
}) {
  const c = props.createCopy;
  const r = props.recurrenceCopy;
  return (
    <>
      <section className="job-create-section">
        <h4>{c.jobDetailsHeading}</h4>
        <label>{c.jobTitle}</label>
        <input className="input" placeholder={c.jobTitlePlaceholder} value={props.title} onChange={(e) => props.setTitle(e.target.value)} required />
      </section>

      <section className="job-create-section">
        <h4>{r.scheduleHeading}</h4>
        <label htmlFor="recurrence-starts-on">{props.isRecurring ? r.startsOn : c.date}</label>
        <input id="recurrence-starts-on" name="recurrence_starts_on" className="input" type="date" required={props.isRecurring} aria-required={props.isRecurring ? 'true' : undefined} aria-invalid={Boolean(props.recurrenceFieldErrors.startDate)} value={props.primaryVisit?.visit_date || props.recurrenceStartDate} onChange={(e) => props.setSeriesStartDate(e.target.value)} />
        {props.recurrenceFieldErrors.startDate ? <p className="auth-message auth-message-error" role="alert">{props.recurrenceFieldErrors.startDate}</p> : null}
        <div className="grid-2" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label htmlFor="job-start-time">{r.startTime}</label>
            <input id="job-start-time" className="input" type="time" aria-invalid={Boolean(props.recurrenceFieldErrors.startTime)} value={props.primaryVisit?.start_time || ''} onChange={(e) => { if (!props.primaryVisit) return; props.setRecurrenceFieldErrors((current) => ({ ...current, startTime: undefined })); props.updateVisit(props.primaryVisit.id, { start_time: e.target.value }); }} />
            {props.recurrenceFieldErrors.startTime ? <p className="auth-message auth-message-error" role="alert">{props.recurrenceFieldErrors.startTime}</p> : null}
          </div>
          <div className="form-group">
            <label htmlFor="job-end-time">{r.endTime}</label>
            <input id="job-end-time" className="input" type="time" value={props.primaryVisit?.end_time || ''} onChange={(e) => props.primaryVisit && props.updateVisit(props.primaryVisit.id, { end_time: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="job-create-section">
        <h4>{c.customerPriceHeading}</h4>
        <p className="muted">{c.customerPriceHelp}</p>
        <label>{c.customerPrice}</label>
        <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={props.clientIncome} onChange={(e) => props.setClientIncome(e.target.value)} />
      </section>

      <section className="job-create-section">
        <h4>{c.workerHeading}</h4>
        <label htmlFor="assigned-to">{c.assignWorker}</label>
        <select id="assigned-to" className="input" value={props.assignedTo} onChange={(e) => props.setAssignedTo(e.target.value)} disabled={props.loadingTeam}>
          <option value="">{c.unassigned}</option>
          {props.teamMembers.map((member) => <option key={member.userId} value={member.userId}>{member.label} · {props.roleLabel(member.role)}</option>)}
        </select>
        <label style={{ marginTop: 16 }}>{c.workerPrice}</label>
        <p className="muted">{c.workerPriceHelp}</p>
        <div className="segmented-control" role="group" aria-label={getBillingOpsCopy(props.locale).paymentMethod} style={{ marginTop: 8 }}>
          <button type="button" className={`btn${props.contractorPayMode === 'flat' ? ' btn-primary' : ''}`} onClick={() => props.setContractorPayMode('flat')}>{c.flatRate}</button>
          <button type="button" className={`btn${props.contractorPayMode === 'hourly' ? ' btn-primary' : ''}`} onClick={() => props.setContractorPayMode('hourly')}>{c.hourly}</button>
        </div>
        {props.contractorPayMode === 'hourly' ? (
          <>
            <div className="grid-2" style={{ marginTop: 10 }}>
              <div className="form-group"><label>{c.hours}</label><input className="input" type="number" min="0" step="0.25" value={props.contractorHours} onChange={(e) => props.setContractorHours(e.target.value)} /></div>
              <div className="form-group"><label>{c.workerHourlyRate}</label><input className="input" type="number" min="0" step="0.01" value={props.contractorHourlyRate} onChange={(e) => props.setContractorHourlyRate(e.target.value)} /></div>
            </div>
            <p className="muted">{c.workerCost}: ${props.previewContractorPay.toFixed(2)}</p>
          </>
        ) : (
          <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={props.contractorFlatRate} onChange={(e) => props.setContractorFlatRate(e.target.value)} />
        )}
        <label>{c.jobNotes}</label>
        <textarea className="input" rows={3} value={props.notes} onChange={(e) => props.setNotes(e.target.value)} />
      </section>

      <details style={{ marginTop: 12 }}>
        <summary>{c.moreOptions}</summary>
        <section className="job-create-section">
          <label htmlFor="recurrence-frequency">{r.scheduleType}</label>
          <select id="recurrence-frequency" className="input" value={props.recurrenceFrequency} onChange={(e) => {
            const next = e.target.value as RecurrenceFrequency;
            props.setRecurrenceFrequency(next);
            if (next !== 'none') {
              if (props.visits.length > 1) props.setVisits((rows) => [rows[0]]);
              const date = props.visits[0]?.visit_date || props.recurrenceStartDate;
              if (date) props.setSeriesStartDate(date);
            }
            if (next === 'daily') props.setRecurrenceIntervalUnit('days');
            if (next === 'monthly') props.setRecurrenceIntervalUnit('months');
            if (next === 'weekly' || next === 'biweekly' || next === 'every_three_weeks' || next === 'every_four_weeks') props.setRecurrenceIntervalUnit('weeks');
          }}>
            <option value="none">{r.oneTime}</option>
            <option value="daily">{r.daily}</option>
            <option value="weekly">{r.weekly}</option>
            <option value="biweekly">{r.everyTwoWeeks}</option>
            <option value="every_three_weeks">{r.everyThreeWeeks}</option>
            <option value="every_four_weeks">{r.everyFourWeeks}</option>
            <option value="monthly">{r.monthly}</option>
            <option value="custom">{r.custom}</option>
          </select>
          {props.isRecurring ? (
            <>
              {props.showWeekdays ? (
                <fieldset style={{ marginTop: 12, border: 0, padding: 0 }}>
                  <legend style={{ fontWeight: 600 }}>{r.weekdays}</legend>
                  <p className="muted">{r.weekdaysHelp}</p>
                  <div className="segmented-control" role="group" aria-label={r.weekdays} style={{ flexWrap: 'wrap' }}>
                    {props.weekdayLabels.map((label, index) => {
                      const selected = props.recurrenceWeekdays.includes(index);
                      return (
                        <button key={label} type="button" className={`btn${selected ? ' btn-primary' : ''}`} aria-pressed={selected} onClick={() => {
                          props.setRecurrenceFieldErrors((current) => ({ ...current, weekdays: undefined }));
                          props.setRecurrenceWeekdays((current) => {
                            if (current.includes(index)) {
                              const next = current.filter((day) => day !== index);
                              return next.length ? next : current;
                            }
                            return [...current, index].sort((a, b) => a - b);
                          });
                        }}>{label.slice(0, 3)}</button>
                      );
                    })}
                  </div>
                  {props.recurrenceFieldErrors.weekdays ? <p className="auth-message auth-message-error" role="alert">{props.recurrenceFieldErrors.weekdays}</p> : null}
                </fieldset>
              ) : null}
              <label htmlFor="job-timezone">{r.jobTimezone}</label>
              <select id="job-timezone" className="input" value={props.timeZone} onChange={(e) => props.setTimeZone(e.target.value)}>
                <option value="">{r.companyDefaultTimezone}</option>
                {TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <p className="muted">{r.timezoneHelp}</p>
              <label htmlFor="recurrence-end-mode" style={{ marginTop: 12 }}>{r.ends}</label>
              <select id="recurrence-end-mode" className="input" value={props.recurrenceEndMode} onChange={(e) => { props.setRecurrenceEndMode(e.target.value as RecurrenceEndMode); props.setRecurrenceFieldErrors((current) => ({ ...current, endDate: undefined, limit: undefined })); }}>
                <option value="never">{r.neverEnds}</option>
                <option value="on_date">{r.endsOnDate}</option>
                <option value="after_count">{r.endsAfterCount}</option>
              </select>
              {props.recurrenceEndMode === 'on_date' ? <><label htmlFor="recurrence-end-date">{r.endDate}</label><input id="recurrence-end-date" className="input" type="date" aria-invalid={Boolean(props.recurrenceFieldErrors.endDate)} value={props.recurrenceEndDate} onChange={(e) => { props.setRecurrenceEndDate(e.target.value); props.setRecurrenceFieldErrors((current) => ({ ...current, endDate: undefined })); }} />{props.recurrenceFieldErrors.endDate ? <p className="auth-message auth-message-error" role="alert">{props.recurrenceFieldErrors.endDate}</p> : null}</> : null}
              {props.recurrenceEndMode === 'after_count' ? <><label htmlFor="recurrence-limit">{r.occurrenceCount}</label><input id="recurrence-limit" className="input" type="number" min="1" aria-invalid={Boolean(props.recurrenceFieldErrors.limit)} value={props.recurrenceLimit} onChange={(e) => { props.setRecurrenceLimit(e.target.value); props.setRecurrenceFieldErrors((current) => ({ ...current, limit: undefined })); }} />{props.recurrenceFieldErrors.limit ? <p className="auth-message auth-message-error" role="alert">{props.recurrenceFieldErrors.limit}</p> : null}</> : null}
              <details open={props.showRecurrenceAdvanced || props.recurrenceFrequency === 'custom'} onToggle={(e) => props.setShowRecurrenceAdvanced((e.target as HTMLDetailsElement).open)}>
                <summary>{r.advanced}</summary>
                {props.recurrenceFrequency === 'custom' ? <div className="grid-2" style={{ marginTop: 8 }}><div className="form-group"><label>{r.every}</label><input className="input" type="number" min="1" max="365" value={props.recurrenceInterval} onChange={(e) => props.setRecurrenceInterval(e.target.value)} /></div><div className="form-group"><label>{r.unit}</label><select className="input" value={props.recurrenceIntervalUnit} onChange={(e) => props.setRecurrenceIntervalUnit(e.target.value as RecurrenceIntervalUnit)}><option value="days">{r.days}</option><option value="weeks">{r.weeks}</option><option value="months">{r.months}</option></select></div></div> : null}
                <p className="muted">{r.windowHelp}</p>
              </details>
              <p className="muted" style={{ marginTop: 8 }} aria-live="polite"><strong>{r.summaryLabel}:</strong> {props.recurrenceSummary}</p>
            </>
          ) : (
            <>
              <p className="muted">{c.visitsHelp}</p>
              <label htmlFor="job-timezone">{c.jobTimezone}</label>
              <select id="job-timezone" className="input" value={props.timeZone} onChange={(e) => props.setTimeZone(e.target.value)}>
                <option value="">{c.companyDefaultTimezone}</option>
                {TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <p className="muted">{c.timezoneHelp}</p>
              {props.primaryVisit ? <><label>{c.visitNotes}</label><input className="input" value={props.primaryVisit.notes} onChange={(e) => props.updateVisit(props.primaryVisit!.id, { notes: e.target.value })} /></> : null}
              {props.visits.slice(1).map((visit, index) => (
                <div key={visit.id} className="form visit-editor">
                  <label>{c.visitLabel} {index + 2}</label>
                  <input className="input" type="date" value={visit.visit_date} onChange={(e) => props.updateVisit(visit.id, { visit_date: e.target.value })} />
                  <div className="grid-2">
                    <div className="form-group"><label>{c.startTime}</label><input className="input" type="time" value={visit.start_time} onChange={(e) => props.updateVisit(visit.id, { start_time: e.target.value })} /></div>
                    <div className="form-group"><label>{c.endTime}</label><input className="input" type="time" value={visit.end_time} onChange={(e) => props.updateVisit(visit.id, { end_time: e.target.value })} /></div>
                  </div>
                  <label>{c.visitNotes}</label>
                  <input className="input" value={visit.notes} onChange={(e) => props.updateVisit(visit.id, { notes: e.target.value })} />
                  <button className="btn" type="button" onClick={() => props.removeVisit(visit.id)}>{c.removeVisit}</button>
                </div>
              ))}
              <button className="btn" type="button" onClick={() => props.setVisits((rows) => [...rows, props.newVisit()])}>{c.addVisit}</button>
            </>
          )}
        </section>

        <section className="job-create-section">
          <label style={{ marginTop: 12 }}>{c.additionalExpenses}</label>
          <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={props.additionalExpenses} onChange={(e) => props.setAdditionalExpenses(e.target.value)} />
          <label>{c.expenseDescription}</label>
          <input className="input" value={props.expenseDescription} onChange={(e) => props.setExpenseDescription(e.target.value)} placeholder={c.expensePlaceholder} />
          <label style={{ marginTop: 12 }}>{c.workerPayNotes}</label>
          <input className="input" value={props.contractorNotes} onChange={(e) => props.setContractorNotes(e.target.value)} />
          <div className="finance-metric-grid financials-summary-grid" style={{ marginTop: 14 }}>
            <div className="finance-metric"><span className="finance-metric-label">{c.customerPrice}</span><strong>${props.previewFinance.expectedRevenue.toFixed(2)}</strong></div>
            <div className="finance-metric"><span className="finance-metric-label">{c.workerPrice}</span><strong>${props.previewContractorPay.toFixed(2)}</strong></div>
            <div className="finance-metric"><span className="finance-metric-label">{c.additionalExpenses}</span><strong>${props.previewFinance.expectedAdditionalExpense.toFixed(2)}</strong></div>
            <div className="finance-metric featured"><span className="finance-metric-label">{c.expectedProfit}</span><strong>${props.previewProfit.toFixed(2)}</strong></div>
          </div>
          <p className="muted">{c.profitFormula}</p>
        </section>

        <section className="job-create-section">
          <details style={{ marginTop: 12 }} open={props.showAdvancedProperty} onToggle={(e) => props.setShowAdvancedProperty((e.target as HTMLDetailsElement).open)}>
            <summary>{c.accessNotes}</summary>
            <label style={{ marginTop: 10 }}>{c.accessInstructions}</label>
            <textarea className="input" rows={3} value={props.accessInstructions} onChange={(e) => props.setAccessInstructions(e.target.value)} />
            <p className="muted">{c.accessPrivacy}</p>
          </details>
        </section>

        <section className="job-create-section">
          <h4>{c.initialPhotos}</h4>
          <p className="muted">{c.initialPhotosHelp}</p>
          <input className="input" type="file" accept="image/*" multiple onChange={(e) => props.setInitialPhotos(Array.from(e.target.files || []))} />
          {props.initialPhotos.length > 0 ? <p className="muted">{props.initialPhotos.length} {c.photosSelected}</p> : null}
        </section>

        <section className="job-create-section">
          <h4>{c.reviewHeading}</h4>
          <p style={{ margin: 0 }}><strong>{props.recurrenceFrequency === 'none' ? c.oneTimeJob : c.recurringSeries}</strong></p>
          <p className="muted" style={{ marginTop: 6 }}>{props.recurrenceSummary}</p>
          {props.recurrenceFrequency !== 'none' ? <p className="muted">Only the next {RECURRING_GENERATION_WINDOW_DAYS} days of visits are scheduled now. Financial defaults apply to each generated visit.</p> : null}
          <p className="muted" style={{ marginTop: 6 }}>
            {c.perVisit}: ${props.previewFinance.expectedRevenue.toFixed(2)} {c.customerPrice.toLowerCase()} · ${props.previewContractorPay.toFixed(2)} {c.workerPrice.toLowerCase()} · ${props.previewFinance.expectedAdditionalExpense.toFixed(2)} {c.additionalExpenses.toLowerCase()} · ${props.previewProfit.toFixed(2)} {c.expectedProfit.toLowerCase()}
          </p>
        </section>
      </details>

      <Button className="btn-primary unified-job-save" type="submit" disabled={props.loading}>
        {props.loading ? FEEDBACK.loading : c.createJob}
      </Button>
    </>
  );
}
