import { NextResponse } from 'next/server';
import type { OrganizationContext } from '@/lib/organization-server';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getCalendarApiCopy } from '@/lib/i18n/calendar-api-copy';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

export const CALENDAR