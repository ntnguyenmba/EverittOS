import type { SupabaseClient } from '@supabase/supabase-js';
import type { AskEverittSuggestion } from '@/lib/ask-everitt/types';

export type SmartSuggestionLocale = 'en' | 'es' | 'vi';

type SuggestionSeed = Omit<AskEverittSuggestion, 'count'> & {
  countLoader?: () => Promise<number | undefined>;
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

  const seeds: SuggestionSeed[] = [];

  if (path.startsWith('/estimates')) {
    seeds.push(
      {
        id: 'open-estimates',
        label: t(locale, 'Open estimates', 'Estimaciones abiertas', 'Báo giá đang mở'),
        prompt: 'Open estimates',
        countLoader: () => countRows(
          supabase.from('outbound_documents').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('doc_type', 'estimate').in('status', ['draft', 'sent', 'scheduled'])
        )
      },
      {
        id: 'sent-estimates-month',
        label: t(locale, 'Estimates sent this month', 'Estimaciones enviadas este mes', 'Báo giá đã gửi tháng này'),
        prompt: 'Estimates sent this month'
      }
    );
  }

  if (path.startsWith('/jobs') || path.startsWith('/schedule')) {
    seeds.push(
      {
        id: 'jobs-today',
        label: t(locale, 'Jobs today', 'Trabajos de hoy', 'Công việc hôm nay'),
        prompt: "What's on the schedule today?",
        countLoader: () => countRows(
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('start_date', today)
        )
      },
      {
        id: 'unassigned-week',
        label: t(locale, 'Unassigned jobs this week', 'Trabajos sin asignar esta semana', 'Công việc chưa phân công tuần này'),
        prompt: 'Unassigned jobs this week',
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

  const customerMatch = path.match(/^\/customers\/([^/]+)/);
  if (customerMatch) {
    const customerId = customerMatch[1];
    seeds.push(
      {
        id: 'customer-jobs',
        label: t(locale, 'Jobs for this customer', 'Trabajos de este cliente', 'Công việc của khách hàng này'),
        prompt: 'Show jobs for this customer',
        countLoader: () => countRows(
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('customer_id', customerId)
        )
      },
      {
        id: 'customer-estimates',
        label: t(locale, 'Open estimates for this customer', 'Estimaciones abiertas de este cliente', 'Báo giá đang mở của khách hàng này'),
        prompt: 'Open estimates for this customer',
        countLoader: () => countRows(
          supabase.from('outbound_documents').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('doc_type', 'estimate').eq('customer_id', customerId).in('status', ['draft', 'sent', 'scheduled'])
        )
      }
    );
  }

  seeds.push(
    {
      id: 'next-jobs',
      label: t(locale, 'Next scheduled jobs', 'Próximos trabajos programados', 'Công việc sắp tới'),
      prompt: "When's the next job?"
    },
    {
      id: 'overdue-invoices',
      label: t(locale, 'Overdue invoices', 'Facturas vencidas', 'Hóa đơn quá hạn'),
      prompt: 'Overdue invoices',
      countLoader: () => countRows(
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).lt('due_date', today).not('status', 'in', '("paid","void","cancelled","canceled")')
      )
    },
    {
      id: 'jobs-tomorrow',
      label: t(locale, 'Jobs tomorrow', 'Trabajos de mañana', 'Công việc ngày mai'),
      prompt: 'Jobs tomorrow',
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

  const unique = Array.from(new Map(seeds.map((seed) => [seed.id, seed])).values()).slice(0, 6);
  return Promise.all(unique.map(async (seed) => {
    const count = seed.countLoader ? await seed.countLoader() : undefined;
    return {
      id: seed.id,
      prompt: seed.prompt,
      label: count == null ? seed.label : `${seed.label} (${count})`,
      count
    };
  }));
}
