import { acquireListingImage } from './listingImageOperations';
import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import type { OwnListingRecord } from '../../listings/types/myListingsApi.types';
import { isConfirmedCreatedListing } from './createListingService';
import { ListingImage, validateListingImage } from './listingImageSelection';
const schema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    image_url: z.url().refine(value => /^https?:\/\//i.test(value)),
  }),
});
type Upload = {
  state: 'pending' | 'failed' | 'unknown' | 'uploaded';
  image: ListingImage;
};
const attempts = new WeakMap<object, Map<number, Upload>>();
useAuthStore.subscribe((state, previous) => {
  if (
    previous.user &&
    (previous.user !== state.user || state.status !== 'authenticated')
  )
    attempts.delete(previous.user);
});
export function listingImageAttempt(id: number) {
  const user = useAuthStore.getState().user;
  return user ? attempts.get(user)?.get(id) : undefined;
}
export async function uploadListingImage(
  listing: OwnListingRecord,
  image: ListingImage,
  signal?: AbortSignal,
) {
  const user = useAuthStore.getState().user;
  if (!user || useAuthStore.getState().status !== 'authenticated')
    throw new ApiError('Please sign in again.', 'unauthorized', 401);
  if (!isConfirmedCreatedListing(listing))
    throw new ApiError(
      'Use a listing confirmed by your current creation session.',
      'validation',
    );
  let entries = attempts.get(user);
  if (!entries) {
    entries = new Map();
    attempts.set(user, entries);
  }
  const prior = entries.get(listing.id);
  if (prior && prior.state !== 'failed')
    throw new ApiError(
      'Image upload is pending, completed or awaiting confirmation. Do not resubmit.',
      'validation',
    );
  const finishOperation = acquireListingImage(listing.id, 'upload');
  entries.set(listing.id, { state: 'pending', image });
  const current = () =>
    useAuthStore.getState().status === 'authenticated' &&
    useAuthStore.getState().user === user;
  const check = () => {
    if (!current() || signal?.aborted)
      throw new ApiError('Image upload cancelled.', 'cancelled');
  };
  let posted = false;
  try {
    check();
    const file = await validateListingImage(image);
    check();
    const token = await secureStorage.getToken();
    check();
    if (!token || !/^\S+$/.test(token)) {
      const removed = await secureStorage.removeTokenIfCurrent(token, current);
      check();
      if (removed) useAuthStore.getState().clear();
      throw new ApiError('Please sign in again.', 'unauthorized', 401);
    }
    const extension =
      file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
        ? 'webp'
        : 'jpg';
    const supplied = file.fileName;
    const validName =
      supplied &&
      /^[\w.-]+$/.test(supplied) &&
      (extension === 'jpg'
        ? /\.jpe?g$/i
        : new RegExp('\\.' + extension + '$', 'i')
      ).test(supplied);
    const body = new FormData();
    body.append('image', {
      uri: file.uri,
      type: file.type,
      name: validName ? supplied! : 'listing.' + extension,
    });
    posted = true;
    const response = await apiClient.post<unknown>(
      `${endpoints.myListings}/${listing.id}/image`,
      body,
      {
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    check();
    if ((await secureStorage.getToken()) !== token)
      throw new ApiError('Image session changed.', 'cancelled');
    check();
    const parsed = schema.safeParse(response.data);
    if (response.status !== 200 || !parsed.success)
      throw new ApiError('Image upload could not be confirmed.', 'unknown');
    finishOperation('release');
    entries.set(listing.id, { state: 'uploaded', image });
    return parsed.data.data.image_url;
  } catch (error) {
    const rejection =
      error instanceof ApiError &&
      [400, 401, 403, 404, 409, 413, 415, 422, 429].includes(error.status ?? 0);
    finishOperation(!posted || rejection ? 'release' : 'unknown');
    if (current())
      entries.set(listing.id, {
        state: !posted || rejection ? 'failed' : 'unknown',
        image,
      });
    throw error;
  }
}
export function listingImageErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.kind === 'validation' && !error.status) return error.message;
    if (error.status === 401) return 'Please sign in again.';
    if (error.status === 403 || error.status === 404)
      return 'This listing is not available for image upload.';
    if (error.status === 413) return 'Choose an image up to 2 MiB.';
    if (error.status === 415 || error.status === 422)
      return 'Choose a JPEG, PNG or WebP up to 2 MiB and 2048 by 2048 pixels.';
    if (error.status === 429)
      return 'Too many image attempts. Please wait before retrying.';
  }
  return 'The image could not be uploaded. Your listing remains created.';
}
