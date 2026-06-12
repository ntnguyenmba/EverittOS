import { friendlyErrorMessage } from '@/lib/user-errors';

export type ActionFeedback = {
  kind: 'success' | 'error' | 'info';
  message: string;
};

export function successFeedback(message: string): ActionFeedback {
  return { kind: 'success', message };
}

export function errorFeedback(raw: string | null | undefined, fallback = 'Something went wrong. Try again.'): ActionFeedback {
  return { kind: 'error', message: friendlyErrorMessage(raw, fallback) };
}

export async function readApiError(res: Response, fallback = 'Request failed.'): Promise<string> {
  try {
    const json = await res.json();
    if (typeof json?.error === 'string' && json.error.trim()) return json.error;
    if (typeof json?.message === 'string' && json.message.trim()) return json.message;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function formatSupabaseError(error: { message?: string; code?: string; details?: string } | null | undefined): string {
  if (!error?.message) return 'Database request failed.';
  const msg = error.message;
  const lower = msg.toLowerCase();
  if (lower.includes('row-level security') || lower.includes('permission denied') || error.code === '42501') {
    return 'You do not have permission to save this record. Ask your workspace owner for access.';
  }
  if (lower.includes('violates foreign key')) {
    return 'This record is linked to missing data. Refresh the page and try again.';
  }
  if (lower.includes('duplicate key')) {
    return 'This record already exists.';
  }
  return friendlyErrorMessage(msg);
}

export function requireSignedInFeedback(): ActionFeedback {
  return errorFeedback('Sign in to continue.', 'Sign in to continue.');
}
