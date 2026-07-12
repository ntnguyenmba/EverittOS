import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNativePlatform } from '@/lib/platform/detect';
import { validateImageUpload } from '@/lib/upload-security';

export type PhotoPickResult =
  | { ok: true; files: File[]; source: 'camera' | 'library' | 'file-input' }
  | { ok: false; error: string; code: 'permission_denied' | 'cancelled' | 'unsupported' | 'validation' };

function dataUrlToFile(dataUrl: string, fileName: string): File | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const mime = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], fileName, { type: mime });
}

async function pickNativePhoto(source: CameraSource): Promise<PhotoPickResult> {
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source,
      correctOrientation: true,
      saveToGallery: false
    });

    if (!photo.dataUrl) {
      return { ok: false, error: 'No image was returned from the camera.', code: 'unsupported' };
    }

    const extension = photo.format === 'png' ? 'png' : 'jpg';
    const file = dataUrlToFile(photo.dataUrl, `job-photo-${Date.now()}.${extension}`);
    if (!file) {
      return { ok: false, error: 'Could not process the selected photo.', code: 'unsupported' };
    }

    const validation = validateImageUpload(file);
    if (!validation.ok) {
      return { ok: false, error: validation.error, code: 'validation' };
    }

    return {
      ok: true,
      files: [file],
      source: source === CameraSource.Camera ? 'camera' : 'library'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    if (lower.includes('cancel') || lower.includes('dismiss')) {
      return { ok: false, error: 'Photo selection was cancelled.', code: 'cancelled' };
    }

    if (lower.includes('permission') || lower.includes('denied')) {
      return {
        ok: false,
        error:
          source === CameraSource.Camera
            ? 'Camera access was denied. You can choose a photo from your library instead, or enable camera access in device settings.'
            : 'Photo library access was denied. Enable photo access in device settings to attach job photos.',
        code: 'permission_denied'
      };
    }

    return { ok: false, error: 'Unable to access the camera or photo library.', code: 'unsupported' };
  }
}

export async function pickJobPhotos(options?: {
  preferCamera?: boolean;
  inputFiles?: FileList | null;
}): Promise<PhotoPickResult> {
  if (options?.inputFiles && options.inputFiles.length > 0) {
    const files = Array.from(options.inputFiles);
    for (const file of files) {
      const validation = validateImageUpload(file);
      if (!validation.ok) {
        return { ok: false, error: validation.error, code: 'validation' };
      }
    }
    return { ok: true, files, source: 'file-input' };
  }

  if (!isNativePlatform()) {
    return { ok: false, error: 'Use the file picker to choose photos.', code: 'unsupported' };
  }

  const source = options?.preferCamera ? CameraSource.Camera : CameraSource.Photos;
  return pickNativePhoto(source);
}

export async function pickJobPhotoFromCamera(): Promise<PhotoPickResult> {
  if (!isNativePlatform()) {
    return { ok: false, error: 'Camera capture is available in the mobile app.', code: 'unsupported' };
  }
  return pickNativePhoto(CameraSource.Camera);
}

export async function pickJobPhotoFromLibrary(): Promise<PhotoPickResult> {
  if (!isNativePlatform()) {
    return { ok: false, error: 'Use the file picker to choose photos.', code: 'unsupported' };
  }
  return pickNativePhoto(CameraSource.Photos);
}
