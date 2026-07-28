'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { fetchUsageCounts, limitMessage } from '@/lib/everittos-usage';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { validatePlanAction } from '@/lib/plan-validate';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
import { compressImageFile } from '@/lib/image-compress';
import { insertJobPhotoRow } from '@/lib/job-photos-client';
import { buildSafePhotoStoragePath, validateImageUpload } from '@/lib/upload-security';
import { wallClockDateTime } from '@/lib/schedule-times';

type JobCreatorProps = {
  onJobCreated?: (jobId: string) => void;
};

type TeamMemberOption = {
  userId: string;
  label: string;
  role: string;
};

type VisitDraft = {
  id: string;
  visit_date: string;
  start_time: string;
  end_time: string;
  notes: string;
};

type MemberRow = {
  user_id: string;
  role: string;
  active: boolean;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type ContractorPayMode = 'hourly' | 'flat';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function memberLabel(member: MemberRow, profile?: ProfileRow) {
  const name = profile?.full_name?.trim() || '';
  const email = profile?.email?.trim() || '';
  if (name && !isUuid(name) && name.toLowerCase() !== email.toLowerCase()) return name;
  if (email) return email;
  return 'Team member';
}

function roleLabel(value: string) {
  const normalized = normalizeRole(value);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).replaceAll('_', ' ');
}

function newVisit(): VisitDraft {
  return {
    id: crypto.randomUUID(),
    visit_date: '',
    start_time: '',
    end_time: '',
    notes: ''
  };
}


function validVisits(visits: VisitDraft[]) {
  return visits.filter((visit) => visit.visit_date || visit.start_time || visit.end_time || visit.notes.trim());
}

function moneyValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function JobCreator({ onJobCreated }: JobCreatorProps) {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [clientIncome, setClientIncome] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [contractorPayMode, setContractorPayMode] = useState<ContractorPayMode>('hourly');
  const [contractorHours, setContractorHours] = useState('');
  const [contractorHourlyRate, setContractorHourlyRate] = useState('');
  const [contractorFlatRate, setContractorFlatRate] = useState('');
  const [contractorNotes, setContractorNotes] = useState('');
  const [initialPhotos, setInitialPhotos] = useState<File[]>([]);
  const [visits, setVisits] = useState<VisitDraft[]>([newVisit()]);
  const [assignedTo, setAssignedTo] = useState(searchParams.get('assigned_to') || '');
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [loading, setLoading] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const appFeedback = useAppFeedback();
  const { t } = useTranslation();

  useEffect(() => {
    async function loadTeamMembers() {
      setLoadingTeam(true);
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setLoadingTeam(false);
        return;
      }

      const workspace = await ensureWorkspaceForSave(user.id);
      if (!workspace.ok) {
        setLoadingTeam(false);
        return;
      }

      const { data: memberRows } = await supabase
        .from('organization_members')
        .select('user_id, role, active')
        .eq('organization_id', workspace.workspace.organizationId)
        .eq('active', true)
        .in('role', ['owner', 'admin', 'manager', 'employee', 'contractor'])
        .order('role');

      const members = (memberRows || []) as MemberRow[];
      const memberIds = members.map((member) => member.user_id);
      const { data: profileRows } = memberIds.length
        ? await supabase.from('profiles').select('id, email, full_name').in('id', memberIds)
        : { data: [] as ProfileRow[] };

      const profiles = new Map<string, ProfileRow>();
      for (const profile of (profileRows || []) as ProfileRow[]) {
        profiles.set(profile.id, profile);
      }

      setTeamMembers(
        members.map((member) => ({
          userId: member.user_id,
          role: normalizeRole(member.role),
          label: memberLabel(member, profiles.get(member.user_id))
        }))
      );
      setLoadingTeam(false);
    }

    void loadTeamMembers();
  }, []);

  function updateVisit(id: string, patch: Partial<VisitDraft>) {
    setVisits((rows) => rows.map((visit) => (visit.id === id ? { ...visit, ...patch } : visit)));
  }

  function removeVisit(id: string) {
    setVisits((rows) => (rows.length === 1 ? rows : rows.filter((visit) => visit.id !== id)));
  }

  async function uploadInitialPhotos(jobId: string, organizationId: string, userId: string, uploaderName: string) {
    for (const rawFile of initialPhotos) {
      const validation = validateImageUpload(rawFile);
      if (!validation.ok) continue;
      const file = await compressImageFile(rawFile);
      const revalidation = validateImageUpload(file);
      if (!revalidation.ok) continue;
      const path = buildSafePhotoStoragePath(userId, jobId, revalidation.extension);
      const fileName = file.name || `${revalidation.sanitizedBaseName}.${revalidation.extension}`;
      const { error: uploadError } = await supabase.storage.from('job-photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg'
      });
      if (uploadError) continue;
      const { error: rowError } = await insertJobPhotoRow(supabase, {
        userId,
        jobId,
        organizationId,
        storagePath: path,
        photoType: 'before',
        fileName,
        uploaderDisplayName: uploaderName,
        fileSizeBytes: file.size,
        mimeType: file.type || 'image/jpeg'
      });
      if (rowError) await supabase.storage.from('job-photos').remove([path]);
    }
  }

  async function createJob(event?: FormEvent) {
    event?.preventDefault();
    if (loading) return;

    if (!title.trim()) {
      appFeedback.error('Add a job title first.');
      return;
    }

    const scheduledVisits = validVisits(visits);
    for (const visit of scheduledVisits) {
      if (!visit.visit_date || !visit.start_time || !visit.end_time) {
        appFeedback.error('Each visit needs a date, start time, and end time.');
        return;
      }
      if (visit.end_time <= visit.start_time) {
        appFeedback.error('Visit end time must be after start time.');
        return;
      }
    }

    const hasContractorPay = contractorName.trim() || contractorHours || contractorHourlyRate || contractorFlatRate;
    if (hasContractorPay && !contractorName.trim()) {
      appFeedback.error('Add the contractor or cleaner name.');
      return;
    }
    if (hasContractorPay && contractorPayMode === 'hourly' && (moneyValue(contractorHours) <= 0 || moneyValue(contractorHourlyRate) < 0)) {
      appFeedback.error('Enter valid contractor hours and hourly rate.');
      return;
    }
    if (hasContractorPay && contractorPayMode === 'flat' && moneyValue(contractorFlatRate) <= 0) {
      appFeedback.error('Enter a valid flat-rate contractor amount.');
      return;
    }

    const firstVisit = scheduledVisits[0];
    const lastVisit = scheduledVisits[scheduledVisits.length - 1];
    const scheduledStart = firstVisit ? wallClockDateTime(firstVisit.visit_date, firstVisit.start_time) : null;
    const scheduledEnd = lastVisit ? wallClockDateTime(lastVisit.visit_date, lastVisit.end_time) : null;

    setLoading(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      appFeedback.error('Sign in to create jobs.');
      return;
    }

    const workspace = await ensureWorkspaceForSave(user.id);
    if (!workspace.ok) {
      setLoading(false);
      appFeedback.error(workspace.error);
      return;
    }
    const org = workspace.workspace;

    const { data: profile } = await supabase.from('profiles').select('role, plan, full_name, email').eq('id', user.id).maybeSingle();
    const role = normalizeRole(org.role || profile?.role);
    if (!isManagerRole(role)) {
      setPermissionBlocked(true);
      setLoading(false);
      appFeedback.error(t('pages.jobs.createPermissionBlocked'));
      return;
    }

    const { plan: orgPlan } = await resolveOrganizationPlan(supabase, user.id);
    const usage = await fetchUsageCounts(user.id, org.organizationId);
    const check = validatePlanAction({ plan: orgPlan, resource: 'jobs', currentCount: usage.jobs });
    if (!check.allowed) {
      setLoading(false);
      appFeedback.error(check.message || limitMessage('jobs', orgPlan));
      return;
    }

    const serverCheck = await fetch('/api/plan/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'jobs' })
    });
    const serverJson = await serverCheck.json();
    if (!serverJson.allowed) {
      setLoading(false);
      appFeedback.error(serverJson.message || 'Plan limit reached.');
      return;
    }

    const createRes = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        customer_name: customerName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        revenue_amount: clientIncome ? moneyValue(clientIncome) : null,
        assigned_to: assignedTo || null,
        start_date: firstVisit?.visit_date || null,
        due_date: lastVisit?.visit_date || null,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        visits: scheduledVisits.map((visit) => ({
          visit_date: visit.visit_date,
          start_time: visit.start_time,
          end_time: visit.end_time,
          notes: visit.notes.trim() || null
        })),
        status: 'new'
      })
    });
    const createJson = (await createRes.json()) as { job?: { id: string }; error?: string };

    if (!createRes.ok || !createJson.job?.id) {
      setLoading(false);
      appFeedback.error(createJson.error || 'Unable to save job.');
      return;
    }

    const jobId = createJson.job.id;
    const followUpTasks: Promise<unknown>[] = [];

    if (clientIncome) {
      followUpTasks.push(
        fetch(`/api/jobs/${jobId}/profitability`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revenue_amount: moneyValue(clientIncome), revenue_notes: 'Added during job creation' })
        })
      );
    }

    if (hasContractorPay) {
      const hours = contractorPayMode === 'hourly' ? moneyValue(contractorHours) : 1;
      const rate = contractorPayMode === 'hourly' ? moneyValue(contractorHourlyRate) : moneyValue(contractorFlatRate);
      followUpTasks.push(
        fetch(`/api/jobs/${jobId}/labor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worker_id: null,
            worker_name: contractorName.trim(),
            hours,
            hourly_cost: rate,
            notes: contractorNotes.trim() || (contractorPayMode === 'flat' ? 'Flat-rate contractor pay' : null)
          })
        })
      );
    }

    if (initialPhotos.length > 0) {
      followUpTasks.push(
        uploadInitialPhotos(
          jobId,
          org.organizationId,
          user.id,
          profile?.full_name || profile?.email || user.email || 'Team member'
        )
      );
    }

    await Promise.allSettled(followUpTasks);

    void fetch('/api/integrations/google-calendar/sync-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });

    setLoading(false);
    appFeedback.created();
    onJobCreated?.(jobId);
  }

  if (permissionBlocked) {
    return (
      <div className="card">
        <h3>{t('pages.jobs.createTitle')}</h3>
        <p>{t('pages.jobs.createPermissionBlocked')}</p>
      </div>
    );
  }

  const previewContractorPay = contractorPayMode === 'hourly'
    ? moneyValue(contractorHours) * moneyValue(contractorHourlyRate)
    : moneyValue(contractorFlatRate);
  const previewProfit = moneyValue(clientIncome) - previewContractorPay;

  return (
    <div className="card">
      <h3>{t('pages.jobs.createTitle')}</h3>
      <p className="muted">Enter the initial job information below. Everything is saved together with one button.</p>
      <form className="form unified-job-form" onSubmit={createJob}>
        <section className="job-create-section">
          <h4>Job and customer</h4>
          <label>Job title *</label>
          <input className="input" placeholder="Example: Move-out cleaning" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div className="grid-2">
            <div className="form-group"><label>Customer name</label><input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
            <div className="form-group"><label>Phone</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <label>Address</label>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </section>

        <section className="job-create-section">
          <h4>Days and hours</h4>
          <p className="muted">Add one or more scheduled visits.</p>
          {visits.map((visit, index) => (
            <div key={visit.id} className="form visit-editor">
              <label>Visit {index + 1}</label>
              <input className="input" type="date" value={visit.visit_date} onChange={(e) => updateVisit(visit.id, { visit_date: e.target.value })} />
              <div className="grid-2">
                <div className="form-group"><label>Start time</label><input className="input" type="time" value={visit.start_time} onChange={(e) => updateVisit(visit.id, { start_time: e.target.value })} /></div>
                <div className="form-group"><label>End time</label><input className="input" type="time" value={visit.end_time} onChange={(e) => updateVisit(visit.id, { end_time: e.target.value })} /></div>
              </div>
              <label>Visit notes</label>
              <input className="input" value={visit.notes} onChange={(e) => updateVisit(visit.id, { notes: e.target.value })} />
              {visits.length > 1 ? <button className="btn" type="button" onClick={() => removeVisit(visit.id)}>Remove visit</button> : null}
            </div>
          ))}
          <button className="btn" type="button" onClick={() => setVisits((rows) => [...rows, newVisit()])}>Add another visit</button>
        </section>

        <section className="job-create-section">
          <h4>Assignment and notes</h4>
          <label htmlFor="assigned-to">Assign to</label>
          <select id="assigned-to" className="input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} disabled={loadingTeam}>
            <option value="">Unassigned</option>
            {teamMembers.map((member) => <option key={member.userId} value={member.userId}>{member.label} · {roleLabel(member.role)}</option>)}
          </select>
          <label>Job notes</label>
          <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </section>

        <section className="job-create-section">
          <h4>Client income</h4>
          <p className="muted">What the client will pay your business. This is separate from contractor pay.</p>
          <label>Client income amount</label>
          <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={clientIncome} onChange={(e) => setClientIncome(e.target.value)} />
        </section>

        <section className="job-create-section">
          <h4>Initial contractor pay</h4>
          <p className="muted">Optional. Choose hourly or flat-rate pay so the calculation is clear.</p>
          <label>Contractor or cleaner name</label>
          <input className="input" value={contractorName} onChange={(e) => setContractorName(e.target.value)} />
          <label>Pay type</label>
          <div className="segmented-control" role="group" aria-label="Contractor pay type">
            <button type="button" className={`btn${contractorPayMode === 'hourly' ? ' btn-primary' : ''}`} onClick={() => setContractorPayMode('hourly')}>Hourly pay</button>
            <button type="button" className={`btn${contractorPayMode === 'flat' ? ' btn-primary' : ''}`} onClick={() => setContractorPayMode('flat')}>Flat-rate pay</button>
          </div>
          {contractorPayMode === 'hourly' ? (
            <div className="grid-2">
              <div className="form-group"><label>Hours</label><input className="input" type="number" min="0" step="0.25" value={contractorHours} onChange={(e) => setContractorHours(e.target.value)} /></div>
              <div className="form-group"><label>Hourly rate</label><input className="input" type="number" min="0" step="0.01" value={contractorHourlyRate} onChange={(e) => setContractorHourlyRate(e.target.value)} /></div>
            </div>
          ) : (
            <div className="form-group"><label>Flat-rate amount</label><input className="input" type="number" min="0" step="0.01" value={contractorFlatRate} onChange={(e) => setContractorFlatRate(e.target.value)} /></div>
          )}
          <label>Contractor pay notes</label>
          <input className="input" value={contractorNotes} onChange={(e) => setContractorNotes(e.target.value)} />
          <div className="finance-metric-grid financials-summary-grid">
            <div className="finance-metric"><span className="finance-metric-label">Initial contractor pay</span><strong>${previewContractorPay.toFixed(2)}</strong></div>
            <div className="finance-metric featured"><span className="finance-metric-label">Estimated profit</span><strong>${previewProfit.toFixed(2)}</strong></div>
          </div>
        </section>

        <section className="job-create-section">
          <h4>Initial photos</h4>
          <p className="muted">Optional before photos. You can edit or add more photos after the job is created.</p>
          <input className="input" type="file" accept="image/*" multiple onChange={(e) => setInitialPhotos(Array.from(e.target.files || []))} />
          {initialPhotos.length > 0 ? <p className="muted">{initialPhotos.length} photo{initialPhotos.length === 1 ? '' : 's'} selected</p> : null}
        </section>

        <Button className="btn-primary unified-job-save" type="submit" disabled={loading}>
          {loading ? FEEDBACK.loading : 'Save job'}
        </Button>
      </form>
    </div>
  );
}
