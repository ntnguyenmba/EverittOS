import { redirect } from 'next/navigation';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CreateJobPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) next.append(key, item);
    } else if (typeof value === 'string') {
      next.set(key, value);
    }
  }

  const query = next.toString();
  redirect(query ? `/jobs/new?${query}` : '/jobs/new');
}
