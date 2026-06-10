import { NextResponse } from 'next/server';
import { authenticateApiRequest, hasScope, jsonError } from '@/lib/api-auth';

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  if (!hasScope(auth, 'read:workers')) return jsonError('Missing read:workers scope.', 403);

  const { data, error } = await auth.admin
    .from('workers')
    .select('id, name, role, phone, department_id, created_at')
    .eq('organization_id', auth.organizationId)
    .order('name');

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ workers: data || [] });
}
