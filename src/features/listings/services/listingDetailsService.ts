import { useAuthStore } from '../../../store/authStore';
import { getPublicListingDetails } from './publicListingsService';

import { getDemoListing, isListingDemoMode } from '../development/demoListings';
import { AvailabilityFields, availabilityRequestReason } from './listingAvailability';
import { z } from 'zod';
import { listingSchema } from './listingsService';

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
  coverImageUrl: z.string().url().optional().nullable(),
  description: z.string().nullable().optional(),
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
  const user = useAuthStore.getState().user;
  const result = await getPublicListingDetails(id, signal);
  if (useAuthStore.getState().user !== user)
    throw new ApiError('Session changed. Reload this listing.', 'cancelled');
  return result;
}

export function permittedPhone(_detail: unknown): string | undefined {
  // Fail closed until Laravel provides a verified accepted-request AND participant proof.
  // Authentication and a callPermitted flag alone are insufficient.
  return undefined;
}
// Only listing availability/ownership is established by the existing detail model.
// The proposed requestStatus field has no verified current-viewer/participant semantics.
export function requestReviewUnavailableReason(
  detail: { status: string; ownerId: number } & AvailabilityFields,
  userId?: number,
): string | undefined {
  if (detail.status !== 'active')
    return detail.status === 'expired'
      ? 'This listing has expired.'
      : detail.status === 'deleted'
      ? 'This listing has been deleted.'
      : 'This listing is unavailable.';
  if (userId === detail.ownerId) return 'You cannot request your own listing.';
  return availabilityRequestReason(detail, userId);
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
