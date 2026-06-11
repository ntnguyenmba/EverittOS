'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PhotoGallery } from '@/components/photo-gallery';
import { Sidebar } from '@/components/sidebar';
import { fetchOrganizationContext } from '@/lib/organization';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

type PageProps = {
  params: Promise<{ id: string }>;
};

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  created_at: string | null;
  assigned_to: string | null;
  department_id: string | null;
  workflow_template_id: string | null;
};

type OrgBranding = {
  company_name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  logo_path: string | null;
};

export default function JobReportPage({ params }: PageProps) {
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [branding, setBranding] = useState<OrgBranding>({ company_name: 'EverittOS', phone: null, email: null, website: null, address: null, logo_path: null });
  const [workerName, setWorkerName] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [workflowSummary, setWorkflowSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    params.then((p) => setJobId(p.id));
  }, [params]);

  useEffect(() => {
    if (!jobId) return;

    async function load() {
      setLoading(true);
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('plan, business_name').eq('id', user.id).maybeSingle();
      const userPlan = normalizePlan(profile?.plan);
      setPlan(userPlan);

      const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).single();
      if (error) {
        setLoading(false);
        setMessage(error.message);
        return;
      }
      setJob(data as Job);

      const org = await fetchOrganizationContext(user.id);
      if (org) {
        const [{ data: settings }, { data: orgRow }] = await Promise.all([
          supabase.from('organization_settings').select('*').eq('organization_id', org.organizationId).maybeSingle(),
          supabase.from('organizations').select('name').eq('id', org.organizationId).maybeSingle()
        ]);
        setBranding({
          company_name: orgRow?.name || profile?.business_name || 'EverittOS',
          phone: settings?.company_phone || null,
          email: settings?.company_email || null,
          website: settings?.website || null,
          address: settings?.company_address || null,
          logo_path: settings?.logo_path || null
        });
      } else {
        setBranding({ company_name: profile?.business_name || 'EverittOS', phone: null, email: null, website: null, address: null, logo_path: null });
      }

      if (data.assigned_to) {
        const { data: worker } = await supabase.from('workers').select('name').eq('id', data.assigned_to).maybeSingle();
        setWorkerName(worker?.name || '');
      }

      if (data.department_id && limitsForPlan(userPlan).multiLocation) {
        const { data: dept } = await supabase.from('departments').select('name').eq('id', data.department_id).maybeSingle();
        setDepartmentName(dept?.name || '');
      }

      if (data.workflow_template_id && limitsForPlan(userPlan).workflowCustomization) {
        const wfRes = await fetch(`/api/jobs/${jobId}/workflow`);
        const wfJson = await wfRes.json();
        const total = (wfJson.steps || []).length;
        const done = (wfJson.progress || []).filter((p: { completed: boolean }) => p.completed).length;
        setWorkflowSummary(total ? `${done} of ${total} workflow steps complete` : '');
      }

      setLoading(false);
    }

    load();
  }, [jobId]);

  const showPhotos = limitsForPlan(plan).photoUpload;
  const showBranding = limitsForPlan(plan).customBranding || plan !== 'free';

  function downloadPdf() {
    window.print();
  }

  if (loading) {
    return (
      <div className="dashboard-shell">
        <Sidebar plan={plan} />
        <main className="main">
          <p>Loading report...</p>
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="dashboard-shell">
        <Sidebar plan={plan} />
        <main className="main">
          <p>{message || 'Job not found.'}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-shell report-shell">
      <Sidebar plan={plan} />
      <main className="main">
        <div className="page-head no-print">
          <div>
            <h2>Job proof report</h2>
            <p>Download PDF uses your browser print dialog. Choose Save as PDF for a file export.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" type="button" onClick={downloadPdf}>
              Download PDF
            </button>
            <Link className="btn" href={`/jobs/${job.id}`}>
              Back to job
            </Link>
          </div>
        </div>

        <article className="card report-document">
          <header className="report-header">
            {showBranding ? <p className="report-brand">{branding.company_name}</p> : <p className="report-brand">EverittOS</p>}
            <h1>{job.title}</h1>
            <p className="report-meta">Status: {job.status || 'new'}</p>
            {showBranding ? (
              <p className="report-meta">
                {[branding.phone, branding.email, branding.website, branding.address].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </header>

          <section>
            <h3>Job details</h3>
            <p>Customer: {job.customer_name || 'Not set'}</p>
            <p>Phone: {job.phone || 'Not set'}</p>
            <p>Address: {job.address || 'Not set'}</p>
            <p>Assigned worker: {workerName || 'Not assigned'}</p>
            {departmentName ? <p>Department: {departmentName}</p> : null}
            <p>Notes: {job.notes || 'None'}</p>
            <p>Start: {job.scheduled_start || job.start_date || 'Not set'}</p>
            <p>End: {job.scheduled_end || job.due_date || 'Not set'}</p>
            <p>Completed: {job.completed_at ? new Date(job.completed_at).toLocaleString() : 'Not completed'}</p>
            {workflowSummary ? <p>Workflow: {workflowSummary}</p> : null}
          </section>

          {showPhotos ? (
            <section className="report-photos-section">
              <h3>Before &amp; after photos</h3>
              <PhotoGallery jobId={job.id} showComparison showMetadata />
            </section>
          ) : (
            <section>
              <h3>Photos</h3>
              <p className="muted">Photos are not available on this plan.</p>
            </section>
          )}

          <section>
            <h3>Completion summary</h3>
            <p>{job.notes || 'No completion notes recorded.'}</p>
          </section>

          <section className="report-signature">
            <p>Technician signature</p>
            <div className="report-signature-line" />
            <p>Date: ____________________</p>
          </section>

          <footer className="report-footer">
            <p>Generated {new Date().toLocaleString()}</p>
          </footer>
        </article>
      </main>
    </div>
  );
}
