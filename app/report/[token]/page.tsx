'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from '@/lib/i18n/config';
import { getJobFinanceCopy } from '@/lib/i18n/job-finance-copy';

type PublicReport = {
  companyName: string;
  jobTitle: string;
  customerName: string | null;
  serviceAddress: string | null;
  completionDate: string | null;
  completionNotes: string | null;
  beforePhotos: Array<{ id: string; url: string; caption: string | null }>;
  afterPhotos: Array<{ id: string; url: string; caption: string | null }>;
  otherPhotos: Array<{ id: string; url: string; caption: string | null }>;
  locale: string | null;
};

type PageProps = {
  params: Promise<{ token: string }>;
};

function resolveLocale(reportLocale: string | null): Locale {
  return normalizeLocale(reportLocale || DEFAULT_LOCALE);
}

export default function PublicCustomerReportPage({ params }: PageProps) {
  const [token, setToken] = useState('');
  const [report, setReport] = useState<PublicReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;

    async function load() {
      setLoading(true);
      const res = await fetch(`/api/public/reports/${encodeURIComponent(token)}`);
      const json = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(json.error || 'This report link is not available.');
        return;
      }
      setReport(json.report as PublicReport);
    }

    void load();
  }, [token]);

  const locale = resolveLocale(report?.locale || null);
  const copy = getJobFinanceCopy(locale);

  if (loading) {
    return (
      <main className="public-report-page">
        <p>{copy.loading}</p>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="public-report-page">
        <div className="card public-report-empty">
          <h1>{copy.reportServiceTitle}</h1>
          <p>{error || copy.reportNotAvailable}</p>
        </div>
      </main>
    );
  }

  const hasPhotos =
    report.beforePhotos.length > 0 || report.afterPhotos.length > 0 || report.otherPhotos.length > 0;

  function renderPhotoGrid(title: string, photos: PublicReport['beforePhotos']) {
    if (!photos.length) return null;
    return (
      <section className="public-report-photos">
        <h2>{title}</h2>
        <div className="public-report-photo-grid">
          {photos.map((photo) => (
            <figure key={photo.id} className="public-report-photo">
              <img src={photo.url} alt={photo.caption || title} loading="lazy" />
              {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      </section>
    );
  }

  return (
    <main className="public-report-page">
      <article className="card public-report-document">
        <header className="public-report-header">
          <p className="public-report-brand">{report.companyName}</p>
          <h1>{report.jobTitle}</h1>
          {report.customerName ? <p>{report.customerName}</p> : null}
          {report.serviceAddress ? <p>{report.serviceAddress}</p> : null}
          {report.completionDate ? <p>{report.completionDate}</p> : null}
        </header>

        {!hasPhotos ? <p className="muted">{copy.reportNoPhotos}</p> : null}

        {renderPhotoGrid(copy.photoBefore, report.beforePhotos)}
        {renderPhotoGrid(copy.photoAfter, report.afterPhotos)}
        {renderPhotoGrid(copy.photoOther, report.otherPhotos)}

        <section className="public-report-summary">
          <h2>{copy.reportCompletionSummary}</h2>
          <p>{report.completionNotes || copy.reportNoPhotos}</p>
        </section>

        <footer className="public-report-footer no-print">
          <p>
            {copy.reportGeneratedOn} {new Date().toLocaleString()}
          </p>
          <button type="button" className="btn" onClick={() => typeof window !== 'undefined' && window.print()}>
            {copy.printReport}
          </button>
        </footer>
      </article>
    </main>
  );
}
