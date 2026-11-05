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
    .optional(),
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
  return result;
}
export function permittedPhone(detail: ListingDetail): string | undefined {
  const contact = detail.contact;
  if (contact?.callPermitted !== true || !contact.phone) return;
  const phone = contact.phone.replace(/[\s()-]/g, '');
  return /^\+?[0-9]{7,15}$/.test(phone) ? phone : undefined;
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
