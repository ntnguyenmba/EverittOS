import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { contractorCanAccessJob } from '../lib/contractor-job-access';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

test('job creator posts full one-step payload including schedule contractor pay and email', () => {
  const source = read('components/job-creator.tsx');
  assert.match(source, /customer_email:/);
  assert.match(source, /assigned_to:/);
  assert.match(source, /expected_contractor_cost:/);
  assert.match(source, /revenue_amount:/);
  assert.match(source, /visits:/);
  assert.match(source, /visit_date:/);
  assert.match(source, /customer_id:/);
  assert.match(source, /property_id:/);
  assert.doesNotMatch(source, /\/api\/jobs\/\$\{jobId\}\/labor/);
});

test('job create API writes visits and assignments and auto-grants client access', () => {
  const source = read('app/api/jobs/route.ts');
  assert.match(source, /job_assignments/);
  assert.match(source, /job_visits/);
  assert.match(source, /grantJobClientAccess/);
  assert.match(source, /customer_email/);
  assert.match(source, /Missing or invalid email must never block job creation/);
  assert.match(source, /clientAccess/);
});

test('saved schedule appears without re-entry setup when visits already exist', () => {
  const source = read('components/job-visits-schedule.tsx');
  assert.match(source, /Saved visits for this job/);
  assert.match(source, /hasSavedSchedule/);
  assert.match(source, /Edit/);
  assert.match(source, /Add visit/);
  assert.match(source, /Remove visit/);
  assert.match(source, /Change timezone/);
  assert.doesNotMatch(source, /Set each visit date and time\. Connected calendars update automatically after saving\./);
});

test('selected contractor appears assigned after save without re-asking', () => {
  const assignments = read('components/job-assignments.tsx');
  assert.match(assignments, /Assigned contractors/);
  assert.match(assignments, /Assign existing contractor/);
  assert.match(assignments, /Add manual contractor/);
  assert.match(assignments, /Included in job and contractor metrics/);
  assert.match(assignments, /Remove/);
  assert.doesNotMatch(assignments, /No contractor selected yet\. Assign someone below only if this job still needs a worker\./);
  assert.doesNotMatch(assignments, /Select contractor or team member/);

  const createApi = read('app/api/jobs/route.ts');
  assert.match(createApi, /detail UI does not/);
  assert.match(createApi, /job_assignments/);
});

test('assigned contractor access is automatic and no manual teammate sharing is required', () => {
  const assignments = read('components/job-assignments.tsx');
  assert.match(assignments, /Assigned contractors/);
  assert.match(assignments, /Included in job and contractor metrics/);

  const sharing = read('components/record-sharing-panel.tsx');
  assert.match(sharing, /Additional access/);
  assert.doesNotMatch(sharing, /Shared access/);
  assert.doesNotMatch(sharing, /Sharing gives a teammate permission/);
  assert.match(sharing, /not assigned contractors/);
  assert.match(sharing, /receive job access automatically/);

  const clientPanel = read('components/client-access-panel.tsx');
  assert.doesNotMatch(clientPanel, /RecordSharingPanel/);
});

test('contractor pay appears once from expected cost without duplicate setup form', () => {
  const source = read('components/job-labor-section.tsx');
  assert.match(source, /expectedContractorCost > 0 && entries\.length === 0/);
  assert.match(source, /Flat rate:/);
  assert.match(source, /does not need to be entered again/);
  assert.doesNotMatch(source, /jobPrefillNotice/);
  assert.doesNotMatch(source, /initializeFromJob/);
});

test('customer email receives client access automatically with duplicate prevention', () => {
  const grant = read('lib/client-access-grant-server.ts');
  assert.match(grant, /grantJobClientAccess/);
  assert.match(grant, /existingAccess/);
  assert.match(grant, /pendingInvite/);
  assert.match(grant, /reused: true/);
  assert.match(grant, /onConflict: 'job_id,client_user_id'/);

  const jobsApi = read('app/api/jobs/route.ts');
  assert.match(jobsApi, /grantJobClientAccess/);
  assert.match(jobsApi, /customerEmail && admin/);
});

test('no email does not fail job creation and detail shows no-email state', () => {
  const jobsApi = read('app/api/jobs/route.ts');
  assert.match(jobsApi, /must never block job creation/);

  const panel = read('components/client-access-panel.tsx');
  assert.match(panel, /Status: Email needed/);
  assert.match(panel, /does not block the job/);
  assert.match(panel, /Status: Active/);
  assert.match(panel, /Copy portal link/);
  assert.match(panel, /Turn off access/);
});

test('managers can add additional access with role and permission fields', () => {
  const sharing = read('components/record-sharing-panel.tsx');
  assert.match(sharing, /Additional access/);
  assert.match(sharing, /Existing person/);
  assert.match(sharing, /Or email/);
  assert.match(sharing, /Manager/);
  assert.match(sharing, /Office/);
  assert.match(sharing, /Customer contact/);
  assert.match(sharing, /Property owner/);
  assert.match(sharing, /View only/);
  assert.match(sharing, /'Edit'/);
  assert.match(sharing, /'Share'/);

  const api = read('app/api/record-shares/route.ts');
  assert.match(api, /email/);
  assert.match(api, /accessRole/);
  assert.match(api, /contractor/);
});

test('job details layout uses simplified sections and advanced drawer', () => {
  const page = read('app/jobs/[id]/page.tsx');
  assert.match(page, /copy\.overview/);
  assert.match(page, /JobVisitsSchedule/);
  assert.match(page, /JobAssignments/);
  assert.match(page, /photosTitle/);
  assert.match(page, /JobChecklist/);
  assert.match(page, /copy\.money/);
  assert.match(page, /copy\.moreAdvanced/);
  assert.match(page, /RecordSharingPanel/);
  assert.match(page, /JobWorkflow/);
  assert.match(page, /customer_email/);
  assert.doesNotMatch(page, /Shared access/);
});

test('contractor and customer restrictions still work', () => {
  assert.equal(
    contractorCanAccessJob({
      job: { id: 'job-1', status: 'new', assigned_to: 'w1' },
      workerIds: ['w1'],
      userId: 'u1'
    }),
    true
  );
  assert.equal(
    contractorCanAccessJob({
      job: { id: 'job-2', status: 'new', assigned_to: null },
      workerIds: ['w2'],
      userId: 'u2',
      shares: [{ record_id: 'job-2', shared_with_user_id: 'u2', access_level: 'view' }]
    }),
    false
  );

  const page = read('app/jobs/[id]/page.tsx');
  assert.match(page, /isContractorRole/);
  assert.match(page, /contractorJobDetailPath/);
  assert.match(page, /canManage/);
});
