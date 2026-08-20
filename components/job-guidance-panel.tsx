'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { supabase } from '@/lib/supabase';

type JobRow = {
  id: string;
  status: string | null;
  scheduled_start: string | null;
  start_date: string | null;
  assigned_to: string | null;
  assigned_email: string | null;
};

type FinancialRow = {
  customerPay: number | null;
  contractorPay: number | null;
};

type InvoiceRow = {
  id: string;
  amount: number | null;
  amount_paid: number | null;
  status: string | null;
};

type GuidanceState = {
  job: JobRow;
  assigned: boolean;
  financials: FinancialRow | null;
  invoice: InvoiceRow | null;
};

const copy = {
  en: {
    nextAction: 'Next action',
    clientPay: 'Client pay',
    worker: 'Worker',
    workerPay: 'Worker pay',
    schedule: 'Schedule',
    invoice: 'Invoice',
    payment: 'Payment',
    set: 'Set',
    missing: 'Missing',
    assigned: 'Assigned',
    scheduled: 'Scheduled',
    created: 'Created',
    notCreated: 'Not created',
    paid: 'Paid',
    unpaid: 'Unpaid',
    partial: 'Partial',
    setClientPay: 'Set client pay',
    assignWorker: 'Assign worker',
    setWorkerPay: 'Set worker pay',
    setSchedule: 'Set schedule',
    startJob: 'Start job',
    createInvoice: 'Create invoice',
    recordPayment: 'Record payment',
    markComplete: 'Mark job complete',
    complete: 'Job is complete',
    review: 'Review job',
    moreDetails: 'More job details',
    fewerDetails: 'Show fewer details',
    hint: 'Suggested from the current job status. You can still jump to any section below.'
  },
  es: {
    nextAction: 'Siguiente acción', clientPay: 'Pago del cliente', worker: 'Trabajador', workerPay: 'Pago al trabajador', schedule: 'Horario', invoice: 'Factura', payment: 'Pago', set: 'Listo', missing: 'Falta', assigned: 'Asignado', scheduled: 'Programado', created: 'Creada', notCreated: 'No creada', paid: 'Pagado', unpaid: 'Pendiente', partial: 'Parcial', setClientPay: 'Agregar pago del cliente', assignWorker: 'Asignar trabajador', setWorkerPay: 'Agregar pago del trabajador', setSchedule: 'Programar trabajo', startJob: 'Iniciar trabajo', createInvoice: 'Crear factura', recordPayment: 'Registrar pago', markComplete: 'Marcar trabajo completo', complete: 'Trabajo completo', review: 'Revisar trabajo', moreDetails: 'Más detalles del trabajo', fewerDetails: 'Mostrar menos detalles', hint: 'Sugerencia basada en el estado actual. Aún puedes ir a cualquier sección.'
  },
  vi: {
    nextAction: 'Việc tiếp theo', clientPay: 'Khách trả', worker: 'Nhân sự', workerPay: 'Trả nhân sự', schedule: 'Lịch', invoice: 'Hóa đơn', payment: 'Thanh toán', set: 'Đã đặt', missing: 'Còn thiếu', assigned: 'Đã giao', scheduled: 'Đã lên lịch', created: 'Đã tạo', notCreated: 'Chưa tạo', paid: 'Đã trả', unpaid: 'Chưa trả', partial: 'Một phần', setClientPay: 'Nhập tiền khách trả', assignWorker: 'Giao nhân sự', setWorkerPay: 'Nhập tiền trả nhân sự', setSchedule: 'Đặt lịch', startJob: 'Bắt đầu công việc', createInvoice: 'Tạo hóa đơn', recordPayment: 'Ghi nhận thanh toán', markComplete: 'Đánh dấu hoàn tất', complete: 'Công việc đã hoàn tất', review: 'Xem công việc', moreDetails: 'Xem thêm chi tiết', fewerDetails: 'Thu gọn chi tiết', hint: 'Gợi ý dựa trên trạng thái hiện tại. Bạn vẫn có thể mở bất kỳ mục nào bên dưới.'
  }
} as const;

function isJobDetailPath(pathname: string) {
  const match = pathname.match(/^\/jobs\/([^/]+)$/);
  if (!match) return null;
  const id = match[1];
  if (!id || ['new', 'calendar', 'duplicate-cleanup'].includes(id)) return null;
  return id;
}

function scrollToSection(terms: string[]) {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('.job-detail-shell h2, .job-detail-shell h3, .job-detail-shell summary, .job-detail-shell label'));
  const target = nodes.find((node) => {
    const text = (node.textContent || '').toLowerCase();
    return terms.some((term) => text.includes(term.toLowerCase()));
  });
  const section = target?.closest<HTMLElement>('section, details, .card') || target;
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (section instanceof HTMLDetailsElement) section.open = true;
  }
}

export function JobGuidancePanel() {
  const pathname = usePathname();
  const { locale } = useTranslation();
  const c = copy[locale];
  const jobId = useMemo(() => isJobDetailPath(pathname), [pathname]);
  const [state, setState] = useState<GuidanceState | null>(null);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  useEffect(() => {
    setShowMoreDetails(false);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    document.documentElement.classList.toggle('job-secondary-details-expanded', showMoreDetails);
    return () => document.documentElement.classList.remove('job-secondary-details-expanded');
  }, [jobId, showMoreDetails]);

  useEffect(() => {
    if (!jobId) {
      setState(null);
      return;
    }

    let cancelled = false;
    async function load() {
      const { data: job } = await supabase
        .from('jobs')
        .select('id, status, scheduled_start, start_date, assigned_to, assigned_email')
        .eq('id', jobId)
        .maybeSingle();
      if (!job || cancelled) return;

      const [assignmentsRes, invoicesRes, financialRes] = await Promise.all([
        supabase.from('job_assignments').select('id').eq('job_id', jobId).limit(1),
        supabase.from('invoices').select('id, amount, amount_paid, status').eq('job_id', jobId).order('created_at', { ascending: false }).limit(1),
        fetch(`/api/jobs/owner-financials?ids=${encodeURIComponent(jobId)}`, { cache: 'no-store' }).then(async (res) => res.ok ? await res.json() : null).catch(() => null)
      ]);

      if (cancelled) return;
      const financials = financialRes?.financials?.[jobId] || null;
      setState({
        job: job as JobRow,
        assigned: Boolean(job.assigned_to || job.assigned_email || (assignmentsRes.data || []).length),
        financials,
        invoice: ((invoicesRes.data || [])[0] || null) as InvoiceRow | null
      });
    }

    void load();
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 45000);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, [jobId]);

  if (!jobId || !state) return null;

  const clientPaySet = state.financials?.customerPay != null;
  const workerPaySet = state.financials?.contractorPay != null;
  const scheduleSet = Boolean(state.job.scheduled_start || state.job.start_date);
  const invoiceExists = Boolean(state.invoice);
  const invoiceAmount = Number(state.invoice?.amount || 0);
  const amountPaid = Number(state.invoice?.amount_paid || 0);
  const paymentState = !invoiceExists ? c.notCreated : invoiceAmount > 0 && amountPaid >= invoiceAmount ? c.paid : amountPaid > 0 ? c.partial : c.unpaid;
  const status = String(state.job.status || '').toLowerCase();
  const scheduledAt = state.job.scheduled_start ? new Date(state.job.scheduled_start) : null;
  const pastDue = Boolean(scheduledAt && !Number.isNaN(scheduledAt.getTime()) && scheduledAt.getTime() < Date.now() && !['active', 'in_progress', 'completed', 'cancelled'].includes(status));

  let action = { label: c.review, terms: ['overview'], direct: '' };
  if (!clientPaySet) action = { label: c.setClientPay, terms: ['money', 'profit'], direct: '' };
  else if (!state.assigned) action = { label: c.assignWorker, terms: ['assigned', 'worker', 'contractor'], direct: '' };
  else if (!workerPaySet) action = { label: c.setWorkerPay, terms: ['money', 'labor', 'worker'], direct: '' };
  else if (!scheduleSet) action = { label: c.setSchedule, terms: ['schedule'], direct: '' };
  else if (pastDue) action = { label: c.startJob, terms: [], direct: 'active' };
  else if (status === 'completed' && !invoiceExists) action = { label: c.createInvoice, terms: [], direct: 'invoice' };
  else if (invoiceExists && paymentState !== c.paid) action = { label: c.recordPayment, terms: [], direct: 'invoice' };
  else if (status !== 'completed' && status !== 'cancelled') action = { label: c.markComplete, terms: [], direct: 'completed' };
  else if (status === 'completed') action = { label: c.complete, terms: ['overview'], direct: '' };

  async function runAction() {
    if (action.direct === 'invoice') {
      window.location.href = `/invoices?jobId=${jobId}`;
      return;
    }
    if (action.direct === 'active' || action.direct === 'completed') {
      const buttonText = action.direct === 'active' ? ['start job', 'iniciar trabajo', 'bắt đầu'] : ['mark completed', 'complete', 'completado', 'hoàn tất'];
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.job-detail-shell button'));
      const button = buttons.find((item) => buttonText.some((text) => (item.textContent || '').toLowerCase().includes(text)));
      button?.click();
      return;
    }
    scrollToSection(action.terms);
  }

  const items = [
    { label: c.clientPay, value: clientPaySet ? c.set : c.missing, bad: !clientPaySet, terms: ['money', 'profit'] },
    { label: c.worker, value: state.assigned ? c.assigned : c.missing, bad: !state.assigned, terms: ['assigned', 'worker', 'contractor'] },
    { label: c.workerPay, value: workerPaySet ? c.set : c.missing, bad: !workerPaySet, terms: ['money', 'labor'] },
    { label: c.schedule, value: scheduleSet ? c.scheduled : c.missing, bad: !scheduleSet, terms: ['schedule'] },
    { label: c.invoice, value: invoiceExists ? c.created : c.notCreated, bad: !invoiceExists, terms: [] },
    { label: c.payment, value: paymentState, bad: paymentState !== c.paid, terms: [] }
  ];

  return (
    <section className="job-guidance-panel" aria-label={c.nextAction}>
      <div className="job-guidance-next">
        <div>
          <span className="job-guidance-eyebrow">{c.nextAction}</span>
          <strong>{action.label}</strong>
          <p>{c.hint}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void runAction()} disabled={action.label === c.complete}>{action.label}</button>
      </div>
      <div className="job-guidance-status" aria-label="Job status summary">
        {items.map((item) => (
          <button key={item.label} type="button" className={item.bad ? 'is-missing' : 'is-complete'} onClick={() => item.terms.length ? scrollToSection(item.terms) : item.label === c.invoice || item.label === c.payment ? (window.location.href = `/invoices?jobId=${jobId}`) : undefined}>
            <span>{item.label}</span><strong>{item.value}</strong>
          </button>
        ))}
      </div>
      <button type="button" className="job-guidance-more" aria-expanded={showMoreDetails} onClick={() => setShowMoreDetails((value) => !value)}>
        {showMoreDetails ? c.fewerDetails : c.moreDetails}
      </button>
      <style jsx>{`
        .job-guidance-panel { margin: 0 0 18px; display: grid; gap: 10px; }
        .job-guidance-next { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 18px; border: 1px solid rgba(37,54,74,.14); border-radius: 16px; background: rgba(255,255,255,.96); box-shadow: 0 8px 24px rgba(37,54,74,.07); }
        .job-guidance-next > div { min-width: 0; }
        .job-guidance-eyebrow { display: block; margin-bottom: 5px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #52606d; }
        .job-guidance-next strong { display: block; font-size: clamp(20px, 3vw, 28px); line-height: 1.15; }
        .job-guidance-next p { margin: 6px 0 0; color: #66727c; font-size: 14px; }
        .job-guidance-next .btn { flex: 0 0 auto; min-height: 44px; }
        .job-guidance-status { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap: 8px; }
        .job-guidance-status button { min-width: 0; min-height: 64px; padding: 10px 12px; border: 1px solid rgba(37,54,74,.12); border-radius: 12px; background: rgba(255,255,255,.92); color: inherit; text-align: left; cursor: pointer; }
        .job-guidance-status button span { display: block; color: #66727c; font-size: 12px; margin-bottom: 4px; }
        .job-guidance-status button strong { display: block; font-size: 14px; line-height: 1.2; }
        .job-guidance-status button.is-missing { border-color: rgba(158,83,58,.28); background: rgba(255,249,246,.97); }
        .job-guidance-more { min-height: 42px; width: fit-content; padding: 0 4px; border: 0; background: transparent; color: #3f586a; font: inherit; font-weight: 700; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
        @media (max-width: 900px) { .job-guidance-status { grid-template-columns: repeat(3, minmax(0,1fr)); } }
        @media (max-width: 640px) { .job-guidance-next { align-items: stretch; flex-direction: column; padding: 16px; } .job-guidance-next .btn { width: 100%; } .job-guidance-status { grid-template-columns: repeat(2, minmax(0,1fr)); } .job-guidance-status button { min-height: 60px; } .job-guidance-more { width: 100%; text-align: center; } }
      `}</style>
      <style jsx global>{`
        html:not(.job-secondary-details-expanded) .job-detail-shell > .job-photos-card,
        html:not(.job-secondary-details-expanded) .job-detail-shell > details.card {
          display: none !important;
        }
        html.job-secondary-details-expanded .job-detail-shell > .job-photos-card,
        html.job-secondary-details-expanded .job-detail-shell > details.card {
          display: block;
        }
      `}</style>
    </section>
  );
}
