import { NextResponse } from 'next/server';

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

type SafeErrorBody = {
  error: string;
  title?: string;
  code?: string;
  message?: string;
  /** Shown only outside production. */
  details?: string;
};

/** Strip internal diagnostics from API JSON before returning to clients in production. */
export function sanitizeErrorPayload<T extends Record<string, unknown>>(payload: T): T {
  if (!isProductionRuntime()) return payload;

  const {
    details: _details,
    diagnostics: _diagnostics,
    config: _config,
    connectivity: _connectivity,
    stack: _stack,
    ...safe
  } = payload;

  return safe as T;
}

/** Auth endpoints keep the Supabase message visible to users for faster debugging. */
export function sanitizeAuthErrorPayload<T extends Record<string, unknown>>(payload: T): T {
  if (!isProductionRuntime()) return payload;

  const {
    details: _details,
    diagnostics: _diagnostics,
    config: _config,
    connectivity: _connectivity,
    stack: _stack,
    ...safe
  } = payload;

  return safe as T;
}

export function jsonSafeError(
  body: SafeErrorBody,
  init?: { status?: number; headers?: HeadersInit }
): NextResponse {
  const status = init?.status ?? 500;
  const payload = sanitizeErrorPayload({
    error: body.error,
    ...(body.title ? { title: body.title } : {}),
    ...(body.code ? { code: body.code } : {}),
    ...(body.message ? { message: body.message } : {}),
    ...(!isProductionRuntime() && body.details ? { details: body.details } : {})
  });

  return NextResponse.json(payload, { status, headers: init?.headers });
}

/** Map unknown thrown errors to a user-safe message. */
export function safeErrorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (err instanceof Error) {
    if (isProductionRuntime()) return fallback;
    return err.message || fallback;
  }
  if (typeof err === 'string') {
    if (isProductionRuntime()) return fallback;
    return err;
  }
  return fallback;
}
