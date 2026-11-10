import { useAuthStore } from '../../../store/authStore';
import { getDemoListing, isListingDemoMode } from '../development/demoListings';
import { z } from 'zod';
import { listingSchema } from './listingsService';
import { appConfig } from '../../../constants/appConfig';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { ApiError } from '../../../types/api';
const httpsUrl = z
  .string()
  .url()
  .refine(value => value.startsWith('https://'));
export const listingDetailSchema = listingSchema.extend({
  ownerId: z.number().int().positive(),
  status: z.enum(['active', 'completed', 'expired', 'unavailable', 'deleted']),
  requestStatus: z
    .enum(['none', 'pending', 'accepted', 'rejected', 'cancelled'])
    .optional()
    .catch(undefined),
  coverImageUrl: httpsUrl.optional().nullable(),
  itemTypes: z.array(z.string().min(1)).optional(),
  weight: z
    .object({
      value: z.number().finite().nonnegative(),
      unit: z.enum(['kg', 'g', 'lb']),
    })
    .optional(),
  contact: z
    .object({
      phone: z.string().optional(),
      callPermitted: z.boolean().optional(),
      conversationId: z.string().min(1).optional(),
    })
    .optional(),
  shareUrl: httpsUrl.optional(),
});
export type ListingDetail = z.infer<typeof listingDetailSchema>;
// Proposed contract only. This independent gate stays false until Laravel verifies it.
export async function getListingDetails(
  id: string,
  signal?: AbortSignal,
): Promise<ListingDetail> {
  if (!/^[1-9]\d*$/.test(id))
    throw new ApiError('Invalid listing.', 'not-found', 404);
  if (isListingDemoMode()) {
    const demo = getDemoListing(id);
    if (demo) return demo;
    throw new ApiError('Demo listing not found.', 'not-found', 404);
  }
  if (!appConfig.apiBaseUrl || !appConfig.listingDetailsApiVerified)
    throw new ApiError(
      'Listing details are currently unavailable. Please try again later.',
      'unknown',
    );
  const owner =
    useAuthStore.getState().status === 'authenticated'
      ? useAuthStore.getState().user?.id
      : undefined;
  const { data } = await apiClient.get<unknown>(
    endpoints.listings + '/' + encodeURIComponent(id),
    { signal },
  );
  const result = z.object({ data: listingDetailSchema }).parse(data).data;
  if (String(result.id) !== id)
    throw new ApiError(
      'The listing response did not match this listing.',
      'unknown',
    );
  const currentOwner =
    useAuthStore.getState().status === 'authenticated'
      ? useAuthStore.getState().user?.id
      : undefined;
  if (owner !== currentOwner)
    throw new ApiError('Session changed. Reload this listing.', 'cancelled');
  if (!owner) {
    // Never publish backend contact metadata or private request state into a guest cache.
    const publicDetail = { ...result };
    delete publicDetail.contact;
    delete publicDetail.requestStatus;
    return publicDetail;
  }
  // The accepted-request/participant contact contract has not been verified.
  // Do not publish phone metadata merely because the viewer signed in.
  if (result.contact) {
    delete result.contact.phone;
    delete result.contact.callPermitted;
  }
  return result;
}
export function permittedPhone(_detail: ListingDetail): string | undefined {
  // Fail closed until Laravel provides a verified accepted-request AND participant proof.
  // Authentication and a callPermitted flag alone are insufficient.
  return undefined;
}
// Only listing availability/ownership is established by the existing detail model.
// The proposed requestStatus field has no verified current-viewer/participant semantics.
export function requestReviewUnavailableReason(
  detail: ListingDetail,
  userId?: number,
): string | undefined {
  if (detail.status !== 'active')
    return detail.status === 'expired'
      ? 'This listing has expired.'
      : detail.status === 'deleted'
      ? 'This listing has been deleted.'
      : 'This listing is unavailable.';
  if (userId === detail.ownerId) return 'You cannot request your own listing.';
  return undefined;
}
export function requestUnavailableReason(
  detail: ListingDetail,
  userId?: number,
) {
  if (detail.status === 'completed') return 'This listing is completed.';
  if (detail.status === 'deleted') return 'This listing has been deleted.';
  if (detail.status === 'expired') return 'This listing has expired.';
  if (detail.status !== 'active') return 'This listing is unavailable.';
  if (userId === detail.ownerId) return 'You cannot request your own listing.';
  if (detail.requestStatus === 'pending' || detail.requestStatus === 'accepted')
    return 'You have already requested this listing.';
  if (!userId) return 'Sign in with a real account to request this listing.';
  return 'Requests are currently unavailable. Please try again later.';
}
