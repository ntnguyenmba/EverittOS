import { NextRequest, NextResponse } from 'next/server';
import { syncOrganizationJobsToGoogleCalendar } from '@/lib/google-calendar-sync';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Connections successfully synced after this release already use the corrected
