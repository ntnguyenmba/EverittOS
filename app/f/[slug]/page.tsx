'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { calculateEstimate, formatEstimateRange, type EstimateSettings } from '@/lib/estimate-engine';
import type { EverittFormField } from '@/lib/os-types';

type PublicForm = {
  id: string;
  name: string;
  slug: string;
  form_type: string;
  description: string | null;
  estimate_settings?: EstimateSettings | null;
};

export default function PublicFormPage() {
  const params = useParams();
  const slug = String(params.slug);
  const [form, setForm] = useState<PublicForm | null>(null);
  const [fields, setFields] = useState<EverittFormField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/forms/public/${slug}`);
      const json = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(json.error || 'Form not found');
        return;
      }
      setForm(json.form);
      setFields(json.fields || []);
    }
    void load();
  }, [slug]);

  const estimate = useMemo(() => {
    if (form?.form_type !== 'estimate' || !form.estimate_settings) return null;
    const hasBasics = Boolean(values['Service type'] || values['Bedrooms'] || values['Bathrooms'] || values['Approx. sq ft']);
    return hasBasics ? calculateEstimate(form.estimate_settings, values) : null;
  }, [form, values]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const submission = estimate
      ? { ...values, 'Estimated range': formatEstimateRange(estimate), 'Estimate midpoint': String(estimate.midpoint), 'Estimate currency': estimate.currency }
      : values;
    const res = await fetch(`/api/forms/public/${slug}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission)
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error || 'Submission failed');
      return;
    }
    setDone(true);
  }

  if (loading) return <main className="public-form-page"><p>Loading…</p></main>;
  if (error && !form) return <main className="public-form-page"><p className="auth-message auth-message-error">{error}</p></main>;

  if (done) {
    return (
      <main className="public-form-page">
        <div className="public-form-card">
          <h1>Request received</h1>
          {estimate ? <p><strong>Starting range: {formatEstimateRange(estimate)}</strong></p> : null}
          <p>We’ll confirm the exact price and availability shortly.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="public-form-page">
      <form className="public-form-card" onSubmit={(e) => void submit(e)}>
        <h1>{form?.name}</h1>
        {form?.description ? <p className="muted">{form.description}</p> : null}
        {fields.sort((a, b) => a.sort_order - b.sort_order).map((field) => (
          <label key={field.id} className="public-form-field">
            <span>{field.label}{field.required ? ' *' : ''}</span>
            {field.field_type === 'textarea' ? (
              <textarea className="input" required={field.required} value={values[field.label] || ''} onChange={(e) => setValues((v) => ({ ...v, [field.label]: e.target.value }))} />
            ) : field.field_type === 'select' ? (
              <select className="input" required={field.required} value={values[field.label] || ''} onChange={(e) => setValues((v) => ({ ...v, [field.label]: e.target.value }))}>
                <option value="">Choose…</option>
                {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : (
              <input className="input" type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'} required={field.required} value={values[field.label] || ''} onChange={(e) => setValues((v) => ({ ...v, [field.label]: e.target.value }))} />
            )}
          </label>
        ))}

        {estimate ? (
          <div className="card" style={{ margin: '8px 0 4px' }}>
            <p className="muted" style={{ marginBottom: 6 }}>Estimated starting range</p>
            <h2 style={{ margin: 0 }}>{formatEstimateRange(estimate)}</h2>
            <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>Final price is confirmed after the business reviews your request.</p>
          </div>
        ) : null}

        {error ? <p className="auth-message auth-message-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Sending…' : form?.form_type === 'estimate' ? 'Request this estimate' : 'Submit'}
        </button>
      </form>
    </main>
  );
}
