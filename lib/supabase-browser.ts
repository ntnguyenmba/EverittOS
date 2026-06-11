import { createBrowserClient } from '@supabase/ssr';
import { buildTimeSupabaseAnonKey, buildTimeSupabaseUrl } from '@/lib/supabase-config';

export const supabase = createBrowserClient(buildTimeSupabaseUrl(), buildTimeSupabaseAnonKey());
