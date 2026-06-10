import { NextResponse } from 'next/server';
import { authenticateApiRequest, hasScope, jsonError } from '@/lib/api-auth';

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  if (!hasScope(auth, 'read:customers')) return jsonError('Missing read:customers scope.', 403);

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);

  const { data, error } = await auth.admin
    .from('customers')
    .select('id, name, phone, email, address, department_id, created_at')
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ customers: data || [] });
}
