'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { useTranslation } from '@/components/locale-provider';
import { PortalClientNav } from '@/components/portal/portal-client-nav';
import { CLIENT_SETTINGS_PATH } from '@/lib/client-portal';
import { clientPortalJobsPath, CLIENT_PORTAL_HOME } from '@/lib/portal-access';
import { translatePortalJobStatus } from '@/lib/portal-status-i18n';
import { isClientRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type ClientJob = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
};

export default function ClientPortalJobsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(clientPortalJobsPath())}`);
        return;
      }

      try {
        await fetch('/api/portal/client/repair', { method: 'POST' });
      } catch {
        // Continue with current access rows.
      }

      const { data: profileRow } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!isClientRole(normalizeRole(profileRow?.role))) {
        router.replace(CLIENT_PORTAL_HOME);
        return;
      }

      const { data: access } = await supabase.from('job_client_access').select('job_id').eq('client_user_id', user.id);
      const jobIds = ((access || []) as Array<{ job_id: string }>).map((row) => String(row.job_id)).filter(Boolean);

      if (jobIds.length === 1) {
        router.replace(clientPortalJobsPath(jobIds[0]));
        return;
      }

      if (jobIds.length === 0) {
        setJobs([]);
        setMessage(t('portal.client.noSharedMessage'));
        setLoading(false);
        return;
      }

      const { data: jobRows } = await supabase
        .from('jobs')
        .select('id, title, status, due_date')
        .in('id', jobIds)
        .order('created_at', { ascending: false });

      setJobs((jobRows || []) as ClientJob[]);
      setLoading(false);
    }

    void load();
  }, [router, t]);

  if (loading) {
    return (
      <AuthenticatedSection role="client">
        <div className="card" role="status" aria-live="polite">
          {t('portal.client.loadingSharedJobs')}
        </div>
      </AuthenticatedSection>
    );
  }

  return (
    <AuthenticatedSection role="client">
      <header style={{ marginBottom: 20 }}>
        <p className="eyebrow">{t('portal.client.portal')}</p>
        <h2>{t('portal.client.sharedJobsTitle')}</h2>
        <p className="muted">{t('portal.client.sharedJobsDescription')}</p>
      </header>

      <PortalClientNav
        active="appointments"
        overviewHref={CLIENT_PORTAL_HOME}
        appointmentsHref={clientPortalJobsPath()}
        accountHref={CLIENT_SETTINGS_PATH}
      />

      {message ? (
        <div className="card" role="status">
          <h3>{t('portal.client.noSharedTitle')}</h3>
          <p>{message}</p>
        </div>
      ) : (
        jobs.map((job) => (
          <article key={job.id} className="card" style={{ marginTop: 16 }}>
            <div className="list-row">
              <div>
                <strong>{job.title}</strong>
                <p className="muted">
                  {translatePortalJobStatus(t, job.status)}
                  {job.due_date ? ` · ${job.due_date}` : ''}
                </p>
              </div>
              <Link className="btn btn-primary" href={clientPortalJobsPath(job.id)}>
                {t('portal.client.openJob')}
              </Link>
            </div>
          </article>
        ))
      )}
    </AuthenticatedSection>
  );
}
