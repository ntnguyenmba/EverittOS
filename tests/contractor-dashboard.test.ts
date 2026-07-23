import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildContractorJobCards,
  buildContractorPaymentHistory,
  computeContractorDashboardMetrics,
  CONTRACTOR_HOME_PATH,
  contractorDashboardLinkLoops,
  contractorIdentityFromWorkers,
  filterLaborForWorkers
} from '@/lib/contractor-dashboard';
import { buildAssignmentWorkerIdsByJob } from '@/lib/worker-assignment';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { defaultPathForRole } from '@/lib/role-routes';

const TODAY = '2026-07-20';

describe('contractor dashboard', () => {
  it('includes jobs assigned via jobs.assigned_to and job_assignments', () => {
    const identity = { userId: 'user-a', workerIds: ['worker-a'] };
    const byJob = buildAssignmentWorkerIdsByJob([{ job_id: 'job-assign', worker_id: 'worker-a' }]);
    const jobs = [
      {
        id: 'job-direct',
        title: 'Direct',
        assigned_to: 'worker-a',
        status: 'scheduled',
        scheduled_start: `${TODAY}T10:00:00Z`,
        customer_name: 'Ada',
        address: '1 Main'
      },
      {
        id: 'job-assign',
        title: 'Assigned',
        assigned_to: null,
        status: 'scheduled',
        due_date: '2026-07-25',
        customer_name: 'Bea',
        address: '2 Main'
      },
      {
        id: 'job-other',
        title: 'Other',
        assigned_to: 'worker-b',
        status: 'scheduled',
        due_date: '2026-07-22',
        customer_name: 'Other',
        address: '3 Main'
      }
    ];

    const cards = buildContractorJobCards(jobs, [], identity, byJob);
    assert.deepEqual(
      cards.map((card) => card.id).sort(),
      ['job-assign', 'job-direct']
    );

    const metrics = computeContractorDashboardMetrics(jobs, [], identity, TODAY, byJob);
    assert.equal(metrics.assignedJobs, 2);
    assert.equal(metrics.upcomingJobs, 2);
  });

  it('counts completed paid and unpaid contractor labor separately', () => {
    const identity = { userId: 'user-a', workerIds: ['worker-a'] };
    const jobs = [
      {
        id: 'job-paid',
        title: 'Paid job',
        assigned_to: 'worker-a',
        status: 'completed',
        completed_at: '2026-07-10',
        customer_name: 'Ada'
      },
      {
        id: 'job-unpaid',
        title: 'Unpaid job',
        assigned_to: 'worker-a',
        status: 'completed',
        completed_at: '2026-07-12',
        customer_name: 'Bea'
      }
    ];
    const labor = [
      {
        id: 'l1',
        job_id: 'job-paid',
        worker_id: 'worker-a',
        total_cost: 100,
        payment_status: 'paid',
        paid_at: '2026-07-11'
      },
      {
        id: 'l2',
        job_id: 'job-unpaid',
        worker_id: 'worker-a',
        total_cost: 80,
        payment_status: 'unpaid'
      }
    ];

    const metrics = computeContractorDashboardMetrics(jobs, labor, identity, TODAY);
    assert.equal(metrics.completedJobs, 2);
    assert.equal(metrics.totalEarnings, 180);
    assert.equal(metrics.paidEarnings, 100);
    assert.equal(metrics.owedEarnings, 80);

    const history = buildContractorPaymentHistory(labor, new Map(jobs.map((job) => [job.id, job])), ['worker-a']);
    assert.equal(history.length, 2);
    assert.equal(history.find((row) => row.jobId === 'job-paid')?.amountPaid, 100);
    assert.equal(history.find((row) => row.jobId === 'job-unpaid')?.outstandingAmount, 80);
  });

  it('includes duplicate historical worker records for the same authenticated contractor', () => {
    const identity = contractorIdentityFromWorkers(
      'auth-thuy',
      [
        { id: 'worker-old', auth_user_id: null, email: 'thuy@everittventures.com', active: false },
        { id: 'worker-new', auth_user_id: 'auth-thuy', email: 'thuy@everittventures.com', active: true }
      ],
      'thuy@everittventures.com'
    );
    assert.deepEqual(identity.workerIds?.sort(), ['worker-new', 'worker-old'].sort());

    const labor = [
      { id: 'l-old', job_id: 'job-1', worker_id: 'worker-old', total_cost: 50, payment_status: 'paid', paid_at: '2026-01-01' },
      { id: 'l-new', job_id: 'job-2', worker_id: 'worker-new', total_cost: 25, payment_status: 'unpaid' }
    ];
    const jobs = [
      { id: 'job-1', title: 'Old', assigned_to: 'worker-old', status: 'completed', customer_name: 'A' },
      { id: 'job-2', title: 'New', assigned_to: 'worker-new', status: 'completed', customer_name: 'B' }
    ];
    const metrics = computeContractorDashboardMetrics(jobs, labor, identity, TODAY);
    assert.equal(metrics.totalEarnings, 75);
    assert.equal(metrics.paidEarnings, 50);
    assert.equal(metrics.owedEarnings, 25);
  });

  it('does not expose another worker earnings', () => {
    const identity = { userId: 'user-a', workerIds: ['worker-a'] };
    const labor = [
      { id: 'mine', worker_id: 'worker-a', job_id: 'j1', total_cost: 40, payment_status: 'unpaid' },
      { id: 'theirs', worker_id: 'worker-b', job_id: 'j2', total_cost: 999, payment_status: 'paid', paid_at: '2026-07-01' }
    ];
    const scoped = filterLaborForWorkers(labor, identity.workerIds || []);
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0]?.id, 'mine');

    const metrics = computeContractorDashboardMetrics(
      [
        { id: 'j1', assigned_to: 'worker-a', status: 'completed', title: 'Mine' },
        { id: 'j2', assigned_to: 'worker-b', status: 'completed', title: 'Theirs' }
      ],
      labor,
      identity,
      TODAY
    );
    assert.equal(metrics.totalEarnings, 40);
    assert.equal(metrics.paidEarnings, 0);
  });

  it('does not create a contractor dashboard navigation loop', () => {
    assert.equal(dashboardPathForRole('contractor'), CONTRACTOR_HOME_PATH);
    assert.equal(defaultPathForRole('contractor', '/dashboard'), CONTRACTOR_HOME_PATH);
    assert.equal(contractorDashboardLinkLoops('/portal/contractor'), true);
    assert.equal(contractorDashboardLinkLoops('/dashboard'), true);
    assert.equal(contractorDashboardLinkLoops('/settings/account'), false);
  });
});
