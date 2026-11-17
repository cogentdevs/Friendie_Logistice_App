import { Image } from 'react-native';
import { Asset, launchImageLibrary } from 'react-native-image-picker';
import { ApiError } from '../../../types/api';
export type ListingImage = {
  uri: string;
  type: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
};
export const listingImageMaxBytes = 2097152;
export function selectedListingImage(asset: Asset): ListingImage {
  const path = asset.uri || asset.originalPath || '';
  const uri = path.startsWith('/') ? 'file://' + path : path;
  if (!/^(file|content):\/\/.+/.test(uri) || /[\r\n\0]/.test(uri))
    throw new ApiError('Choose an accessible local image.', 'validation');
  return {
    uri,
    type: asset.type ?? '',
    fileName: asset.fileName,
    fileSize: asset.fileSize,
    width: asset.width,
    height: asset.height,
  };
}
export async function validateListingImage(image: ListingImage) {
  const local = selectedListingImage(image);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type))
    throw new ApiError('Choose a JPEG, PNG or WebP image.', 'validation');
  if (!Number.isFinite(image.fileSize) || image.fileSize! <= 0)
    throw new ApiError(
      'Image size is unavailable. Please select the image again.',
      'validation',
    );
  if (
    image.fileName &&
    /\.[^.]+$/.test(image.fileName) &&
    !/\.(jpe?g|png|webp)$/i.test(image.fileName)
  )
    throw new ApiError('Choose a JPEG, PNG or WebP image file.', 'validation');
  if (image.fileSize! > listingImageMaxBytes)
    throw new ApiError('Choose an image up to 2 MiB.', 'validation');
  let size: { width: number; height: number };
  try {
    size = await Image.getSize(local.uri);
  } catch {
    throw new ApiError(
      'Unable to read this image. Please select it again.',
      'validation',
    );
  }
  if (
    !size ||
    [size.width, size.height].some(
      value => !Number.isInteger(value) || value < 1 || value > 2048,
    )
  )
    throw new ApiError(
      'Image width and height must be between 1 and 2048 pixels.',
      'validation',
    );
  return { ...local, ...size };
}
export async function chooseListingImage(): Promise<ListingImage | undefined> {
  let response;
  try {
    response = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      includeBase64: false,
      includeExtra: false,
      restrictMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
  } catch {
    throw new ApiError('Unable to open the image picker.', 'validation');
  }
  if (response.didCancel) return;
  if (response.errorCode === 'permission')
    throw new ApiError(
      'Image access is denied. Check device permissions.',
      'validation',
    );
  if (response.errorCode || !response.assets?.[0])
    throw new ApiError(
      'Unable to select an image. Please try again.',
      'validation',
    );
  return selectedListingImage(response.assets[0]);
}
