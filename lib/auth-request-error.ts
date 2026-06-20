import { mapAuthError, mapAuthErrorByCode } from '@/lib/auth-errors';
import { isProductionRuntime } from '@/lib/safe-api-error';

export type AuthRequestDebug = {
  endpoint: string;
  requestedUrl: string;
  method: string;
  httpStatus?: number;
  httpStatusText?: string;
  apiCode?: string;
  supabaseMessage?: string;
  rawError?: string;
  responseBody?: string;
  profile?: {
    present: boolean;
    skipped?: boolean;
    role?: string | null;
    organizationId?: string | null;
    accountStatus?: string | null;
  };
  organization?: {
    present: boolean;
    skipped?: boolean;
    membershipActive?: boolean;
  };
  session?: {
    verified: boolean;
    userId?: string | null;
  };
};

export type LoginClientError = {
  title: string;
  message: string;
  details: string;
  debug: AuthRequestDebug;
};

function endpointSummary(debug: AuthRequestDebug): string {
  const target = debug.requestedUrl || debug.endpoint;
  if (debug.httpStatus !== undefined) {
    const statusLabel = debug.httpStatusText ? `${debug.httpStatus} ${debug.httpStatusText}` : String(debug.httpStatus);
    return `${debug.method} ${target} → HTTP ${statusLabel}`;
  }
  return `${debug.method} ${target}`;
}

function formatDebugBlock(debug: AuthRequestDebug): string {
  const lines: string[] = [
    `Requested URL: ${debug.requestedUrl || debug.endpoint}`,
    `Method: ${debug.method}`,
    debug.httpStatus !== undefined
      ? `HTTP status: ${debug.httpStatus}${debug.httpStatusText ? ` ${debug.httpStatusText}` : ''}`
      : null,
    debug.apiCode ? `API code: ${debug.apiCode}` : null,
    debug.supabaseMessage ? `Supabase: ${debug.supabaseMessage}` : null,
    debug.rawError ? `Browser error: ${debug.rawError}` : null,
    debug.session
      ? `Session: ${debug.session.verified ? 'verified' : 'missing'}${debug.session.userId ? ` (user ${debug.session.userId})` : ''}`
      : null,
    debug.profile
      ? debug.profile.skipped
        ? 'Profile: skipped (auth did not complete)'
        : `Profile: ${debug.profile.present ? 'yes' : 'no'}${debug.profile.role ? ` · role=${debug.profile.role}` : ''}${debug.profile.organizationId ? ` · org=${debug.profile.organizationId}` : debug.profile.present ? ' · org=missing' : ''}${debug.profile.accountStatus ? ` · status=${debug.profile.accountStatus}` : ''}`
      : null,
    debug.organization
      ? debug.organization.skipped
        ? 'Organization access: skipped (auth did not complete)'
        : `Organization access: ${debug.organization.present ? 'yes' : 'no'}${debug.organization.membershipActive === false ? ' (membership inactive)' : ''}`
      : null,
    debug.responseBody ? `Response body: ${debug.responseBody}` : null
  ].filter(Boolean) as string[];

  return lines.join('\n');
}

export function buildLoginClientError(input: {
  title: string;
  message: string;
  debug: AuthRequestDebug;
  includeEndpointSummary?: boolean;
}): LoginClientError {
  const summary = endpointSummary(input.debug);
  return {
    title: input.title,
    message: input.includeEndpointSummary ? `${summary}\n\n${input.message}` : input.message,
    debug: input.debug,
    details: formatDebugBlock(input.debug)
  };
}

export function parseFetchFailure(
  err: unknown,
  path: string,
  requestedUrl: string,
  method = 'POST'
): LoginClientError {
  const raw = err instanceof Error ? err.message : String(err);
  const isNetworkFailure =
    raw === 'Load failed' ||
    raw === 'Failed to fetch' ||
    raw.includes('NetworkError') ||
    raw.includes('Network request failed');

  return buildLoginClientError({
    title: isNetworkFailure ? 'Connection problem' : 'Sign-in request failed',
    message: isNetworkFailure
      ? 'Unable to connect to the server. Check your connection and try again.'
      : raw || 'Sign-in could not be completed. Try again.',
    debug: {
      endpoint: path,
      requestedUrl,
      method,
      rawError: raw,
      apiCode: isNetworkFailure ? 'fetch_failed' : 'client_exception'
    }
  });
}

export async function parseLoginApiResponse(
  res: Response,
  path: string,
  requestedUrl: string,
  method = 'POST'
): Promise<
  | { ok: true; json: Record<string, unknown> }
  | { ok: false; error: LoginClientError; json: Record<string, unknown> }
> {
  const httpStatus = res.status;
  const httpStatusText = res.statusText;
  let responseText = '';

  try {
    responseText = await res.text();
  } catch (err) {
    return {
      ok: false,
      json: {},
      error: buildLoginClientError({
        title: 'Empty API response',
        message: 'The sign-in endpoint returned no readable response body.',
        debug: {
          endpoint: path,
          requestedUrl,
          method,
          httpStatus,
          httpStatusText,
          rawError: err instanceof Error ? err.message : String(err),
          apiCode: 'empty_response'
        }
      })
    };
  }

  let json: Record<string, unknown> = {};
  if (responseText) {
    try {
      json = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        json: {},
        error: buildLoginClientError({
          title: 'Invalid API response',
          message: 'The sign-in endpoint returned a non-JSON response (often an HTML error page from a server crash).',
          debug: {
            endpoint: path,
            requestedUrl,
            method,
            httpStatus,
            httpStatusText,
            apiCode: 'non_json_response',
            responseBody: responseText.slice(0, 1200)
          }
        })
      };
    }
  }

  if (res.ok) {
    return { ok: true, json };
  }

  const diagnostics = (json.diagnostics || {}) as Record<string, unknown>;
  const profileDiag = diagnostics.profile as Record<string, unknown> | undefined;
  const orgDiag = diagnostics.organization as Record<string, unknown> | undefined;
  const sessionDiag = diagnostics.session as Record<string, unknown> | undefined;
  const apiCode = (json.code as string) || undefined;
  const rawSupabase = (json.supabaseMessage as string) || undefined;
  const friendlyFromCode = mapAuthErrorByCode(apiCode);
  const mapped = mapAuthError(rawSupabase, apiCode as 'invalid_credentials' | undefined);
  const userMessage =
    (json.error as string) ||
    friendlyFromCode?.message ||
    mapped.message ||
    'Sign-in was rejected by the server.';
  const detailMessage = isProductionRuntime()
    ? undefined
    : (json.details as string) || rawSupabase || apiCode || undefined;

  return {
    ok: false,
    json,
    error: buildLoginClientError({
      title: (json.title as string) || mapped.title || (json.setupRequired ? 'Workspace setup required' : 'Sign in failed'),
      message: userMessage,
      debug: {
        endpoint: path,
        requestedUrl,
        method,
        httpStatus,
        httpStatusText,
        apiCode,
        supabaseMessage: rawSupabase,
        rawError: detailMessage,
        responseBody: responseText.slice(0, 1200),
        profile: profileDiag
          ? profileDiag.skipped
            ? { present: false, skipped: true }
            : {
                present: Boolean(profileDiag.present),
                role: (profileDiag.role as string | null) ?? null,
                organizationId: (profileDiag.organizationId as string | null) ?? null,
                accountStatus: (profileDiag.accountStatus as string | null) ?? null
              }
          : undefined,
        organization: orgDiag
          ? orgDiag.skipped
            ? { present: false, skipped: true }
            : {
                present: Boolean(orgDiag.present),
                membershipActive: orgDiag.membershipActive as boolean | undefined
              }
          : undefined,
        session: sessionDiag
          ? {
              verified: Boolean(sessionDiag.verified),
              userId: (sessionDiag.userId as string | null) ?? null
            }
          : undefined
      }
    })
  };
}
