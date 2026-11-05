import { z } from 'zod';
import { listingSchema } from './listingsService';
import { appConfig } from '../../../constants/appConfig';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { demoMyListings } from '../development/demoMyListings';
export const ownStatusSchema = z.enum(['active', 'completed', 'expired']);
export type MyListingStatus = z.infer<typeof ownStatusSchema>;
export const myListingSchema = listingSchema.extend({
  ownerId: z.number().int().positive(),
  status: ownStatusSchema,
  weight: z
    .object({
      value: z.number().finite().nonnegative(),
      unit: z.enum(['kg', 'g', 'lb']),
    })
    .optional(),
});
export type MyListing = z.infer<typeof myListingSchema>;
const count = z.number().int().nonnegative();
const responseSchema = z.object({
  data: z.array(myListingSchema),
  meta: z.object({
    current_page: z.number().int().positive(),
    last_page: z.number().int().nonnegative(),
    total: count.optional(),
    counts: z
      .object({
        active: count.optional(),
        completed: count.optional(),
        expired: count.optional(),
      })
      .optional(),
  }),
});
export type MyListingsPage = z.infer<typeof responseSchema>;
export async function getMyListings(
  status: MyListingStatus,
  page: number,
  signal?: AbortSignal,
): Promise<MyListingsPage> {
  ownStatusSchema.parse(status);
  z.number().int().positive().parse(page);
  if (isUiPreviewActive()) {
    const all = demoMyListings.map(item => myListingSchema.parse(item));
    const rows = all.filter(item => item.status === status),
      size = 10;
    return {
      data: rows.slice((page - 1) * size, page * size),
      meta: {
        current_page: page,
        last_page: Math.max(1, Math.ceil(rows.length / size)),
        total: rows.length,
        counts: {
          active: all.filter(item => item.status === 'active').length,
          completed: all.filter(item => item.status === 'completed').length,
          expired: all.filter(item => item.status === 'expired').length,
        },
      },
    };
  }
  const account = useAuthStore.getState();
  const owner =
    account.status === 'authenticated' ? account.user?.id : undefined;
  if (!owner)
    throw new ApiError('Sign in to view your listings.', 'unauthorized', 401);
  if (!appConfig.apiBaseUrl || !appConfig.myListingsApiVerified)
    throw new ApiError(
      'Your listings are currently unavailable. Please try again later.',
      'unknown',
    );
  // Proposed authenticated route, independently gated until Laravel verifies owner scoping.
  const { data } = await apiClient.get(endpoints.myListings, {
    signal,
    params: { status, page },
  });
  if (
    useAuthStore.getState().status !== 'authenticated' ||
    useAuthStore.getState().user?.id !== owner
  )
    throw new ApiError('Please sign in again.', 'unauthorized', 401);
  const result = responseSchema.parse(data);
  if (result.data.some(item => item.ownerId !== owner))
    throw new ApiError('Unable to access these listings.', 'forbidden', 403);
  if (result.data.some(item => item.status !== status))
    throw new ApiError(
      'Unable to confirm the selected listing status.',
      'unknown',
    );
  return result;
}
