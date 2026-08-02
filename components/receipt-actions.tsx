'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';

type ReceiptActionsProps = {
  jobId: string;
  source: string;
  paymentId: string;
  receiptNumber: string;
};

export function ReceiptActions({ jobId, source, paymentId, receiptNumber }: ReceiptActionsProps) {
  const router = useRouter();
  const { locale } = useTranslation();
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const pdfUrl = `/api/jobs/${jobId}/receipts/${source}/${paymentId}`;
  const sendUrl = `/api/jobs/${jobId}/receipts/${source}/${paymentId}/send`;
  const filename = `${receiptNumber}.pdf`;

  const copy = {
    en: {
      back: 'Back to job',
      download: 'Download',
      email: 'Email receipt',
      sending: 'Sending…',
      preparing: 'Preparing…',
      print: 'Print',
      createFailed: 'The receipt PDF could not be created.',
      downloadFailed: 'The receipt could not be downloaded.',
      emailFailed: 'The receipt could not be emailed.',
      emailSent: 'Receipt emailed to'
    },
    es: {
      back: 'Volver al trabajo',
      download: 'Descargar',
      email: 'Enviar recibo por correo',
      sending: 'Enviando…',
      preparing: 'Preparando…',
      print: 'Imprimir',
      createFailed: 'No se pudo crear el PDF del recibo.',
      downloadFailed: 'No se pudo descargar el recibo.',
      emailFailed: 'No se pudo enviar el recibo por correo.',
      emailSent: 'Recibo enviado a'
    },
    vi: {
      back: 'Quay lại công việc',
      download: 'Tải xuống',
      email: 'Gửi biên nhận qua email',
      sending: 'Đang gửi…',
      preparing: 'Đang chuẩn bị…',
      print: 'In',
      createFailed: 'Không thể tạo PDF biên nhận.',
      downloadFailed: 'Không thể tải biên nhận.',
      emailFailed: 'Không thể gửi biên nhận qua email.',
      emailSent: 'Đã gửi biên nhận đến'
    }
  }[locale === 'es' || locale === 'vi' ? locale : 'en'];

  async function fetchReceiptPdf() {
    const response = await fetch(pdfUrl, { credentials: 'include' });
    if (!response.ok) throw new Error(copy.createFailed);
    return response.blob();
  }

  async function downloadPdf() {
    setIsPreparing(true);
    setMessage(null);
    setMessageIsError(false);

    try {
      const blob = await fetchReceiptPdf();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setMessageIsError(true);
      setMessage(downloadError instanceof Error ? downloadError.message : copy.downloadFailed);
    } finally {
      setIsPreparing(false);
    }
  }

  async function emailReceipt() {
    if (isSending) return;
    setIsSending(true);
    setMessage(null);
    setMessageIsError(false);

    try {
      const response = await fetch(sendUrl, {
        method: 'POST',
        credentials: 'include'
      });
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        recipientEmail?: string | null;
      };

      if (!response.ok) {
        throw new Error(json.error || copy.emailFailed);
      }

      setMessage(`${copy.emailSent} ${json.recipientEmail || ''}`.trim());
    } catch (sendError) {
      setMessageIsError(true);
      setMessage(sendError instanceof Error ? sendError.message : copy.emailFailed);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="receipt-actions no-print">
      <button type="button" className="btn receipt-action-btn" onClick={() => router.push(`/jobs/${jobId}`)}>
        {copy.back}
      </button>
      <button type="button" className="btn receipt-action-btn" onClick={downloadPdf} disabled={isPreparing || isSending}>
        {isPreparing ? copy.preparing : copy.download}
      </button>
      <button
        type="button"
        className="btn btn-primary receipt-action-btn"
        onClick={emailReceipt}
        disabled={isSending || isPreparing}
      >
        {isSending ? copy.sending : copy.email}
      </button>
      <button type="button" className="btn receipt-action-btn" onClick={() => window.print()} disabled={isPreparing || isSending}>
        {copy.print}
      </button>
      {message ? (
        <p className={`receipt-action-message${messageIsError ? ' error' : ''}`} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
