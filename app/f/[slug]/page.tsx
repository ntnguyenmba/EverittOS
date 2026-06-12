'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { EverittFormField } from '@/lib/os-types';

type PublicForm = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const res = await fetch(`/api/forms/public/${slug}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error || 'Submission failed');
      return;
    }
    setDone(true);
  }

  if (loading) {
    return (
      <main className="public-form-page">
        <p>Loading…</p>
      </main>
    );
  }

  if (error && !form) {
    return (
      <main className="public-form-page">
        <p className="auth-message auth-message-error">{error}</p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="public-form-page">
        <div className="public-form-card">
          <h1>Thank you</h1>
          <p>Your submission was received. We will be in touch shortly.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="public-form-page">
      <form className="public-form-card" onSubmit={(e) => void submit(e)}>
        <h1>{form?.name}</h1>
        {form?.description ? <p className="muted">{form.description}</p> : null}
        {fields
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((field) => (
            <label key={field.id} className="public-form-field">
              <span>
                {field.label}
                {field.required ? ' *' : ''}
              </span>
              {field.field_type === 'textarea' ? (
                <textarea
                  className="input"
                  required={field.required}
                  value={values[field.label] || ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.label]: e.target.value }))}
                />
              ) : (
                <input
                  className="input"
                  type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'}
                  required={field.required}
                  value={values[field.label] || ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.label]: e.target.value }))}
                />
              )}
            </label>
          ))}
        {error ? <p className="auth-message auth-message-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Sending…' : 'Submit'}
        </button>
      </form>
    </main>
  );
}
