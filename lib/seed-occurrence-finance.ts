import type { SupabaseClient } from '@supabase/supabase-js';
import { buildLaborRow } from '@/lib/finance-server';
import { parseMoneyDollars } from '@/lib/money-decimal';

export type OccurrenceFinanceDefaults = {
  expectedRevenue?: number | null;
  expectedContractorCost?: number | null;
  expectedAdditionalExpense?: number | null;
  expectedExpenseDescription?: string | null;
  contractorPayBasis?: 'hourly' | 'flat' | 'visit' | null;
  contractorHours?: number | null;
  contractorHourlyRate?: number | null;
  contractorName?: string | null;
  preferredContractorId?: string | null;
};

/** Seed expected labor (unpaid) for a generated occurrence. Idempotent per job when no labor exists. */
export async function seedOccurrenceLabor(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    jobId: string;
    defaults: OccurrenceFinanceDefaults;
  }
): Promise<void> {
  const cost = parseMoneyDollars(input.defaults.expectedContractorCost);
  if (cost <= 0 && !input.defaults.contractorHours && !input.defaults.contractorHourlyRate) {
    return;
  }

  const { count } = await supabase
    .from('job_labor')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', input.jobId)
    .eq('organization_id', input.organizationId);

  if ((count || 0) > 0) return;

  const basis = input.defaults.contractorPayBasis || 'flat';
  const labor =
    basis === 'hourly'
      ? buildLaborRow({
          hours: input.defaults.contractorHours ?? 0,
          hourlyCost: input.defaults.contractorHourlyRate ?? 0,
          paymentBasis: 'hourly'
        })
      : buildLaborRow({
          hours: 1,
          hourlyCost: cost || input.defaults.contractorHourlyRate || 0,
          paymentBasis: 'flat'
        });

  if (labor.total_cost <= 0) return;

  await supabase.from('job_labor').insert({
    organization_id: input.organizationId,
    job_id: input.jobId,
    worker_id: input.defaults.preferredContractorId || null,
    worker_name: input.defaults.contractorName || null,
    hours: labor.hours,
    hourly_cost: labor.hourly_cost,
    total_cost: labor.total_cost,
    payment_basis: labor.payment_basis,
    payment_status: 'unpaid',
    notes: 'Expected contractor pay from recurring series defaults'
  });
}

export function occurrenceFinanceColumns(defaults: OccurrenceFinanceDefaults): {
  revenue_amount: number | null;
  expected_contractor_cost: number | null;
  expected_additional_expense: number | null;
  expected_expense_description: string | null;
} {
  const revenue = defaults.expectedRevenue == null ? null : parseMoneyDollars(defaults.expectedRevenue);
  const contractor =
    defaults.expectedContractorCost == null ? null : parseMoneyDollars(defaults.expectedContractorCost);
  const additional =
    defaults.expectedAdditionalExpense == null ? null : parseMoneyDollars(defaults.expectedAdditionalExpense);
  return {
    revenue_amount: revenue,
    expected_contractor_cost: contractor,
    expected_additional_expense: additional,
    expected_expense_description: defaults.expectedExpenseDescription?.trim() || null
  };
}
