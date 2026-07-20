'use client';

import { useRouter } from 'next/navigation';

export function ReceiptActions({ jobId }: { jobId: string }) {
  const router = useRouter();

  return (
    <div className="receipt-actions no-print">
      <button type="button" className="btn" onClick={() => router.push(`/jobs/${jobId}`)}>
        Back to job
      </button>
      <button type="button" className="btn btn-primary" onClick={() => window.print()}>
        Print or save PDF
      </button>
    </div>
  );
}
