import { Camera, CameraResultType, CameraSource, type GalleryPhoto } from '@capacitor/camera';
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

function extensionForMime(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic';
  return 'jpg';
}

async function galleryPhotoToFile(photo: GalleryPhoto, index: number): Promise<File | null> {
  if (!photo.webPath) return null;
  const response = await fetch(photo.webPath);
  if (!response.ok) return null;
  const blob = await response.blob();
  const mime = blob.type || photo.format || 'image/jpeg';
  const extension = extensionForMime(mime);
  return new File([blob], `job-photo-${Date.now()}-${index + 1}.${extension}`, { type: mime });
}

async function requestSourcePermission(source: CameraSource): Promise<PhotoPickResult | null> {
  const permissionName = source === CameraSource.Camera ? 'camera' : 'photos';

  try {
    const current = await Camera.checkPermissions();
    const currentState = current[permissionName];
    if (currentState === 'granted' || currentState === 'limited') return null;

    const requested = await Camera.requestPermissions({ permissions: [permissionName] });
    const requestedState = requested[permissionName];
    if (requestedState === 'granted' || requestedState === 'limited') return null;

    return {
      ok: false,
      error:
        source === CameraSource.Camera
          ? 'Camera access is off. Open device Settings, allow Camera access for EverittOS, then try again.'
          : 'Photo access is off. Open device Settings, allow Photos access for EverittOS, then try again.',
      code: 'permission_denied'
    };
  } catch {
    return null;
  }
}

async function pickNativePhoto(source: CameraSource): Promise<PhotoPickResult> {
  const permissionError = await requestSourcePermission(source);
  if (permissionError) return permissionError;

  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source,
      correctOrientation: true,
      saveToGallery: false,
      promptLabelHeader: 'Add job photo',
      promptLabelPhoto: 'Choose from photos',
      promptLabelPicture: 'Take photo',
      promptLabelCancel: 'Cancel'
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
    return photoPickerError(error, source);
  }
}

function photoPickerError(error: unknown, source: CameraSource): PhotoPickResult {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('cancel') || lower.includes('dismiss')) {
    return { ok: false, error: 'Photo selection was cancelled.', code: 'cancelled' };
  }

  if (lower.includes('permission') || lower.includes('denied') || lower.includes('restricted')) {
    return {
      ok: false,
      error:
        source === CameraSource.Camera
          ? 'Camera access is off. Open device Settings, allow Camera access for EverittOS, then try again.'
          : 'Photo access is off. Open device Settings, allow Photos access for EverittOS, then try again.',
      code: 'permission_denied'
    };
  }

  return { ok: false, error: `Unable to access ${source === CameraSource.Camera ? 'the camera' : 'your photos'}.`, code: 'unsupported' };
}

async function pickNativePhotosFromLibrary(): Promise<PhotoPickResult> {
  const permissionError = await requestSourcePermission(CameraSource.Photos);
  if (permissionError) return permissionError;

  try {
    const result = await Camera.pickImages({ quality: 85 });
    if (!result.photos.length) {
      return { ok: false, error: 'Photo selection was cancelled.', code: 'cancelled' };
    }

    const files: File[] = [];
    for (let index = 0; index < result.photos.length; index += 1) {
      const file = await galleryPhotoToFile(result.photos[index], index);
      if (!file) {
        return { ok: false, error: 'Could not process one of the selected photos.', code: 'unsupported' };
      }
      const validation = validateImageUpload(file);
      if (!validation.ok) {
        return { ok: false, error: validation.error, code: 'validation' };
      }
      files.push(file);
    }

    return { ok: true, files, source: 'library' };
  } catch (error) {
    return photoPickerError(error, CameraSource.Photos);
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

  return options?.preferCamera ? pickNativePhoto(CameraSource.Camera) : pickNativePhotosFromLibrary();
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
  return pickNativePhotosFromLibrary();
}
