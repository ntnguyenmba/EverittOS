'use client';

export function ContractorStaticSections() {
  return (
    <style jsx global>{`
      .contractor-dashboard details#schedule > summary,
      .contractor-dashboard details#past-jobs > summary,
      .contractor-dashboard details#earnings > summary {
        cursor: pointer !important;
      }

      .contractor-dashboard details#schedule .contractor-job-card > button,
      .contractor-dashboard details#past-jobs .contractor-job-card > button {
        cursor: default !important;
        pointer-events: none;
      }

      .contractor-dashboard details#schedule .contractor-job-card [aria-expanded],
      .contractor-dashboard details#past-jobs .contractor-job-card [aria-expanded] {
        pointer-events: none;
      }
    `}</style>
  );
}
