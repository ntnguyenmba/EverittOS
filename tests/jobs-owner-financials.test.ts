import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  ownerProfitFromAmounts,
  parseOwnerMoney
} from '@/lib/jobs-owner-financials';
import { formatMoneyUsd } from '@/lib/i18n/locale-format';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

describe('owner-only job pay and profit columns', () => {
  const page = read('components/jobs-list.tsx');
  const jobsApi = read('app/api/jobs/route.ts');
  const ownerApi = read('app/api/jobs/owner-financials/route.ts');
  const query = read('lib/jobs-org-query.ts');

  it('fetches owner financials only for the exact owner role', () => {
    assert.match(page, /const isOwner = role === 'owner'/);
    assert.match(page, /workspaceRole === 'owner'/);
    assert.match(page, /\/api\/jobs\/owner-financials\?ids=/);
    assert.match(page, /visibleJobs\.map\(\(job\) => job\.id\)/);
    assert.match(page, /setOwnerFinancials\(\{\}\)/);
    assert.match(ownerApi, /normalizeRole\(ctx\.workspace\.role\) !== 'owner'/);
    assert.match(ownerApi, /status: 403/);
  });

  it('does not expose contractor pay or owner profit through /api/jobs', () => {
    const listColumnsMatch = query.match(/export const JOB_LIST_COLUMNS =\s*'([^']+)'/);
    const listColumns = listColumnsMatch?.[1] || '';
    assert.match(listColumns, /revenue_amount/);
    assert.doesNotMatch(listColumns, /expected_contractor_cost/);
    assert.doesNotMatch(listColumns, /expected_additional_expense/);
    assert.doesNotMatch(listColumns, /ownerProfit|contractorPay/);

    const getHandler = jobsApi.slice(jobsApi.indexOf('export async function GET'), jobsApi.indexOf('export async function POST'));
    assert.doesNotMatch(getHandler, /expected_contractor_cost/);
    assert.doesNotMatch(getHandler, /expected_additional_expense/);
    assert.doesNotMatch(getHandler, /ownerProfit|contractorPay/);
    assert.match(getHandler, /listWorkspaceJobs/);
  });

  it('localizes owner money column labels in English, Spanish, and Vietnamese', () => {
    assert.match(page, /customerPay: 'Customer Pay'/);
    assert.match(page, /contractorPay: 'Contractor Pay'/);
    assert.match(page, /ownerProfit: 'Owner Profit'/);
    assert.match(page, /customerPay: 'Pago del cliente'/);
    assert.match(page, /contractorPay: 'Pago al contratista'/);
    assert.match(page, /ownerProfit: 'Ganancia del propietario'/);
    assert.match(page, /customerPay: 'Khách trả'/);
    assert.match(page, /contractorPay: 'Trả nhà thầu'/);
    assert.match(page, /ownerProfit: 'Lợi nhuận chủ'/);
  });

  it('renders owner money cells with mobile data-labels and keeps them off non-owner tables', () => {
    assert.match(page, /data-label=\{c\.customerPay\}/);
    assert.match(page, /data-label=\{c\.contractorPay\}/);
    assert.match(page, /data-label=\{c\.ownerProfit\}/);
    assert.match(page, /isOwner \? \(\s*<>/);
    assert.match(page, /formatOwnerJobMoney/);
    assert.match(page, /return '—'/);
    assert.match(page, /canManageFinancials && !isOwner/);
  });

  it('formats missing values as an em dash and keeps negative owner profit', () => {
    assert.equal(parseOwnerMoney(null), null);
    assert.equal(parseOwnerMoney(''), null);
    assert.equal(parseOwnerMoney(250), 250);
    assert.equal(ownerProfitFromAmounts(null, null, null), null);
    assert.equal(ownerProfitFromAmounts(400, 180, 25), 195);
    assert.equal(ownerProfitFromAmounts(100, 180, 25), -105);
    assert.equal(formatMoneyUsd(-105, 'en'), '-$105.00');
    assert.match(page, /formatMoneyUsd\(value, locale\)/);
  });
});
