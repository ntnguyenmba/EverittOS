import { logAuthEvent } from '@/lib/auth-logger';

export type BootstrapSqlError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export type BootstrapOperation = {
  step: string;
  table: string;
  action: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  userId: string;
  emailDomain?: string | null;
  ok: boolean;
  error?: BootstrapSqlError | null;
  meta?: Record<string, string | number | boolean | null | undefined>;
};

function normalizeSqlError(error: unknown): BootstrapSqlError | null {
  if (!error || typeof error !== 'object') {
    return error ? { message: String(error) } : null;
  }

  const record = error as Record<string, unknown>;
  return {
    message: typeof record.message === 'string' ? record.message : undefined,
    code: typeof record.code === 'string' ? record.code : undefined,
    details: typeof record.details === 'string' ? record.details : undefined,
    hint: typeof record.hint === 'string' ? record.hint : undefined
  };
}

/** Structured bootstrap logging with Postgres error metadata (server logs only). */
export function logBootstrapOperation(input: BootstrapOperation): void {
  const sql = input.error || null;
  const payload: Record<string, string | number | boolean> = {
    event: input.ok ? 'bootstrap_step_ok' : 'bootstrap_step_failed',
    step: input.step,
    table: input.table,
    action: input.action,
    userId: input.userId
  };

  if (input.emailDomain) payload.emailDomain = input.emailDomain;

  if (input.meta) {
    for (const [key, value] of Object.entries(input.meta)) {
      if (value !== undefined && value !== null) payload[key] = value;
    }
  }

  if (sql?.code) payload.pgCode = sql.code;
  if (sql?.details) payload.pgDetails = sql.details;
  if (sql?.hint) payload.pgHint = sql.hint;
  if (sql?.message) payload.reason = sql.message;

  logAuthEvent(input.ok ? 'bootstrap_step_ok' : 'bootstrap_step_failed', payload);

  if (!input.ok) {
    const line = {
      ...payload,
      stack: new Error(`bootstrap:${input.step}`).stack
    };
    console.error(`[everittos-bootstrap] ${JSON.stringify(line)}`);
  }
}

export function logBootstrapException(step: string, userId: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : new Error(message).stack;
  logAuthEvent('bootstrap_step_failed', { step, userId, reason: message });
  console.error(
    `[everittos-bootstrap] ${JSON.stringify({
      event: 'bootstrap_exception',
      step,
      userId,
      reason: message,
      stack
    })}`
  );
}

export function asSqlError(error: unknown): BootstrapSqlError | null {
  return normalizeSqlError(error);
}
