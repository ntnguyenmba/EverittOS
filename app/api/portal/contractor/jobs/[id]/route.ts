import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Contractor job records are read-only.
 * Purpose-built workflow endpoints should handle explicit actions such as
 * starting work, completing work, or uploading job photos.
 */
export async function PATCH() {
  return NextResponse.json(
    { error: 'Contractor job details are read-only.' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}
