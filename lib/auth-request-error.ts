export type AuthRequestDebug = {
  endpoint: string;
  method: string;
  httpStatus?: number;
  httpStatusText?: string;
  apiCode?: string;
  supabaseMessage?: string;
  rawError?: string;
  responseBody?: string;
  profile?: {
    present: boolean;
    role?: string | null;
    organizationId?: string | null;
    accountStatus?: string | null;
  };
  organization?: {
    present: boolean;
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

function formatDebugBlock(debug: AuthRequestDebug): string {
  const lines: string[] = [
    `Endpoint: ${debug.method} ${debug.endpoint}`,
    debug.httpStatus !== undefined ? `HTTP status: ${debug.httpStatus}${debug.httpStatusText ? ` ${debug.httpStatusText}` : ''}` : null,
    debug.apiCode ? `API code: ${debug.apiCode}` : null,
    debug.supabaseMessage ? `Supabase: ${debug.supabaseMessage}` : null,
    debug.rawError ? `Error: ${debug.rawError}` : null,
    debug.session
      ? `Session: ${debug.session.verified ? 'verified' : 'missing'}${debug.session.userId ? ` (user ${debug.session.userId})` : ''}`
      : null,
    debug.profile
      ? `Profile: ${debug.profile.present ? 'yes' : 'no'}${debug.profile.role ? ` · role=${debug.profile.role}` : ''}${debug.profile.organizationId ? ` · org=${debug.profile.organizationId}` : debug.profile.present ? ' · org=missing' : ''}${debug.profile.accountStatus ? ` · status=${debug.profile.accountStatus}` : ''}`
      : null,
    debug.organization
      ? `Organization access: ${debug.organization.present ? 'yes' : 'no'}${debug.organization.membershipActive === false ? ' (membership inactive)' : ''}`
      : null,
    debug.responseBody ? `Response body: ${debug.responseBody}` : null
  ].filter(Boolean) as string[];

  return lines.join('\n');
}

export function buildLoginClientError(input: {
  title: string;
  message: string;
  debug: AuthRequestDebug;
}): LoginClientError {
  return {
    title: input.title,
    message: input.message,
    debug: input.debug,
    details: formatDebugBlock(input.debug)
  };
}

export function parseFetchFailure(err: unknown, endpoint: string, method = 'POST'): LoginClientError {
  const raw = err instanceof Error ? err.message : String(err);
  const isLoadFailed = raw === 'Load failed' || raw === 'Failed to fetch';
  const isSafariBlock = isLoadFailed || raw.includes('NetworkError');

  return buildLoginClientError({
    title: isSafariBlock ? 'Request blocked or unreachable' : 'Sign-in request failed',
    message: isSafariBlock
      ? 'The browser could not complete the sign-in request. This often means the API route crashed, returned a non-JSON response, or was blocked before a response arrived.'
      : raw || 'An unexpected error occurred during sign-in.',
    debug: {
      endpoint,
      method,
      rawError: raw,
      apiCode: isSafariBlock ? 'fetch_failed' : 'client_exception'
    }
  });
}

export async function parseLoginApiResponse(
  res: Response,
  endpoint: string,
  method = 'POST'
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: LoginClientError }> {
  const httpStatus = res.status;
  const httpStatusText = res.statusText;
  let responseText = '';

  try {
    responseText = await res.text();
  } catch (err) {
    return {
      ok: false,
      error: buildLoginClientError({
        title: 'Empty API response',
        message: 'The sign-in endpoint returned no readable response body.',
        debug: {
          endpoint,
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
        error: buildLoginClientError({
          title: 'Invalid API response',
          message: 'The sign-in endpoint returned a non-JSON response (often an HTML error page from a server crash).',
          debug: {
            endpoint,
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

  return {
    ok: false,
    error: buildLoginClientError({
      title: (json.title as string) || (json.setupRequired ? 'Workspace setup required' : 'Sign in failed'),
      message: (json.error as string) || `Sign-in failed with HTTP ${httpStatus}.`,
      debug: {
        endpoint,
        method,
        httpStatus,
        httpStatusText,
        apiCode: (json.code as string) || undefined,
        supabaseMessage: (json.supabaseMessage as string) || undefined,
        responseBody: responseText.slice(0, 1200),
        profile: profileDiag
          ? {
              present: Boolean(profileDiag.present),
              role: (profileDiag.role as string | null) ?? null,
              organizationId: (profileDiag.organizationId as string | null) ?? null,
              accountStatus: (profileDiag.accountStatus as string | null) ?? null
            }
          : undefined,
        organization: orgDiag
          ? {
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
