import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import {
  getOwnListingDetails,
  isVerifiedOwnedListing,
} from './ownListingDetailsService';
import { OwnListingRecord } from '../types/myListingsApi.types';
import {
  acquireListingImage,
  listingImageOperation,
} from '../../post-listing/services/listingImageOperations';
import { listingImageAttempt } from '../../post-listing/services/listingImageUploadService';
import { useListingDraft } from '../../post-listing/store/listingDraftStore';
export function isDefaultListingImage(url: string | null) {
  return !!url && /^https?:\/\//i.test(url) && /\/listing\.png$/.test(url);
}
export function hasUploadedListingImage(record: OwnListingRecord) {
  return (
    !!record.image_url &&
    /^https?:\/\//i.test(record.image_url) &&
    !isDefaultListingImage(record.image_url)
  );
}
export function canRemoveListingImage(record: OwnListingRecord) {
  const recovery = useListingDraft.getState().imageRecovery;
  const attempt = listingImageAttempt(record.id);
  const operation = listingImageOperation(record.id);
  const blocked =
    operation &&
    !(
      operation.kind === 'delete' &&
      operation.state === 'deleted' &&
      operation.imageUrl !== record.image_url
    );
  return (
    isVerifiedOwnedListing(record) &&
    hasUploadedListingImage(record) &&
    !blocked &&
    !(recovery?.listing.id === record.id) &&
    !['pending', 'unknown'].includes(attempt?.state ?? '')
  );
}
const schema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    image_url: z
      .string()
      .url()
      .refine(value => /^https?:\/\//i.test(value))
      .nullable(),
  }),
});
export async function removeListingImage(
  record: OwnListingRecord,
  signal?: AbortSignal,
) {
  if (!canRemoveListingImage(record))
    throw new ApiError(
      'Image removal is unavailable for this listing.',
      'validation',
    );
  const user = useAuthStore.getState().user,
    id = String(record.id),
    expectedImage = record.image_url;
  const finish = acquireListingImage(record.id, 'delete', expectedImage);
  const current = () =>
    useAuthStore.getState().user === user &&
    useAuthStore.getState().status === 'authenticated';
  const check = () => {
    if (!current() || signal?.aborted)
      throw new ApiError('Image session changed.', 'cancelled');
  };
  let dispatched = false;
  try {
    check();
    const latest = (await getOwnListingDetails(id, signal)).backend;
    check();
    if (latest.image_url !== expectedImage || !hasUploadedListingImage(latest))
      throw new ApiError(
        'The listing image changed. Refresh before removing it.',
        'validation',
      );
    const token = await secureStorage.getToken();
    check();
    if (!token || !/^\S+$/.test(token)) {
      const removed = await secureStorage.removeTokenIfCurrent(token, current);
      if (removed && current()) useAuthStore.getState().clear();
      throw new ApiError('Please sign in again.', 'unauthorized', 401);
    }
    dispatched = true;
    const response = await apiClient.delete<unknown>(
      `${endpoints.myListings}/${id}/image`,
      { signal, headers: { Authorization: `Bearer ${token}` } },
    );
    check();
    if ((await secureStorage.getToken()) !== token)
      throw new ApiError('Image session changed.', 'cancelled');
    check();
    const parsed = schema.safeParse(response.data);
    if (
      response.status !== 200 ||
      !parsed.success ||
      (parsed.data.data.image_url !== null &&
        !isDefaultListingImage(parsed.data.data.image_url))
    )
      throw new ApiError(
        'Image removal status could not be confirmed.',
        'unknown',
      );
    finish('deleted');
    return { imageUrl: parsed.data.data.image_url, reconciled: false };
  } catch (error) {
    const definite =
      error instanceof ApiError &&
      [400, 401, 403, 404, 409, 422, 429].includes(error.status ?? 0);
    if (!dispatched || definite) finish('release');
    else {
      finish('unknown');
      if (
        current() &&
        !signal?.aborted &&
        !(error instanceof ApiError && error.kind === 'cancelled')
      ) {
        try {
          const observed = (await getOwnListingDetails(id, signal)).backend;
          check();
          if (isDefaultListingImage(observed.image_url)) {
            finish('deleted');
            return { imageUrl: observed.image_url, reconciled: true };
          }
        } catch {
          /* Retain unknown operation; null is not proof of absence. */
        }
      }
    }
    throw error;
  }
}
