import {
  launchCamera,
  launchImageLibrary,
  Asset,
} from 'react-native-image-picker';
import { Image } from 'react-native';
export type AvatarDraft = {
  uri: string;
  type: 'image/jpeg' | 'image/png' | 'image/webp';
  fileSize?: number;
  fileName?: string;
  width?: number;
  height?: number;
};
// Verified CustomerController::uploadAvatar; unknown provider sizes are validated by Laravel.
export const previewAvatarMaxBytes = 2 * 1024 * 1024;
export function validateAvatar(asset: Asset): AvatarDraft {
  if (
    !asset.uri ||
    !/^(file|content):\/\/.+/.test(asset.uri) ||
    /[\r\n\0]/.test(asset.uri) ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(asset.type ?? '')
  )
    throw new Error('Choose a local JPEG, PNG or WebP image.');
  if (
    Number.isFinite(asset.fileSize) &&
    asset.fileSize! > previewAvatarMaxBytes
  )
    throw new Error('Choose a JPEG, PNG or WebP image up to 2 MB.');
  for (const dimension of [asset.width, asset.height]) {
    if (
      dimension != null &&
      (!Number.isFinite(dimension) || dimension < 1 || dimension > 2048)
    )
      throw new Error('Choose an image no larger than 2048 by 2048 pixels.');
  }
  return {
    uri: asset.uri,
    type: asset.type as AvatarDraft['type'],
    fileSize:
      Number.isFinite(asset.fileSize) && asset.fileSize! > 0
        ? asset.fileSize
        : undefined,
    fileName: asset.fileName,
    width: asset.width,
    height: asset.height,
  };
}
export class PhotoPermissionError extends Error {}
export async function chooseProfilePhoto(
  source: 'camera' | 'gallery',
): Promise<AvatarDraft | undefined> {
  const options = {
    mediaType: 'photo' as const,
    includeBase64: false,
    includeExtra: false,
    saveToPhotos: false,
    maxWidth: 2048,
    maxHeight: 2048,
  };
  const response = await (source === 'camera'
    ? launchCamera(options)
    : launchImageLibrary({ ...options, selectionLimit: 1 })
  ).catch(() => {
    throw new Error('Could not open the photo picker. Please try again.');
  });
  if (response.didCancel) return undefined;
  if (response.errorCode === 'permission')
    throw new PhotoPermissionError(
      'Photo access is denied. Enable access in device Settings, then try again.',
    );
  if (response.errorCode === 'camera_unavailable')
    throw new Error(
      'The camera is unavailable. Choose a photo from the library instead.',
    );
  if (response.errorCode || !response.assets?.[0])
    throw new Error('Could not select a photo. Please try again.');
  const selected = validateAvatar(response.assets[0]);
  // Decode through RN's image loader; retain content:// URIs unchanged.
  const dimensions = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      Image.getSize(
        selected.uri,
        (width, height) => resolve({ width, height }),
        () =>
          reject(
            new Error(
              'The selected image could not be opened. Please choose another photo.',
            ),
          ),
      );
    },
  );
  return validateAvatar({ ...selected, ...dimensions });
}
