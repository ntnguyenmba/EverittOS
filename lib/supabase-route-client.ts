import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-config';

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/** Route handler Supabase client that buffers auth cookies for the final NextResponse. */
export async function createRouteHandlerSupabase() {
  const cookieStore = await cookies();
  const pendingCookies: CookieToSet[] = [];

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach((entry) => {
          pendingCookies.push(entry);
          try {
            cookieStore.set(entry.name, entry.value, entry.options);
          } catch {
            /* cookieStore may reject in some server contexts */
          }
        });
      }
    }
  });

  function attachCookies<T extends NextResponse>(response: T): T {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  function json(body: unknown, init?: ResponseInit) {
    return attachCookies(NextResponse.json(body, init));
  }

  function redirect(url: URL | string) {
    return attachCookies(NextResponse.redirect(url));
  }

  return { supabase, json, redirect, attachCookies, pendingCookies };
}
