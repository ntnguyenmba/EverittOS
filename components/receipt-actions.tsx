'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ReceiptActionsProps = {
  jobId: string;
  source: string;
  paymentId: string;
  receiptNumber: string;
};

export function ReceiptActions({ jobId, source, paymentId, receiptNumber }: ReceiptActionsProps) {
  const router = useRouter();
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pdfUrl = `/api/jobs/${jobId}/receipts/${source}/${paymentId}`;
  const filename = `${receiptNumber}.pdf`;

  async function fetchReceiptPdf() {
    const response = await fetch(pdfUrl, { credentials: 'include' });
    if (!response.ok) throw new Error('The receipt PDF could not be created.');
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
      setError(downloadError instanceof Error ? downloadError.message : 'The receipt PDF could not be downloaded.');
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
        title: `Payment receipt ${receiptNumber}`,
        text: `Payment receipt ${receiptNumber}`,
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
      setError('PDF downloaded. Attach it to your email from Downloads or Files.');
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setError(shareError instanceof Error ? shareError.message : 'The receipt PDF could not be shared.');
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <div className="receipt-actions no-print">
      <button type="button" className="btn receipt-action-btn" onClick={() => router.push(`/jobs/${jobId}`)}>
        Back to job
      </button>
      <button type="button" className="btn receipt-action-btn" onClick={downloadPdf} disabled={isPreparing}>
        Download PDF
      </button>
      <button type="button" className="btn btn-primary receipt-action-btn" onClick={sharePdf} disabled={isPreparing}>
        {isPreparing ? 'Preparing PDF...' : 'Share or email PDF'}
      </button>
      <button type="button" className="btn receipt-action-btn" onClick={() => window.print()} disabled={isPreparing}>
        Print
      </button>
      {error ? <p className="receipt-action-message" role="status">{error}</p> : null}
    </div>
  );
}
