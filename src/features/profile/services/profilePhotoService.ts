import {
  launchCamera,
  launchImageLibrary,
  Asset,
} from 'react-native-image-picker';
export type AvatarDraft = {
  uri: string;
  type: 'image/jpeg' | 'image/png';
  fileSize: number;
};
// Website maximum enforced locally; server limits and accepted formats still need verification.
export const previewAvatarMaxBytes = 10 * 1024 * 1024;
export function validateAvatar(asset: Asset): AvatarDraft {
  if (
    !asset.uri ||
    !/^(file|content):\/\//.test(asset.uri) ||
    !['image/jpeg', 'image/png'].includes(asset.type ?? '')
  )
    throw new Error('Choose a local JPEG or PNG image.');
  if (
    !Number.isFinite(asset.fileSize) ||
    !asset.fileSize ||
    asset.fileSize <= 0 ||
    asset.fileSize > previewAvatarMaxBytes
  )
    throw new Error('Choose a JPEG or PNG up to 10 MB with a known file size.');
  return {
    uri: asset.uri,
    type: asset.type as AvatarDraft['type'],
    fileSize: asset.fileSize,
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
  return validateAvatar(response.assets[0]);
}
