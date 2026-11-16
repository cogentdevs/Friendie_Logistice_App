import { z } from 'zod';
import { listingSchema } from './listingsService';
import { getOwnListingsPage } from './myListingsApiService';
import { ownListingApiSchema } from '../types/myListingsApi.types';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { demoMyListings } from '../development/demoMyListings';
export const ownStatusSchema = z.enum(['active', 'completed', 'expired']);
export type MyListingStatus = z.infer<typeof ownStatusSchema>;
export const myListingSchema = listingSchema.extend({
  title: z.string().nullable(),
  category: z.string().nullable(),
  price: z.number().finite().nonnegative().nullable(),
  currency: z.string().nullable(),
  backend: ownListingApiSchema.optional(),
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
export class UnsupportedMyListingStatusError extends ApiError {
  constructor() {
    super(
      'Completed listings have no matching backend status. Pending listings cannot be shown as Completed.',
      'unknown',
    );
  }
}
export function myListingsErrorMessage(error: unknown) {
  if (error instanceof UnsupportedMyListingStatusError) return error.message;
  if (error instanceof ApiError) {
    if (error.kind === 'unauthorized') return 'Please sign in again.';
    if (error.kind === 'forbidden') return 'Unable to access your listings.';
    if (error.kind === 'rate-limit')
      return 'Too many attempts. Please wait before trying again.';
    if (error.kind === 'network')
      return 'Unable to connect or request timed out. Please try again.';
  }
  return 'Your listings are temporarily unavailable. Please try again.';
}
export async function getMyListings(
  status: MyListingStatus,
  page: number,
  signal?: AbortSignal,
): Promise<MyListingsPage> {
  ownStatusSchema.parse(status);
  z.number().int().positive().parse(page);
  if (
    isUiPreviewActive() &&
    useAuthStore.getState().status !== 'authenticated'
  ) {
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
  if (status === 'completed') throw new UnsupportedMyListingStatusError();
  const result = await getOwnListingsPage(
    page,
    { status: status === 'active' ? 1 : 2 },
    signal,
  );
  if (
    signal?.aborted ||
    useAuthStore.getState().status !== 'authenticated' ||
    useAuthStore.getState().user !== account.user
  )
    throw new ApiError('Listing request cancelled.', 'cancelled');
  return responseSchema.parse({
    data: result.items.map(row => ({
      id: row.id,
      ownerId: result.ownerId,
      status,
      type: row.ad_type === 'Carring' ? 'carry' : 'send',
      title: row.title,
      category: null,
      price: row.weight_price,
      currency: row.currency,
      origin: row.from_area?.trim() || 'Location unavailable',
      destination: row.to_area?.trim() || 'Location unavailable',
      departureDate: row.departure_on ?? '',
      coverImageUrl: row.image_url,
      ...(row.weight == null
        ? {}
        : {
            capacityKg: row.weight,
            weight: { value: row.weight, unit: 'kg' },
          }),
      backend: row,
    })),
    meta: {
      current_page: result.pagination.current_page,
      last_page: result.pagination.last_page,
      total: result.pagination.total,
    },
  });
}
