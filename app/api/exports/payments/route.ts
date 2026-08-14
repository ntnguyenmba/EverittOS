import { exportGetResponse } from '@/lib/exports/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return exportGetResponse(request, 'payments');
}
