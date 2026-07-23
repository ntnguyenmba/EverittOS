export type QuickBooksFault = {
  code?: string;
  type?: string;
  message?: string;
  detail?: string;
};

export type ParsedQuickBooksError = {
  userMessage: string;
  code?: string;
  faultType?: string;
  httpStatus: number;
  intuitTid: string | null;
  reconnectRequired: boolean;
  retryable: boolean;
};

export function extractIntuitTid(headers: Headers | Record<string, string | null | undefined>): string | null {
  if (headers instanceof Headers) {
    return headers.get('intuit_tid') || headers.get('Intuit-Tid') || null;
  }
  return headers['intuit_tid'] || headers['Intuit-Tid'] || headers['INTUIT_TID'] || null;
}

function firstFault(body: unknown): QuickBooksFault | null {
  if (!body || typeof body !== 'object') return null;
  const root = body as Record<string, unknown>;
  const fault = (root.Fault || root.fault) as Record<string, unknown> | undefined;
  if (!fault) {
    if (typeof root.error === 'string') return { message: root.error, code: String(root.error || '') };
    return null;
  }
  const error = Array.isArray(fault.Error) ? fault.Error[0] : fault.Error;
  if (!error || typeof error !== 'object') {
    return { type: String(fault.type || ''), message: String(fault.message || 'QuickBooks request failed.') };
  }
  const err = error as Record<string, unknown>;
  return {
    code: err.code != null ? String(err.code) : undefined,
    type: fault.type != null ? String(fault.type) : undefined,
    message: err.Message != null ? String(err.Message) : err.message != null ? String(err.message) : undefined,
    detail: err.Detail != null ? String(err.Detail) : err.detail != null ? String(err.detail) : undefined
  };
}

export function parseQuickBooksError(input: {
  httpStatus: number;
  body: unknown;
  intuitTid?: string | null;
  oauthError?: string | null;
}): ParsedQuickBooksError {
  const fault = firstFault(input.body);
  const oauthError =
    input.oauthError ||
    (input.body && typeof input.body === 'object'
      ? String((input.body as Record<string, unknown>).error || '')
      : '');

  const code = fault?.code || oauthError || undefined;
  const faultType = fault?.type;
  const reconnectRequired =
    input.httpStatus === 401 ||
    code === 'invalid_grant' ||
    code === 'invalid_client' ||
    /token|unauthorized|authentication/i.test(String(fault?.message || ''));

  const retryable = input.httpStatus === 429 || input.httpStatus >= 500;

  let userMessage = 'QuickBooks could not complete this request. Try again in a moment.';
  if (code === 'invalid_grant' || reconnectRequired) {
    userMessage = 'QuickBooks access expired. Disconnect and connect again in Settings → Integrations.';
  } else if (input.httpStatus === 429) {
    userMessage = 'QuickBooks is rate limiting requests. Wait a minute and try again.';
  } else if (input.httpStatus >= 500) {
    userMessage = 'QuickBooks is temporarily unavailable. Try again shortly.';
  } else if (fault?.message) {
    userMessage = 'QuickBooks rejected this request. Check the customer or invoice details and try again.';
  } else if (input.httpStatus === 403) {
    userMessage = 'QuickBooks denied access for this company. Confirm your QuickBooks permissions and reconnect.';
  }

  return {
    userMessage,
    code,
    faultType,
    httpStatus: input.httpStatus,
    intuitTid: input.intuitTid || null,
    reconnectRequired,
    retryable
  };
}

/** Escape a string for QuickBooks SQL-like queries. */
export function escapeQuickBooksQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
