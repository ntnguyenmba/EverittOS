const DEFAULT_MAX_DIMENSION = 1920;
const DEFAULT_JPEG_QUALITY = 0.85;
const MAX_BYTES_BEFORE_COMPRESS = 400_000;

/**
 * Compress large images in the browser before upload (JPEG/WebP output).
 * Skips small files and non-image types.
 */
export async function compressImageFile(
  file: File,
  maxDimension = DEFAULT_MAX_DIMENSION,
  quality = DEFAULT_JPEG_QUALITY
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= MAX_BYTES_BEFORE_COMPRESS && !file.type.includes('heic') && !file.type.includes('heif')) {
    return file;
  }

  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
