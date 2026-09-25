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
    supabaseMessage: _supabaseMessage,
    diagnosisReason: _diagnosisReason,
    ...safe
  } = payload;

  return safe as T;
}

/** Auth endpoints: friendly user messages only in production (no raw Supabase text). */
export function sanitizeAuthErrorPayload<T extends Record<string, unknown>>(payload: T): T {
  return sanitizeErrorPayload(payload);
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

const DATABASE_ERROR_CODE = /^(PGRST\d{3}|[0-9A-Z]{5})$/;
const DATABASE_ERROR_TEXT =
  /(relation "|column "|violates|JSON object requested|syntax error|permission denied for|duplicate key|invalid input syntax|schema cache|null value in column|foreign key|row-level security|could not find the)/i;

/**
 * Message for an API error response. Application and auth messages pass
 * through; database internals (PostgREST/Postgres codes, SQL text) are logged
 * server-side and replaced with a generic message.
 */
export function publicErrorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (!error) return fallback;
  const record = typeof error === 'object' ? (error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }) : null;
  const message = typeof error === 'string' ? error : typeof record?.message === 'string' ? record.message : '';
  const code = typeof record?.code === 'string' ? record.code : '';
  const isDatabaseError = DATABASE_ERROR_CODE.test(code) || DATABASE_ERROR_TEXT.test(message) || (record !== null && ('details' in record || 'hint' in record));
  if (!isDatabaseError) return message || fallback;
  console.error(`[everittos-api] ${JSON.stringify({ event: 'database_error_hidden', code: code || null, message })}`);
  return fallback;
}
