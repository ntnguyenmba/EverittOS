import type { SupabaseClient } from '@supabase/supabase-js';
import type { AskEverittSuggestion } from '@/lib/ask-everitt/types';

export type SmartSuggestionLocale = 'en' | 'es' | 'vi';

type SuggestionSeed = Omit<AskEverittSuggestion, 'count'> & {
  countLoader?: () => Promise<number | undefined>;
  hideWhenEmpty?: boolean;
};

function t(locale: SmartSuggestionLocale, en: string, es: string, vi: string): string {
  if (locale === 'es') return es;
  if (locale === 'vi') return vi;
  return en;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return isoDate(d);
}

function endOfWeek(): string {
  const d = new Date(startOfWeek());
  d.setDate(d.getDate() + 6);
  return isoDate(d);
}

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return isoDate(d);
}

function pagePath(pageContext: string): string {
  const match = pageContext.match(/Current EverittOS page:\s*([^\.\s]+)/i);
  return match?.[1] || '';
}

async function countRows(queryPromise: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | undefined> {
  try {
    const result = await queryPromise;
    return result.error ? undefined : result.count ?? undefined;
  } catch {
    return undefined;
  }
}

export async function buildSmartAskSuggestions(
  supabase: SupabaseClient,
  orgId: string,
  locale: SmartSuggestionLocale,
  pageContext: string
): Promise<AskEverittSuggestion[]> {
  const path = pagePath(pageContext);
  const today = isoDate(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = isoDate(tomorrowDate);
  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();
  const monthStart = startOfMonth();

  const seeds: SuggestionSeed[] = [];

  if (path.startsWith('/estimates')) {
    seeds.push(
      {
        id: 'open-estimates',
        label: t(locale, 'Open estimates', 'Estimaciones abiertas', 'Báo giá đang mở'),
        prompt: 'Open estimates',
        hideWhenEmpty: true,
        countLoader: () => countRows(
          supabase.from('outbound_documents').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('doc_type', 'estimate').in('status', ['draft', 'sent', 'scheduled'])
        )
      },
      {
        id: 'sent-estimates-month',
        label: t(locale, 'Estimates sent this month', 'Estimaciones enviadas este mes', 'Báo giá đã gửi tháng này'),
        prompt: 'Estimates sent this month',
        hideWhenEmpty: true,
        countLoader: () => countRows(
          supabase.from('outbound_documents').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('doc_type', 'estimate').eq('status', 'sent').gte('sent_at', `${monthStart}T00:00:00`)
        )
      }
    );
  }

  if (path.startsWith('/jobs') || path.startsWith('/schedule')) {
    seeds.push(
      {
        id: 'jobs-today',
        label: t(locale, 'Jobs today', 'Trabajos de hoy', 'Công việc hôm nay'),
        prompt: "What's on the schedule today?",
        hideWhenEmpty: true,
        countLoader: () => countRows(
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('start_date', today)
        )
      },
      {
        id: 'jobs-tomorrow',
        label: t(locale, 'Jobs tomorrow', 'Trabajos de mañana', 'Công việc ngày mai'),
        prompt: 'Jobs tomorrow',
        hideWhenEmpty: true,
        countLoader: () => countRows(
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('start_date', tomorrow)
        )
      },
      {
        id: 'unassigned-week',
        label: t(locale, 'Unassigned jobs this week', 'Trabajos sin asignar esta semana', 'Công việc chưa phân công tuần này'),
        prompt: 'Unassigned jobs this week',
        hideWhenEmpty: true,
        countLoader: () => countRows(
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).is('assigned_to', null).gte('start_date', weekStart).lte('start_date', weekEnd)
        )
      },
      {
        id: 'free-tomorrow',
        label: t(locale, 'Who is free tomorrow?', '¿Quién está libre mañana?', 'Ai rảnh ngày mai?'),
        prompt: 'Who is free tomorrow?'
      }
    );
  }

  if (path.startsWith('/invoices')) {
    seeds.push(
      {
        id: 'unpaid-invoices',
        label: t(locale, 'Unpaid invoices', 'Facturas sin pagar', 'Hóa đơn chưa thanh toán'),
        prompt: 'Unpaid invoices',
        hideWhenEmpty: true,
        countLoader: () => countRows(
          supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).not('status', 'in', '("paid","void","cancelled","canceled")')
        )
      },
      {
        id: 'overdue-invoices',
        label: t(locale, 'Overdue invoices', 'Facturas vencidas', 'Hóa đơn quá hạn'),
        prompt: 'Overdue invoices',
        hideWhenEmpty: true,
        countLoader: () => countRows(
          supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).lt('due_date', today).not('status', 'in', '("paid","void","cancelled","canceled")')
        )
      }
    );
  }

  if (path.startsWith('/leads') || path.startsWith('/requests')) {
    seeds.push(
      {
        id: 'new-leads-week',
        label: t(locale, 'New requests this week', 'Solicitudes nuevas esta semana', 'Yêu cầu mới tuần này'),
        prompt: 'New leads this week',
        hideWhenEmpty: true,
        countLoader: () => countRows(
          supabase.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).in('pipeline_stage', ['lead', 'qualified']).gte('created_at', `${weekStart}T00:00:00`)
        )
      },
      {
        id: 'requests-waiting-estimate',
        label: t(locale, 'Requests waiting for an estimate', 'Solicitudes esperando una estimación', 'Yêu cầu đang chờ báo giá'),
        prompt: 'Leads waiting for estimate'
      }
    );
  }

  if (path.startsWith('/team') || path.startsWith('/workers')) {
    seeds.push(
      {
        id: 'free-tomorrow',
        label: t(locale, 'Who is free tomorrow?', '¿Quién está libre mañana?', 'Ai rảnh ngày mai?'),
        prompt: 'Who is free tomorrow?'
      },
      {
        id: 'unassigned-week',
        label: t(locale, 'Unassigned jobs this week', 'Trabajos sin asignar esta semana', 'Công việc chưa phân công tuần này'),
        prompt: 'Unassigned jobs this week',
        hideWhenEmpty: true,
        countLoader: () => countRows(
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).is('assigned_to', null).gte('start_date', weekStart).lte('start_date', weekEnd)
        )
      }
    );
  }

  if (path === '/customers' || path.startsWith('/customers?')) {
    seeds.push(
      {
        id: 'inactive-customers',
        label: t(locale, 'Customers inactive for 90 days', 'Clientes inactivos por 90 días', 'Khách hàng không hoạt động 90 ngày'),
        prompt: 'Customers with no jobs in 90 days'
      },
      {
        id: 'customers-open-estimates',
        label: t(locale, 'Customers with open estimates', 'Clientes con estimaciones abiertas', 'Khách hàng có báo giá đang mở'),
        prompt: 'Customers with open estimates'
      }
    );
  }

  const customerMatch = path.match(/^\/customers\/([^/]+)/);
  if (customerMatch) {
    const customerId = customerMatch[1];
    seeds.push(
      {
        id: 'customer-jobs',
        label: t(locale, 'Jobs for this customer', 'Trabajos de este cliente', 'Công việc của khách hàng này'),
        prompt: 'Show jobs for this customer',
        hideWhenEmpty: true,
        countLoader: () => countRows(
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('customer_id', customerId)
        )
      },
      {
        id: 'customer-estimates',
        label: t(locale, 'Open estimates for this customer', 'Estimaciones abiertas de este cliente', 'Báo giá đang mở của khách hàng này'),
        prompt: 'Open estimates for this customer',
        hideWhenEmpty: true,
        countLoader: () => countRows(
          supabase.from('outbound_documents').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('doc_type', 'estimate').eq('customer_id', customerId).in('status', ['draft', 'sent', 'scheduled'])
        )
      },
      {
        id: 'customer-invoices',
        label: t(locale, 'Unpaid invoices for this customer', 'Facturas sin pagar de este cliente', 'Hóa đơn chưa thanh toán của khách hàng này'),
        prompt: 'Unpaid invoices for this customer'
      }
    );
  }

  seeds.push(
    {
      id: 'next-jobs',
      label: t(locale, 'Next scheduled job', 'Próximo trabajo programado', 'Công việc tiếp theo'),
      prompt: "When's the next job?"
    },
    {
      id: 'overdue-invoices',
      label: t(locale, 'Overdue invoices', 'Facturas vencidas', 'Hóa đơn quá hạn'),
      prompt: 'Overdue invoices',
      hideWhenEmpty: true,
      countLoader: () => countRows(
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).lt('due_date', today).not('status', 'in', '("paid","void","cancelled","canceled")')
      )
    },
    {
      id: 'jobs-tomorrow',
      label: t(locale, 'Jobs tomorrow', 'Trabajos de mañana', 'Công việc ngày mai'),
      prompt: 'Jobs tomorrow',
      hideWhenEmpty: true,
      countLoader: () => countRows(
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('start_date', tomorrow)
      )
    },
    {
      id: 'requests-followup',
      label: t(locale, 'Requests needing follow-up', 'Solicitudes que necesitan seguimiento', 'Yêu cầu cần theo dõi'),
      prompt: 'Which leads need follow-up?'
    }
  );

  const unique = Array.from(new Map(seeds.map((seed) => [seed.id, seed])).values());
  const resolved = await Promise.all(unique.map(async (seed) => {
    const count = seed.countLoader ? await seed.countLoader() : undefined;
    if (seed.hideWhenEmpty && count === 0) return null;
    return {
      id: seed.id,
      prompt: seed.prompt,
      label: count == null ? seed.label : `${seed.label} (${count})`,
      count
    } satisfies AskEverittSuggestion;
  }));

  return resolved.filter((suggestion): suggestion is AskEverittSuggestion => Boolean(suggestion)).slice(0, 6);
}
