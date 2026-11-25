import { z } from 'zod';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import {
  ownListingApiSchema,
  OwnListingRecord,
} from '../types/myListingsApi.types';
import type { ListingDetail } from './listingDetailsService';

const responseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: ownListingApiSchema,
});
export type OwnListingDetail = Omit<
  ListingDetail,
  'price' | 'currency' | 'status'
> & {
  price: number | null;
  currency: string | null;
  status: 'pending' | 'active' | 'expired';
  backend: OwnListingRecord;
};

let ownedRecords = new WeakMap<object, object>();
useAuthStore.subscribe((state, previous) => {
  if (state.user !== previous.user || state.status !== previous.status)
    ownedRecords = new WeakMap();
});
export function isVerifiedOwnedListing(record: OwnListingRecord) {
  const user = useAuthStore.getState().user;
  return (
    !!user &&
    useAuthStore.getState().status === 'authenticated' &&
    ownedRecords.get(record) === user
  );
}
// The server scopes this read to created_by = the authenticated customer.
export async function getOwnListingDetails(
  id: string,
  signal?: AbortSignal,
): Promise<OwnListingDetail> {
  const session = useAuthStore.getState();
  if (session.status !== 'authenticated' || !session.user)
    throw new ApiError('Sign in to view your listing.', 'unauthorized', 401);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
    throw new ApiError('Invalid listing.', 'not-found', 404);
  const current = () =>
    useAuthStore.getState().status === 'authenticated' &&
    useAuthStore.getState().user === session.user;
  const check = () => {
    if (signal?.aborted || !current())
      throw new ApiError('Listing request cancelled.', 'cancelled');
  };
  check();
  const token = await secureStorage.getToken();
  check();
  if (!token || !/^\S+$/.test(token)) {
    const removed = await secureStorage.removeTokenIfCurrent(token, current);
    check();
    if (!removed) throw new ApiError('Listing session changed.', 'cancelled');
    useAuthStore.getState().clear();
    throw new ApiError('Please sign in again.', 'unauthorized', 401);
  }
  const response = await apiClient.get<unknown>(
    `${endpoints.myListings}/${encodeURIComponent(id)}`,
    { signal, headers: { Authorization: `Bearer ${token}` } },
  );
  check();
  if ((await secureStorage.getToken()) !== token)
    throw new ApiError('Listing session changed.', 'cancelled');
  check();
  const parsed = responseSchema.safeParse(response.data);
  if (
    response.status !== 200 ||
    !parsed.success ||
    String(parsed.data.data.id) !== id
  )
    throw new ApiError(
      'Unable to read your listing. Please try again.',
      'unknown',
    );
  const row = parsed.data.data;
  ownedRecords.set(row, session.user);
  return {
    id: row.id,
    availability: row.availability,
    requestEligibility: row.request_eligibility,
    ownerId: session.user.id,
    status:
      row.status === 0 ? 'pending' : row.status === 1 ? 'active' : 'expired',
    type: row.ad_type === 'Carring' ? 'carry' : 'send',
    title: row.title ?? '',
    origin: row.from_area?.trim() || 'Location unavailable',
    destination: row.to_area?.trim() || 'Location unavailable',
    category: '',
    departureDate: row.departure_on ?? '',
    price: row.weight_price,
    currency: row.currency,
    coverImageUrl: row.image_url,
    ...(row.weight == null
      ? {}
      : { weight: { value: row.weight, unit: 'kg' as const } }),
    backend: row,
  };
}
