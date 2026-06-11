import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { applySessionMarkers, createSupabaseCookieAdapter } from '@/lib/auth-cookies';
import { createTabSessionId } from '@/lib/session-policy';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-config';

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/** Route handler Supabase client that buffers auth cookies for the final NextResponse. */
export async function createRouteHandlerSupabase() {
  const cookieStore = await cookies();
  const pendingCookies: CookieToSet[] = [];

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: createSupabaseCookieAdapter({
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
      })
    }
  );

  function attachCookies<T extends NextResponse>(response: T): T {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  function json(body: unknown, init?: ResponseInit) {
    return attachCookies(NextResponse.json(body, init));
  }

  function jsonWithAuthSession(body: Record<string, unknown>, init?: ResponseInit) {
    const tabSessionId = createTabSessionId();
    const response = NextResponse.json({ ...body, tabSessionId }, init);
    applySessionMarkers(response, tabSessionId);
    return attachCookies(response);
  }

  function redirect(url: URL | string, options?: { establishSession?: boolean }) {
    const response = NextResponse.redirect(url);
    if (options?.establishSession) {
      applySessionMarkers(response);
    }
    return attachCookies(response);
  }

  return { supabase, json, jsonWithAuthSession, redirect, attachCookies, pendingCookies };
}
