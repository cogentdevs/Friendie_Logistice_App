import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import {
  receivedReviewResponseSchema,
  ReceivedReviewsPage,
} from '../types/visitorReview.types';

export async function getReceivedVisitorReviews(
  page = 1,
  signal?: AbortSignal,
  perPage = 20,
): Promise<ReceivedReviewsPage> {
  return getReviewFeed('received', page, signal, perPage);
}
export async function getGivenReviews(
  page = 1,
  signal?: AbortSignal,
  perPage = 20,
): Promise<ReceivedReviewsPage> {
  return getReviewFeed('given', page, signal, perPage);
}
// Both verified routes use CustomerReviewController::collection/data. Keep one
// transport/session/parser implementation; the ownership check differs by feed.
async function getReviewFeed(
  source: 'received' | 'given',
  page: number,
  signal: AbortSignal | undefined,
  perPage: number,
): Promise<ReceivedReviewsPage> {
  const session = useAuthStore.getState();
  if (session.status !== 'authenticated' || !session.user)
    throw new ApiError('Sign in to view your reviews.', 'unauthorized', 401);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isInteger(perPage) ||
    perPage < 1 ||
    perPage > 50
  )
    throw new ApiError('Invalid review pagination.', 'validation');
  const current = () =>
    useAuthStore.getState().status === 'authenticated' &&
    useAuthStore.getState().user === session.user;
  const check = () => {
    if (signal?.aborted || !current())
      throw new ApiError('Review request cancelled.', 'cancelled');
  };
  check();
  const token = await secureStorage.getToken();
  check();
  if (!token || !/^\S+$/.test(token)) {
    const removed = await secureStorage.removeTokenIfCurrent(token, current);
    check();
    if (!removed) throw new ApiError('Review session changed.', 'cancelled');
    useAuthStore.getState().clear();
    throw new ApiError('Please sign in again.', 'unauthorized', 401);
  }
  const response = await apiClient.get<unknown>(
    source === 'received' ? endpoints.receivedReviews : endpoints.givenReviews,
    {
      signal,
      params: { page, per_page: perPage },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  check();
  if ((await secureStorage.getToken()) !== token)
    throw new ApiError('Review session changed.', 'cancelled');
  check();
  const parsed = receivedReviewResponseSchema.safeParse(response.data);
  if (response.status !== 200 || !parsed.success)
    throw new ApiError(
      'Unable to read received reviews. Please try again.',
      'unknown',
    );
  const result = parsed.data.data;
  if (
    result.items.some(
      item =>
        (source === 'received'
          ? item.reviewed_customer.id
          : item.reviewer.id) !== session.user!.id,
    )
  )
    throw new ApiError('Unable to access these reviews.', 'forbidden', 403);
  if (
    result.pagination.current_page !== page ||
    result.pagination.per_page !== perPage ||
    result.items.length > perPage ||
    new Set(result.items.map(item => item.id)).size !== result.items.length
  )
    throw new ApiError('Invalid review pagination.', 'unknown');
  return {
    ...result,
    nextPage:
      result.pagination.current_page < result.pagination.last_page
        ? result.pagination.current_page + 1
        : null,
  };
}
export function visitorReviewErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.kind === 'unauthorized') return 'Please sign in again.';
    if (error.kind === 'forbidden')
      return 'Unable to access your received reviews.';
    if (error.kind === 'rate-limit')
      return 'Too many attempts. Please wait before trying again.';
    if (error.kind === 'network')
      return 'Unable to connect or request timed out. Please try again.';
  }
  return 'Received reviews are temporarily unavailable. Please try again.';
}
