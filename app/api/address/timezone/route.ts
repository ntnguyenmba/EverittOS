import { NextResponse } from 'next/server';
import { timezoneFromCoordinates } from '@/lib/timezone-from-coords';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const lat = Number.parseFloat(url.searchParams.get('lat') || '');
  const lng = Number.parseFloat(url.searchParams.get('lng') || '');

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Latitude and longitude are required.' }, { status: 400 });
  }

  const timezone = timezoneFromCoordinates(lat, lng);
  if (!timezone) {
    return NextResponse.json({ error: 'Unable to determine timezone for these coordinates.' }, { status: 404 });
  }

  return NextResponse.json({ timezone, latitude: lat, longitude: lng });
}
