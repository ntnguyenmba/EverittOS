import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { contractorCanAccessJob } from '@/lib/contractor-job-access';
import { buildContractorJobCards } from '@/lib/contractor-dashboard';
import { getMessages } from '@/lib/i18n/get-messages';
import {
  CLIENT_FORBIDDEN_FIELDS,
  CONTRACTOR_FORBIDDEN_FIELDS,
  clientJobCharges,
  contractorEarningsTotals,
  contractorPayFromLabor,
  objectHasForbiddenField
} from '@/lib/portal-role-financials';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

describe('portal role financials', () => {
  it('shows contractor pay only from that worker’s labor rows', () => {
    const labor = [
      { job_id: 'job-1', worker_id: 'w1', total_cost: 80, payment_status: 'unpaid' },
      { job_id: 'job-1', worker_id: 'w2', total_cost: 999, payment_status: 'paid' },
      { job_id: 'job-2', worker_id: 'w1', total_cost: 40, payment_status: 'paid' }
    ];

    assert.deepEqual(contractorPayFromLabor(labor, ['w1'], 'job-1'), {
      payAmount: 80,
      paymentStatus: 'unpaid'
    });
    assert.equal(contractorPayFromLabor(labor, ['w1'], 'job-missing').payAmount, null);
    assert.equal(contractorPayFromLabor(labor, ['w9'], 'job-1').payAmount, null);

    const totals = contractorEarningsTotals(labor, ['w1']);
    assert.equal(totals.total, 120);
    assert.equal(totals.paid, 40);
    assert.equal(totals.owed, 80);
    assert.equal(contractorEarningsTotals(labor, ['w2']).total, 999);
  });

  it('does not treat planned company contractor cost as recorded pay', () => {
    const cards = buildContractorJobCards(
      [
        {
          id: 'job-1',
          title: 'Window clean',
          assigned_to: 'w1',
          status: 'scheduled',
          expected_contractor_cost: 150,
          customer_name: 'Ada'
        }
      ],
      [],
      { userId: 'u1', workerIds: ['w1'] }
    );
    assert.equal(cards[0]?.payAmount, null);
    assert.equal(cards[0]?.payIsPlanned, false);
  });

  it('computes client job total, paid, and balance for paid, partial, and unpaid jobs', () => {
    assert.deepEqual(
      clientJobCharges({ invoices: [{ amount: 200, amount_paid: 200, status: 'paid' }] }),
      { jobTotal: 200, paid: 200, balanceDue: 0 }
    );
    assert.deepEqual(
      clientJobCharges({ invoices: [{ amount: 200, amount_paid: 50, status: 'sent' }] }),
      { jobTotal: 200, paid: 50, balanceDue: 150 }
    );
    assert.deepEqual(
      clientJobCharges({ invoices: [{ amount: 200, amount_paid: 0, status: 'sent' }] }),
      { jobTotal: 200, paid: 0, balanceDue: 200 }
    );
    assert.deepEqual(clientJobCharges({ invoices: [{ amount: 200, amount_paid: 0, status: 'void' }] }), {
      jobTotal: null,
      paid: 0,
      balanceDue: null
    });
    assert.deepEqual(clientJobCharges({ invoices: [], revenueAmount: 175 }), {
      jobTotal: 175,
      paid: 0,
      balanceDue: 175
    });
    assert.deepEqual(clientJobCharges({ invoices: [] }), { jobTotal: null, paid: 0, balanceDue: null });
  });

  it('blocks unassigned contractor jobs and other clients’ jobs at the access layer', () => {
    assert.equal(
      contractorCanAccessJob({
        job: { id: 'job-a', assigned_to: 'other' },
        workerIds: ['w1'],
        userId: 'u1'
      }),
      false
    );
    assert.equal(
      contractorCanAccessJob({
        job: { id: 'job-a', assigned_to: 'w1' },
        workerIds: ['w1'],
        userId: 'u1'
      }),
      true
    );
  });

  it('detects forbidden financial fields in portal payloads', () => {
    assert.equal(
      objectHasForbiddenField({ jobs: [{ payAmount: 20, title: 'Job' }] }, CONTRACTOR_FORBIDDEN_FIELDS),
      null
    );
    assert.equal(
      objectHasForbiddenField({ jobs: [{ revenue_amount: 400 }] }, CONTRACTOR_FORBIDDEN_FIELDS),
      'revenue_amount'
    );
    assert.equal(
      objectHasForbiddenField({ charges: { jobTotal: 100, paid: 40, balanceDue: 60 } }, CLIENT_FORBIDDEN_FIELDS),
      null
    );
    assert.equal(
      objectHasForbiddenField({ job: { expected_contractor_cost: 90 } }, CLIENT_FORBIDDEN_FIELDS),
      'expected_contractor_cost'
    );
  });

  it('translates contractor pay and client charge labels in en, es, and vi', () => {
    const en = getMessages('en').portal;
    const es = getMessages('es').portal;
    const vi = getMessages('vi').portal;
    assert.equal(en.contractor.payNotRecorded, 'Pay not recorded');
    assert.equal(en.contractor.yourPay, 'Your pay');
    assert.equal(en.client.jobTotal, 'Job total');
    assert.equal(en.client.paid, 'Paid');
    assert.equal(en.client.balanceDue, 'Balance due');
    assert.equal(es.contractor.payNotRecorded, 'Pago no registrado');
    assert.equal(es.client.balanceDue, 'Saldo pendiente');
    assert.equal(vi.contractor.payNotRecorded, 'Chưa ghi nhận tiền công');
    assert.equal(vi.client.jobTotal, 'Tổng công việc');
    assert.notEqual(es.client.paid, en.client.paid);
    assert.notEqual(vi.client.balanceDue, en.client.balanceDue);
  });
});

describe('portal APIs and pages keep role-safe financials', () => {
  it('contractor APIs only select safe job columns and own labor', () => {
    const loader = read('lib/portal-contractor-jobs.ts');
    const list = read('app/api/portal/contractor/jobs/route.ts');
    const detail = read('app/api/portal/contractor/jobs/[id]/route.ts');
    assert.match(loader, /CONTRACTOR_SAFE_JOB_COLUMNS/);
    assert.match(loader, /contractorCanAccessJob/);
    assert.match(loader, /\.in\('worker_id', workerIds\)/);
    assert.doesNotMatch(loader, /revenue_amount/);
    assert.doesNotMatch(loader, /expected_contractor_cost/);
    assert.doesNotMatch(loader, /expected_additional_expense/);
    assert.match(list, /loadContractorPortalDashboard/);
    assert.doesNotMatch(list, /searchParams/);
    assert.match(detail, /loadContractorPortalJob/);
    assert.match(loader, /status: 403/);
    assert.doesNotMatch(detail, /searchParams/);
  });

  it('client APIs only return customer-facing charges for shared jobs', () => {
    const loader = read('lib/portal-client-jobs.ts');
    const list = read('app/api/portal/client/jobs/route.ts');
    const detail = read('app/api/portal/client/jobs/[id]/route.ts');
    assert.match(loader, /job_client_access/);
    assert.match(loader, /client_user_id', input\.userId/);
    assert.match(loader, /clientJobCharges/);
    assert.match(loader, /toClientFacingCharges/);
    assert.doesNotMatch(loader, /expected_contractor_cost/);
    assert.doesNotMatch(loader, /job_labor/);
    assert.doesNotMatch(loader, /contractor_pay/);
    assert.match(loader, /This job is not shared with your account/);
    assert.match(list, /loadClientPortalJobs/);
    assert.doesNotMatch(list, /searchParams/);
    assert.match(detail, /loadClientPortalJob/);
    assert.doesNotMatch(detail, /searchParams/);
    assert.match(loader, /revenue_amount/);
    assert.match(loader, /jobTotal: facing.jobTotal/);
    assert.doesNotMatch(loader, /revenue_amount: safeJob/);
  });

  it('contractor portal UI loads pay from the role API and hides customer pricing', () => {
    const page = read('app/portal/contractor/page.tsx');
    const detail = read('app/portal/contractor/jobs/[id]/page.tsx');
    assert.match(page, /\/api\/portal\/contractor\/jobs/);
    assert.match(page, /yourPay/);
    assert.match(page, /payNotRecorded/);
    assert.doesNotMatch(page, /from\('jobs'\)/);
    assert.doesNotMatch(page, /from\('job_labor'\)/);
    assert.doesNotMatch(page, /revenue_amount/);
    assert.doesNotMatch(page, /expected_contractor_cost/);
    assert.match(detail, /\/api\/portal\/contractor\/jobs\//);
    assert.match(detail, /portal\.contractor\.payNotRecorded/);
    assert.doesNotMatch(detail, /from\('jobs'\)/);
    assert.doesNotMatch(detail, /revenue_amount/);
  });

  it('client portal UI loads charges from the role API and hides contractor pay', () => {
    const page = read('app/portal/client/jobs/page.tsx');
    const detail = read('app/portal/client/jobs/[id]/page.tsx');
    assert.match(page, /\/api\/portal\/client\/jobs/);
    assert.match(page, /jobTotal/);
    assert.match(page, /balanceDue/);
    assert.doesNotMatch(page, /revenue_amount/);
    assert.doesNotMatch(page, /expected_contractor_cost/);
    assert.doesNotMatch(page, /job_labor/);
    assert.match(detail, /portal\.client\.jobTotal/);
    assert.match(detail, /portal\.client\.balanceDue/);
    assert.doesNotMatch(detail, /expected_contractor_cost/);
    assert.doesNotMatch(detail, /job_labor/);
  });
});
