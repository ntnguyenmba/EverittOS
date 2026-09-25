'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
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

const copy = {
  en: {
    loading: 'Loading…', formNotFound: 'Form not found', choose: 'Choose…', received: 'Request received',
    startingRange: 'Starting range', confirm: 'We’ll confirm the exact price and availability shortly.',
    estimatedRange: 'Estimated starting range', rangeNote: 'Final price is confirmed after the business reviews your request.',
    sending: 'Sending…', requestEstimate: 'Request this estimate', submit: 'Submit', failed: 'Submission failed'
  },
  es: {
    loading: 'Cargando…', formNotFound: 'Formulario no encontrado', choose: 'Elegir…', received: 'Solicitud recibida',
    startingRange: 'Rango inicial', confirm: 'Confirmaremos el precio exacto y la disponibilidad en breve.',
    estimatedRange: 'Rango estimado inicial', rangeNote: 'El precio final se confirma después de que el negocio revise tu solicitud.',
    sending: 'Enviando…', requestEstimate: 'Solicitar este estimado', submit: 'Enviar', failed: 'No se pudo enviar'
  },
  vi: {
    loading: 'Đang tải…', formNotFound: 'Không tìm thấy biểu mẫu', choose: 'Chọn…', received: 'Đã nhận yêu cầu',
    startingRange: 'Khoảng giá ban đầu', confirm: 'Chúng tôi sẽ sớm xác nhận giá chính xác và lịch trống.',
    estimatedRange: 'Khoảng giá ước tính ban đầu', rangeNote: 'Giá cuối cùng được xác nhận sau khi doanh nghiệp xem lại yêu cầu của bạn.',
    sending: 'Đang gửi…', requestEstimate: 'Gửi yêu cầu báo giá', submit: 'Gửi', failed: 'Không thể gửi yêu cầu'
  }
} as const;

const fieldLabels: Record<string, Record<'en' | 'es' | 'vi', string>> = {
  Name: { en: 'Name', es: 'Nombre', vi: 'Tên' },
  Email: { en: 'Email', es: 'Correo electrónico', vi: 'Email' },
  Phone: { en: 'Phone', es: 'Teléfono', vi: 'Số điện thoại' },
  Address: { en: 'Address', es: 'Dirección', vi: 'Địa chỉ' },
  'Service type': { en: 'Service type', es: 'Tipo de servicio', vi: 'Loại dịch vụ' },
  Bedrooms: { en: 'Bedrooms', es: 'Dormitorios', vi: 'Phòng ngủ' },
  Bathrooms: { en: 'Bathrooms', es: 'Baños', vi: 'Phòng tắm' },
  'Approx. sq ft': { en: 'Approx. sq ft', es: 'Pies² aproximados', vi: 'Diện tích gần đúng (ft²)' },
  Frequency: { en: 'Frequency', es: 'Frecuencia', vi: 'Tần suất' },
  'Add-ons': { en: 'Add-ons', es: 'Servicios adicionales', vi: 'Dịch vụ thêm' },
  'Special requests': { en: 'Special requests', es: 'Solicitudes especiales', vi: 'Yêu cầu đặc biệt' }
};

const optionLabels: Record<string, Record<'en' | 'es' | 'vi', string>> = {
  'Standard cleaning': { en: 'Standard cleaning', es: 'Limpieza estándar', vi: 'Vệ sinh tiêu chuẩn' },
  'Deep cleaning': { en: 'Deep cleaning', es: 'Limpieza profunda', vi: 'Vệ sinh sâu' },
  'Move-in / Move-out': { en: 'Move-in / Move-out', es: 'Mudanza entrada / salida', vi: 'Dọn vào / dọn ra' },
  'One-time': { en: 'One-time', es: 'Una vez', vi: 'Một lần' },
  Weekly: { en: 'Weekly', es: 'Semanal', vi: 'Hàng tuần' },
  'Bi-weekly': { en: 'Bi-weekly', es: 'Cada dos semanas', vi: 'Hai tuần một lần' },
  Monthly: { en: 'Monthly', es: 'Mensual', vi: 'Hàng tháng' }
};

export default function PublicFormPage() {
  const params = useParams();
  const { locale } = useTranslation();
  const c = copy[locale];
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
      if (!res.ok) { setError(c.formNotFound); return; }
      setForm(json.form);
      setFields(json.fields || []);
    }
    void load();
  }, [slug, c.formNotFound]);

  const estimate = useMemo(() => {
    if (form?.form_type !== 'estimate' || !form.estimate_settings) return null;
    const hasBasics = Boolean(values['Service type'] || values['Bedrooms'] || values['Bathrooms'] || values['Approx. sq ft']);
    return hasBasics ? calculateEstimate(form.estimate_settings, values) : null;
  }, [form, values]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError('');
    const submission = estimate ? { ...values, 'Estimated range': formatEstimateRange(estimate), 'Estimate midpoint': String(estimate.midpoint), 'Estimate currency': estimate.currency } : values;
    const res = await fetch(`/api/forms/public/${slug}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission) });
    setSubmitting(false);
    if (!res.ok) { setError(c.failed); return; }
    setDone(true);
  }

  const labelFor = (label: string) => fieldLabels[label]?.[locale] || label;
  const optionFor = (option: string) => optionLabels[option]?.[locale] || option;

  if (loading) return <main className="public-form-page"><p>{c.loading}</p></main>;
  if (error && !form) return <main className="public-form-page"><p className="auth-message auth-message-error">{error}</p></main>;

  if (done) return <main className="public-form-page"><div className="public-form-card"><h1>{c.received}</h1>{estimate ? <p><strong>{c.startingRange}: {formatEstimateRange(estimate)}</strong></p> : null}<p>{c.confirm}</p></div></main>;

  return (
    <main className="public-form-page">
      <form className="public-form-card" onSubmit={(e) => void submit(e)}>
        <h1>{form?.name}</h1>
        {form?.description ? <p className="muted">{form.description}</p> : null}
        {fields.sort((a, b) => a.sort_order - b.sort_order).map((field) => (
          <label key={field.id} className="public-form-field">
            <span>{labelFor(field.label)}{field.required ? ' *' : ''}</span>
            {field.field_type === 'textarea' ? (
              <textarea className="input" required={field.required} value={values[field.label] || ''} onChange={(e) => setValues((v) => ({ ...v, [field.label]: e.target.value }))} />
            ) : field.field_type === 'select' ? (
              <select className="input" required={field.required} value={values[field.label] || ''} onChange={(e) => setValues((v) => ({ ...v, [field.label]: e.target.value }))}>
                <option value="">{c.choose}</option>
                {(field.options || []).map((option) => <option key={option} value={option}>{optionFor(option)}</option>)}
              </select>
            ) : (
              <input className="input" type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'} required={field.required} value={values[field.label] || ''} onChange={(e) => setValues((v) => ({ ...v, [field.label]: e.target.value }))} />
            )}
          </label>
        ))}
        {estimate ? <div className="card" style={{ margin: '8px 0 4px' }}><p className="muted" style={{ marginBottom: 6 }}>{c.estimatedRange}</p><h2 style={{ margin: 0 }}>{formatEstimateRange(estimate)}</h2><p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>{c.rangeNote}</p></div> : null}
        {error ? <p className="auth-message auth-message-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? c.sending : form?.form_type === 'estimate' ? c.requestEstimate : c.submit}</button>
      </form>
    </main>
  );
}
