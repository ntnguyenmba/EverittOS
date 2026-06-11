'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, photoUploadAllowed, hasTeamManagement, type EverittosPlan } from '@/lib/everittos-plans';
import { logClientActivity } from '@/lib/activity';
import { trackProductEvent } from '@/lib/product-analytics';
import { supabase } from '@/lib/supabase';

const STEPS = [
  'Set up your workspace',
  'Add your first customer',
  'Create your first job',
  'Upload your first photo',
  'Generate your first report',
  'Invite a team member'
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [orgId, setOrgId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [jobId, setJobId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));

      let org = await fetchOrganizationContext(user.id);
      if (!org) {
        await fetch('/api/auth/setup', { method: 'POST' });
        org = await fetchOrganizationContext(user.id);
      }
      if (org) {
        setOrgId(org.organizationId);
        const { data: settings } = await supabase
          .from('organization_settings')
          .select('*')
          .eq('organization_id', org.organizationId)
          .maybeSingle();
        if (settings?.onboarding_completed) {
          router.push('/dashboard');
          return;
        }
        setStep(settings?.onboarding_step || 0);
        setIndustry(settings?.industry || '');
        setTeamSize(settings?.team_size || '');
        setWebsite(settings?.website || '');
        setPhone(settings?.company_phone || '');
        const { data: orgRow } = await supabase.from('organizations').select('name').eq('id', org.organizationId).single();
        setCompanyName(orgRow?.name || '');
      }

      setLoading(false);
    }
    load();
  }, [router]);

  async function saveStep(nextStep: number, completed = false) {
    if (!orgId) return;
    await supabase
      .from('organization_settings')
      .upsert({
        organization_id: orgId,
        onboarding_step: nextStep,
        onboarding_completed: completed,
        industry: industry || null,
        team_size: teamSize || null,
        website: website || null,
        company_phone: phone || null
      });
    await trackProductEvent('onboarding_step', orgId, { step: nextStep });
  }

  async function stepCompany() {
    setBusy(true);
    setMessage('');
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user || !orgId) return;

    const trimmedName = companyName.trim();
    if (trimmedName) {
      await supabase.from('organizations').update({ name: trimmedName }).eq('id', orgId);
      await supabase.from('profiles').update({ business_name: trimmedName }).eq('id', user.id);
    }
    await saveStep(1);
    await trackProductEvent('company_created', orgId);
    setStep(1);
    setBusy(false);
  }

  async function stepCustomer() {
    setBusy(true);
    if (!customerName.trim()) {
      setMessage('Customer name is required.');
      setBusy(false);
      return;
    }
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('customers')
      .insert({ user_id: user.id, organization_id: orgId, name: customerName.trim() })
      .select('id')
      .single();

    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (orgId) await logClientActivity(orgId, 'customer', data.id, 'customer_created', `Customer ${customerName} added`);
    await trackProductEvent('customer_created', orgId);
    await saveStep(2);
    setStep(2);
  }

  async function stepJob() {
    setBusy(true);
    if (!jobTitle.trim()) {
      setMessage('Job title is required.');
      setBusy(false);
      return;
    }
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        organization_id: orgId,
        title: jobTitle.trim(),
        customer_name: customerName.trim() || null,
        status: 'new'
      })
      .select('id')
      .single();

    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setJobId(data.id);
    if (orgId) await logClientActivity(orgId, 'job', data.id, 'job_created', `Job ${jobTitle} created`);
    await trackProductEvent('job_created', orgId);
    await saveStep(3);
    setStep(3);
  }

  async function stepPhoto() {
    if (!photoUploadAllowed(plan)) {
      await saveStep(4);
      setStep(4);
      setMessage('Photo uploads start on Pro. Continue to reports.');
      return;
    }
    if (!jobId) {
      setMessage('Create a job first.');
      return;
    }
    setMessage('Open the job and upload a photo from your device, then return here.');
    await saveStep(4);
    setStep(4);
  }

  async function stepReport() {
    if (!jobId) {
      setMessage('Create a job first.');
      return;
    }
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('job_reports').insert({
      user_id: user.id,
      organization_id: orgId,
      job_id: jobId,
      title: `${jobTitle} report`
    });
    if (orgId) await logClientActivity(orgId, 'job', jobId, 'report_generated', 'First report created');
    await trackProductEvent('report_generated', orgId);
    await saveStep(5);
    setStep(5);
  }

  async function stepInvite() {
    if (!hasTeamManagement(plan)) {
      await finish();
      return;
    }
    if (!inviteEmail.trim()) {
      await finish();
      return;
    }
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), role: 'employee' })
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || 'Invite failed');
    else await trackProductEvent('team_invited', orgId);
    await finish();
  }

  async function finish() {
    await saveStep(STEPS.length, true);
    router.push('/dashboard');
  }

  const progress = Math.round((step / STEPS.length) * 100);

  if (loading) {
    return (
      <main className="section">
        <div className="container card">Loading your setup...</div>
      </main>
    );
  }

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} />
      <main className="main">
        <div className="page-head">
          <div>
            <h2>Workspace setup</h2>
            <p className="muted">
              Step {step + 1} of {STEPS.length}: {STEPS[step]}. Optional. Finish anytime from Settings. Your dashboard is
              always available.
            </p>
          </div>
          <Link href="/dashboard" className="btn">
            Go to dashboard
          </Link>
        </div>
        <div className="onboarding-progress">
          <div className="onboarding-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="card form" style={{ marginTop: 18 }}>
          {step === 0 && (
            <>
              <h3>Workspace details</h3>
              <p className="muted">
                Your workspace is ready. You can start creating jobs, customers, and schedules right away. Add business
                details later if needed.
              </p>
              <input className="input" placeholder="Business or display name (optional)" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              <input className="input" placeholder="Industry (optional)" value={industry} onChange={(e) => setIndustry(e.target.value)} />
              <input className="input" placeholder="Team size (optional)" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} />
              <input className="input" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input className="input" placeholder="Website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} />
              <div className="settings-actions">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={stepCompany}>
                  Save and continue
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await saveStep(1);
                    setStep(1);
                    setBusy(false);
                  }}
                >
                  Skip and start using EverittOS
                </button>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h3>Add your first customer</h3>
              <input className="input" placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <button type="button" className="btn btn-primary" disabled={busy} onClick={stepCustomer}>
                Continue
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <h3>Create your first job</h3>
              <input className="input" placeholder="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              <button type="button" className="btn btn-primary" disabled={busy} onClick={stepJob}>
                Continue
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <h3>Upload your first photo</h3>
              <p className="muted">Add before, progress, and after photos from your phone or computer.</p>
              {jobId && (
                <Link className="btn" href={`/jobs/${jobId}`}>
                  Open job to upload
                </Link>
              )}
              <button type="button" className="btn btn-primary" onClick={stepPhoto}>
                Continue
              </button>
            </>
          )}
          {step === 4 && (
            <>
              <h3>Generate your first report</h3>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={stepReport}>
                Create report
              </button>
            </>
          )}
          {step === 5 && (
            <>
              <h3>Invite a team member (optional)</h3>
              {hasTeamManagement(plan) ? (
                <>
                  <input className="input" type="email" placeholder="Email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={stepInvite}>
                    Send invite and finish
                  </button>
                  <button type="button" className="btn" onClick={finish}>
                    Skip and start using EverittOS
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" onClick={finish}>
                  Go to dashboard
                </button>
              )}
            </>
          )}
          {message && <p>{message}</p>}
        </div>
      </main>
    </div>
  );
}
