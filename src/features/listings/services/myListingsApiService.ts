import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import {
  ownListingFiltersSchema,
  ownListingsResponseSchema,
  OwnListingFilters,
} from '../types/myListingsApi.types';

// Read-only collection boundary. No detail or mutation endpoints are used.
export async function getOwnListingsPage(
  page = 1,
  filters: OwnListingFilters = {},
  signal?: AbortSignal,
  perPage = 20,
) {
  const session = useAuthStore.getState();
  if (session.status !== 'authenticated' || !session.user)
    throw new ApiError('Sign in to view your listings.', 'unauthorized', 401);
  const parsedFilters = ownListingFiltersSchema.safeParse(filters);
  if (
    !parsedFilters.success ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isInteger(perPage) ||
    perPage < 1 ||
    perPage > 50
  )
    throw new ApiError('Invalid listing filters or pagination.', 'validation');
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
  const response = await apiClient.get<unknown>(endpoints.myListings, {
    signal,
    params: { page, per_page: perPage, ...parsedFilters.data },
    headers: { Authorization: `Bearer ${token}` },
  });
  check();
  if ((await secureStorage.getToken()) !== token)
    throw new ApiError('Listing session changed.', 'cancelled');
  check();
  const parsed = ownListingsResponseSchema.safeParse(response.data);
  if (response.status !== 200 || !parsed.success)
    throw new ApiError(
      'Unable to read your listings. Please try again.',
      'unknown',
    );
  const result = parsed.data.data;
  if (
    result.pagination.current_page !== page ||
    result.pagination.per_page !== perPage ||
    result.items.length > perPage ||
    new Set(result.items.map(item => item.id)).size !== result.items.length
  )
    throw new ApiError('Invalid listing pagination.', 'unknown');
  if (
    parsedFilters.data.status !== undefined &&
    result.items.some(item => item.status !== parsedFilters.data.status)
  )
    throw new ApiError(
      'Unable to confirm the selected listing status.',
      'unknown',
    );
  if (
    parsedFilters.data.ad_type &&
    result.items.some(item => item.ad_type !== parsedFilters.data.ad_type)
  )
    throw new ApiError(
      'Unable to confirm the selected listing type.',
      'unknown',
    );
  return { ...result, ownerId: session.user.id };
}
