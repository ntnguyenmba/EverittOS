/** Allowed image MIME types for job photo uploads. */
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif'
]);

/** Maximum upload size after client compression (10 MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const EXECUTABLE_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'com',
  'msi',
  'scr',
  'ps1',
  'sh',
  'bash',
  'php',
  'jsp',
  'asp',
  'aspx',
  'cgi',
  'dll',
  'jar',
  'js',
  'mjs',
  'vbs',
  'wsf',
  'apk',
  'app',
  'deb',
  'rpm'
]);

const EXECUTABLE_MIME_PREFIXES = ['application/x-msdownload', 'application/x-sh', 'application/javascript'];

export type UploadValidationResult =
  | { ok: true; sanitizedBaseName: string; extension: 'jpg' | 'png' | 'webp' | 'gif' }
  | { ok: false; error: string };

function extensionFromMime(mime: string): 'jpg' | 'png' | 'webp' | 'gif' | null {
  if (mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/heic' || mime === 'image/heif') {
    return 'jpg';
  }
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return null;
}

/** Strip path segments and unsafe characters from a filename base. */
export function sanitizeUploadBaseName(rawName: string): string {
  const base = rawName.replace(/\\/g, '/').split('/').pop() || 'photo';
  const withoutExt = base.replace(/\.[^.]+$/, '');
  const cleaned = withoutExt
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || 'photo';
}

export function isExecutableUpload(file: File): boolean {
  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() || '' : '';
  if (EXECUTABLE_EXTENSIONS.has(ext)) return true;

  const mime = (file.type || '').toLowerCase();
  if (EXECUTABLE_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) return true;
  if (mime.startsWith('application/') && !ALLOWED_IMAGE_MIME_TYPES.has(mime)) return true;

  return false;
}

export function validateImageUpload(file: File): UploadValidationResult {
  if (isExecutableUpload(file)) {
    return { ok: false, error: 'This file type is not allowed. Upload JPEG, PNG, WebP, or GIF images only.' };
  }

  if (file.size <= 0) {
    return { ok: false, error: 'The selected file is empty.' };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'Each photo must be 10 MB or smaller.' };
  }

  const mime = (file.type || '').toLowerCase();
  if (!mime.startsWith('image/')) {
    return { ok: false, error: 'Only image files can be uploaded.' };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
    return { ok: false, error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' };
  }

  const extension = extensionFromMime(mime);
  if (!extension) {
    return { ok: false, error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' };
  }

  return { ok: true, sanitizedBaseName: sanitizeUploadBaseName(file.name), extension };
}

/** Build a safe storage path for Supabase (no user-supplied path segments). */
export function buildSafePhotoStoragePath(userId: string, jobId: string, extension: string): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9-]/g, '');
  const safeJobId = jobId.replace(/[^a-zA-Z0-9-]/g, '');
  const safeExt = extension.replace(/[^a-z0-9]/gi, '') || 'jpg';
  return `${safeUserId}/${safeJobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
}
