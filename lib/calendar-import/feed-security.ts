import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const CALENDAR_FEED_TIMEOUT_MS = 12_000;
export const CALENDAR_FEED_MAX_BYTES = 1_500_000;
export const CALENDAR_FEED_MAX_REDIRECTS = 3;

export type FeedUrlValidation =
  | { ok: true; href: string; hostname: string }
  | { ok: false; code: 'invalid_url' | 'unsafe_url' };

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.internal'
]);

function stripWrapping(value: string): string {
  return value.trim().replace(/^['"]+|['"]+$/g, '').trim();
}

export function convertWebcalToHttps(raw: string): string {
  const value = stripWrapping(raw);
  if (/^webcal:\/\//i.test(value)) {
    return `https://${value.slice('webcal://'.length)}`;
  }
  return value;
}

export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

export function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fe80:') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (isIP(mapped) === 4) return isPrivateIPv4(mapped);
  }
  return false;
}

export function isBlockedIpAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '0.0.0.0') return true;
  if (isIP(host) && isBlockedIpAddress(host)) return true;
  return false;
}

export function validatePublicFeedUrl(raw: string): FeedUrlValidation {
  const converted = convertWebcalToHttps(raw);
  if (!converted) return { ok: false, code: 'invalid_url' };

  let parsed: URL;
  try {
    parsed = new URL(converted);
  } catch {
    return { ok: false, code: 'invalid_url' };
  }

  if (parsed.protocol !== 'https:') return { ok: false, code: 'unsafe_url' };
  if (parsed.username || parsed.password) return { ok: false, code: 'unsafe_url' };
  if (parsed.port && parsed.port !== '443') return { ok: false, code: 'unsafe_url' };
  if (isBlockedHostname(parsed.hostname)) return { ok: false, code: 'unsafe_url' };
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return { ok: false, code: 'unsafe_url' };

  return { ok: true, href: parsed.href, hostname: parsed.hostname };
}

export async function resolvePublicHostAddresses(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  const addresses = records.map((record) => record.address).filter(Boolean);
  if (addresses.length === 0) {
    throw new Error('Host could not be resolved.');
  }
  if (addresses.some((address) => isBlockedIpAddress(address))) {
    throw new Error('Host resolves to a private or blocked address.');
  }
  return addresses;
}

export function redactFeedUrl(_value: string): string {
  return '[redacted-calendar-url]';
}

export function calendarFeedErrorMessage(code: 'invalid_url' | 'unsafe_url' | 'fetch_failed' | 'not_calendar'): string {
  if (code === 'invalid_url') return 'Enter a valid calendar subscription URL.';
  if (code === 'unsafe_url') return 'That calendar URL is not allowed.';
  if (code === 'not_calendar') return 'The URL did not return a calendar feed.';
  return 'The calendar feed could not be downloaded.';
}

function headerString(headers: Headers, name: string): string {
  return headers.get(name) || '';
}

function isCalendarContentType(contentType: string): boolean {
  const value = contentType.toLowerCase();
  if (!value) return true;
  return (
    value.includes('text/calendar') ||
    value.includes('application/ics') ||
    value.includes('text/plain') ||
    value.includes('application/octet-stream')
  );
}

async function readLimitedBody(response: Response): Promise<string> {
  const declared = Number(headerString(response.headers, 'content-length'));
  if (Number.isFinite(declared) && declared > CALENDAR_FEED_MAX_BYTES) {
    throw new Error('Calendar feed is too large.');
  }

  if (!response.body) {
    const text = await response.text();
    if (text.length > CALENDAR_FEED_MAX_BYTES) throw new Error('Calendar feed is too large.');
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > CALENDAR_FEED_MAX_BYTES) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      throw new Error('Calendar feed is too large.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function fetchPublicCalendarFeed(
  rawUrl: string,
  options?: { fetchImpl?: typeof fetch }
): Promise<{ href: string; body: string }> {
  const validated = validatePublicFeedUrl(rawUrl);
  if (!validated.ok) {
    throw Object.assign(new Error(calendarFeedErrorMessage(validated.code)), { code: validated.code });
  }

  await resolvePublicHostAddresses(validated.hostname);

  const fetchImpl = options?.fetchImpl || fetch;
  let current = validated.href;
  for (let hop = 0; hop <= CALENDAR_FEED_MAX_REDIRECTS; hop += 1) {
    const nextValidated = validatePublicFeedUrl(current);
    if (!nextValidated.ok) {
      throw Object.assign(new Error(calendarFeedErrorMessage('unsafe_url')), { code: 'unsafe_url' });
    }
    await resolvePublicHostAddresses(nextValidated.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CALENDAR_FEED_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchImpl(nextValidated.href, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/calendar, text/plain, application/ics, */*',
          'User-Agent': 'EverittOS-CalendarImport/1.0'
        }
      });
    } catch {
      throw Object.assign(new Error(calendarFeedErrorMessage('fetch_failed')), { code: 'fetch_failed' });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw Object.assign(new Error(calendarFeedErrorMessage('fetch_failed')), { code: 'fetch_failed' });
      }
      current = new URL(location, nextValidated.href).href;
      continue;
    }

    if (!response.ok) {
      throw Object.assign(new Error(calendarFeedErrorMessage('fetch_failed')), { code: 'fetch_failed' });
    }

    const contentType = headerString(response.headers, 'content-type');
    if (!isCalendarContentType(contentType)) {
      throw Object.assign(new Error(calendarFeedErrorMessage('not_calendar')), { code: 'not_calendar' });
    }

    const body = await readLimitedBody(response);
    return { href: nextValidated.href, body };
  }

  throw Object.assign(new Error(calendarFeedErrorMessage('unsafe_url')), { code: 'unsafe_url' });
}
