'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { getReceiptCopy } from '@/lib/i18n/receipt-copy';

type ReceiptActionsProps = {
  jobId: string;
  source: string;
  paymentId: string;
  receiptNumber: string;
};

export function ReceiptActions({ jobId, source, paymentId, receiptNumber }: ReceiptActionsProps) {
  const router = useRouter();
  const { locale } = useTranslation();
  const billing = getBillingOpsCopy(locale);
  const receipt = getReceiptCopy(locale);
  const exportCopy = getExportCopy(locale);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pdfUrl = `/api/jobs/${jobId}/receipts/${source}/${paymentId}`;
  const filename = `${receiptNumber}.pdf`;

  const copy = {
    en: {
      back: 'Back to job',
      download: 'Download PDF',
      share: 'Share or email PDF',
      preparing: 'Preparing PDF…',
      print: 'Print',
      createFailed: 'The receipt PDF could not be created.',
      downloadFailed: 'The receipt PDF could not be downloaded.',
      shareFailed: 'The receipt PDF could not be shared.',
      downloadedHint: 'PDF downloaded. Attach it to your email from Downloads or Files.'
    },
    es: {
      back: 'Volver al trabajo',
      download: 'Descargar PDF',
      share: 'Compartir o enviar PDF',
      preparing: 'Preparando PDF…',
      print: 'Imprimir',
      createFailed: 'No se pudo crear el PDF del recibo.',
      downloadFailed: 'No se pudo descargar el PDF del recibo.',
      shareFailed: 'No se pudo compartir el PDF del recibo.',
      downloadedHint: 'PDF descargado. Adjúntalo a tu correo desde Descargas o Archivos.'
    },
    vi: {
      back: 'Quay lại công việc',
      download: 'Tải PDF',
      share: 'Chia sẻ hoặc gửi PDF',
      preparing: 'Đang chuẩn bị PDF…',
      print: 'In',
      createFailed: 'Không thể tạo PDF biên nhận.',
      downloadFailed: 'Không thể tải PDF biên nhận.',
      shareFailed: 'Không thể chia sẻ PDF biên nhận.',
      downloadedHint: 'Đã tải PDF. Đính kèm vào email từ thư mục Tải xuống hoặc Tệp.'
    }
  }[locale === 'es' || locale === 'vi' ? locale : 'en'];

  async function fetchReceiptPdf() {
    const response = await fetch(pdfUrl, { credentials: 'include' });
    if (!response.ok) throw new Error(copy.createFailed);
    return response.blob();
  }

  async function downloadPdf() {
    setIsPreparing(true);
    setError(null);

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
      setError(downloadError instanceof Error ? downloadError.message : copy.downloadFailed);
    } finally {
      setIsPreparing(false);
    }
  }

  async function sharePdf() {
    setIsPreparing(true);
    setError(null);

    try {
      const blob = await fetchReceiptPdf();
      const file = new File([blob], filename, { type: 'application/pdf' });
      const shareData = {
        title: `${receipt.title} ${receiptNumber}`,
        text: `${billing.paymentReceipt} ${receiptNumber}`,
        files: [file]
      };

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share(shareData);
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setError(copy.downloadedHint);
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setError(shareError instanceof Error ? shareError.message : copy.shareFailed);
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <div className="receipt-actions no-print">
      <button type="button" className="btn receipt-action-btn" onClick={() => router.push(`/jobs/${jobId}`)}>
        {copy.back}
      </button>
      <button type="button" className="btn receipt-action-btn" onClick={downloadPdf} disabled={isPreparing}>
        {copy.download}
      </button>
      <button type="button" className="btn btn-primary receipt-action-btn" onClick={sharePdf} disabled={isPreparing}>
        {isPreparing ? copy.preparing || exportCopy.preparingExport : copy.share}
      </button>
      <button type="button" className="btn receipt-action-btn" onClick={() => window.print()} disabled={isPreparing}>
        {copy.print}
      </button>
      {error ? <p className="receipt-action-message" role="status">{error}</p> : null}
    </div>
  );
}
