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
  directPaymentTotal: number;
};

const JOB_GUIDANCE_REFRESH_EVENT = 'everittos:job-guidance-refresh';

const copy = {
  en: {
    nextAction: 'Next action', setClientPay: 'Set client pay', assignWorker: 'Assign worker', setWorkerPay: 'Set worker pay', setSchedule: 'Set schedule', startJob: 'Start job', createInvoice: 'Create invoice', recordPayment: 'Record payment', markComplete: 'Mark job complete', complete: 'Job is complete', review: 'Review job', hint: 'Suggested from the current job status. You can still jump to any section below.', working: 'Updating...'
  },
  es: {
    nextAction: 'Siguiente acción', setClientPay: 'Agregar pago del cliente', assignWorker: 'Asignar trabajador', setWorkerPay: 'Agregar pago del trabajador', setSchedule: 'Programar trabajo', startJob: 'Iniciar trabajo', createInvoice: 'Crear factura', recordPayment: 'Registrar pago', markComplete: 'Marcar trabajo completo', complete: 'Trabajo completo', review: 'Revisar trabajo', hint: 'Sugerencia basada en el estado actual. Aún puedes ir a cualquier sección.', working: 'Actualizando...'
  },
  vi: {
    nextAction: 'Việc tiếp theo', setClientPay: 'Nhập tiền khách trả', assignWorker: 'Giao nhân sự', setWorkerPay: 'Nhập tiền trả nhân sự', setSchedule: 'Đặt lịch', startJob: 'Bắt đầu công việc', createInvoice: 'Tạo hóa đơn', recordPayment: 'Ghi nhận thanh toán', markComplete: 'Đánh dấu hoàn tất', complete: 'Công việc đã hoàn tất', review: 'Xem công việc', hint: 'Gợi ý dựa trên trạng thái hiện tại. Bạn vẫn có thể mở bất kỳ mục nào bên dưới.', working: 'Đang cập nhật...'
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
    if (section instanceof HTMLDetailsElement) section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export function JobGuidancePanel() {
  const pathname = usePathname();
  const { locale } = useTranslation();
  const c = copy[locale];
  const jobId = useMemo(() => isJobDetailPath(pathname), [pathname]);
  const [state, setState] = useState<GuidanceState | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!jobId) return;
    const { data: job } = await supabase
      .from('jobs')
      .select('id, status, scheduled_start, start_date, assigned_to, assigned_email')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) return;

    const [assignmentsRes, invoicesRes, outboundInvoicesRes, jobPaymentsRes, financialRes] = await Promise.all([
      supabase.from('job_assignments').select('id').eq('job_id', jobId).limit(1),
      supabase.from('invoices').select('id, amount, amount_paid, status, payment_status').eq('job_id', jobId).order('created_at', { ascending: false }).limit(1),
      supabase.from('outbound_documents').select('id, amount, amount_paid, status, payment_status').eq('doc_type', 'invoice').eq('job_id', jobId).order('created_at', { ascending: false }).limit(1),
      supabase.from('job_payments').select('amount').eq('job_id', jobId),
      fetch(`/api/jobs/owner-financials?ids=${encodeURIComponent(jobId)}`, { cache: 'no-store' }).then(async (res) => res.ok ? await res.json() : null).catch(() => null)
    ]);

    const financials = financialRes?.financials?.[jobId] || null;
    const canonicalRaw = ((invoicesRes.data || [])[0] || null) as (InvoiceRow & { payment_status?: string | null }) | null;
    const outboundInvoice = ((outboundInvoicesRes.data || [])[0] || null) as (InvoiceRow & { payment_status?: string | null }) | null;
    const sourceInvoice = canonicalRaw || outboundInvoice;
    const invoice = sourceInvoice ? {
      id: sourceInvoice.id,
      amount: sourceInvoice.amount,
      amount_paid: sourceInvoice.amount_paid,
      status: sourceInvoice.payment_status || sourceInvoice.status
    } : null;
    const directPaymentTotal = ((jobPaymentsRes.data || []) as Array<{ amount: number | null }>).reduce((sum: number, row) => sum + Number(row.amount || 0), 0);

    setState({
      job: job as JobRow,
      assigned: Boolean(job.assigned_to || job.assigned_email || (assignmentsRes.data || []).length),
      financials,
      invoice,
      directPaymentTotal
    });
  }

  useEffect(() => {
    if (!jobId) {
      setState(null);
      return;
    }
    void load();
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    window.addEventListener(JOB_GUIDANCE_REFRESH_EVENT, refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener(JOB_GUIDANCE_REFRESH_EVENT, refresh);
    };
  }, [jobId]);

  if (!jobId || !state) return null;

  const currentState = state;
  const currentJobId = jobId;
  const clientPaySet = currentState.financials?.customerPay != null;
  const workerPaySet = currentState.financials?.contractorPay != null;
  const scheduleSet = Boolean(currentState.job.scheduled_start || currentState.job.start_date);
  const invoiceExists = Boolean(currentState.invoice);
  const invoiceAmount = Number(currentState.invoice?.amount || 0);
  const invoiceLedgerPaid = Number(currentState.invoice?.amount_paid || 0);
  const amountPaid = Math.max(invoiceLedgerPaid, currentState.directPaymentTotal);
  const invoiceStatus = String(currentState.invoice?.status || '').toLowerCase();
  const paymentPaid = invoiceExists && (invoiceStatus === 'paid' || (invoiceAmount > 0 && amountPaid >= invoiceAmount));
  const status = String(currentState.job.status || '').toLowerCase();
  const scheduledAt = currentState.job.scheduled_start ? new Date(currentState.job.scheduled_start) : null;
  const pastDue = Boolean(scheduledAt && !Number.isNaN(scheduledAt.getTime()) && scheduledAt.getTime() < Date.now() && !['active', 'in_progress', 'completed', 'cancelled'].includes(status));

  let action: { label: string; terms: string[]; direct: string } = { label: c.review, terms: ['overview'], direct: '' };
  if (!clientPaySet) action = { label: c.setClientPay, terms: ['money', 'profit'], direct: '' };
  else if (!currentState.assigned) action = { label: c.assignWorker, terms: ['assigned', 'worker', 'contractor'], direct: '' };
  else if (!workerPaySet) action = { label: c.setWorkerPay, terms: ['money', 'labor', 'worker'], direct: '' };
  else if (!scheduleSet) action = { label: c.setSchedule, terms: ['schedule'], direct: '' };
  else if (pastDue || ['scheduled', 'new', 'pending'].includes(status)) action = { label: c.startJob, terms: [], direct: 'active' };
  else if (status === 'completed' && !invoiceExists) action = { label: c.createInvoice, terms: [], direct: 'create_invoice' };
  else if (invoiceExists && !paymentPaid) action = { label: c.recordPayment, terms: [], direct: 'record_payment' };
  else if (!['completed', 'cancelled'].includes(status)) action = { label: c.markComplete, terms: [], direct: 'completed' };
  else if (status === 'completed') action = { label: c.complete, terms: ['overview'], direct: '' };

  async function updateStatusDirect(nextStatus: 'active' | 'completed') {
    if (busy) return;
    setBusy(true);
    const previous = currentState.job.status;
    setState((current) => current ? { ...current, job: { ...current.job, status: nextStatus } } : current);
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(currentJobId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!response.ok) {
        setState((current) => current ? { ...current, job: { ...current.job, status: previous } } : current);
        return;
      }
      window.dispatchEvent(new CustomEvent(JOB_GUIDANCE_REFRESH_EVENT));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runAction() {
    if (busy) return;
    if (action.direct === 'create_invoice') {
      window.location.href = `/invoices?jobId=${currentJobId}&action=new`;
      return;
    }
    if (action.direct === 'record_payment') {
      window.location.href = `/invoices?jobId=${currentJobId}&payment=unpaid`;
      return;
    }
    if (action.direct === 'active' || action.direct === 'completed') {
      await updateStatusDirect(action.direct);
      return;
    }
    scrollToSection(action.terms);
  }

  return (
    <section className="job-guidance-panel" aria-label={c.nextAction}>
      <div className="job-guidance-next">
        <div>
          <span className="job-guidance-eyebrow">{c.nextAction}</span>
          <strong>{action.label}</strong>
          <p>{c.hint}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void runAction()} disabled={busy || action.label === c.complete}>{busy ? c.working : action.label}</button>
      </div>
      <style jsx>{`
        .job-guidance-panel { width: 100%; min-width: 0; margin: 0 0 18px; box-sizing: border-box; }
        .job-guidance-next { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 18px; border: 1px solid rgba(37,54,74,.14); border-radius: 16px; background: rgba(255,255,255,.96); box-shadow: 0 8px 24px rgba(37,54,74,.07); box-sizing: border-box; }
        .job-guidance-next > div { min-width: 0; }
        .job-guidance-eyebrow { display: block; margin-bottom: 5px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #52606d; }
        .job-guidance-next strong { display: block; max-width: 100%; font-size: clamp(20px, 3vw, 28px); line-height: 1.15; overflow-wrap: anywhere; }
        .job-guidance-next p { margin: 6px 0 0; color: #66727c; font-size: 14px; line-height: 1.45; }
        .job-guidance-next .btn { flex: 0 0 auto; min-height: 48px; touch-action: manipulation; }
        @media (max-width: 640px) {
          .job-guidance-next { align-items: stretch; flex-direction: column; gap: 14px; }
          .job-guidance-next .btn { width: 100%; }
        }
      `}</style>
    </section>
  );
}
