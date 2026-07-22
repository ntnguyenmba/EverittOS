import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fetchBusinessPerformance } from '@/lib/finance-server';

type Row = Record<string, unknown>;

type TableData = Record<string, Row[]>;

class FakeQuery implements PromiseLike<{ data: Row[] | Row | null; error: null; count: number }> {
  private single = false;

  constructor(
    private readonly rows: Row[],
    private readonly filters: Array<(row: Row) => boolean> = []
  ) {}

  select(): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  not(column: string, operator: string, value: unknown): this {
    if (operator === 'is' && value === null) {
      this.filters.push((row) => row[column] != null);
    }
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push((row) => String(row[column] || '') >= String(value || ''));
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push((row) => Number(row[column] || 0) > Number(value || 0));
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push((row) => String(row[column] || '') <= String(value || ''));
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push((row) => String(row[column] || '') < String(value || ''));
    return this;
  }

  or(): this {
    return this;
  }

  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  maybeSingle(): this {
    this.single = true;
    return this;
  }

  then<TResult1 = { data: Row[] | Row | null; error: null; count: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | Row | null; error: null; count: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const filtered = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    const result = {
      data: this.single ? filtered[0] || null : filtered,
      error: null,
      count: filtered.length
    };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

class FakeSupabase {
  constructor(private readonly tables: TableData) {}

  from(table: string): FakeQuery {
    return new FakeQuery(this.tables[table] || []);
  }
}

describe('business performance direct payment analytics', () => {
  it('uses direct job payments for uninvoiced job revenue and profit', async () => {
    const now = new Date();
    const paidAt = new Date(now.getFullYear(), now.getMonth(), 15).toISOString();
    const createdAt = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const supabase = new FakeSupabase({
      jobs: [
        {
          id: 'job-direct-paid',
          organization_id: 'org-1',
          title: 'Direct paid clean',
          customer_id: 'customer-1',
          customer_name: 'Customer One',
          assigned_to: 'worker-1',
          revenue_amount: null,
          status: 'completed',
          completed_at: paidAt,
          start_date: paidAt.slice(0, 10),
          scheduled_start: paidAt,
          created_at: createdAt
        }
      ],
      job_payments: [
        {
          organization_id: 'org-1',
          job_id: 'job-direct-paid',
          amount: 350,
          paid_at: paidAt
        }
      ],
      invoices: [],
      invoice_payments: [],
      job_labor: [
        {
          organization_id: 'org-1',
          job_id: 'job-direct-paid',
          total_cost: 200,
          created_at: createdAt,
          payment_status: 'paid',
          paid_at: paidAt
        }
      ],
      expenses: [
        {
          organization_id: 'org-1',
          job_id: 'job-direct-paid',
          category: 'Supplies',
          amount: 25,
          date: paidAt.slice(0, 10),
          created_at: createdAt
        }
      ],
      workers: [{ id: 'worker-1', organization_id: 'org-1', name: 'Worker One' }],
      customers: [{ id: 'customer-1', organization_id: 'org-1', company_name: 'Customer One' }],
      job_assignments: [],
      bookings: [],
      messages: [],
      job_reports: []
    });

    const result = await fetchBusinessPerformance(
      supabase as never,
      'org-1'
    );

    const jobProfit = result.profitByJob.find((row) => row.jobId === 'job-direct-paid');
    assert.ok(jobProfit);
    assert.equal(jobProfit.value, 125);
    assert.equal(result.topCustomer?.name, 'Customer One');
    assert.equal(result.topCustomer?.revenue, 350);
    assert.equal(result.topWorker?.name, 'Worker One');
    assert.equal(result.topWorker?.revenue, 350);
  });
});
