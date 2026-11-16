import {
  currentReviewOwner,
  reviewsService,
} from '../../reviews/services/reviewsService';
import { ApiError } from '../../../types/api';
import { apiClient } from '../../../services/api/apiClient';
import { endpoints } from '../../../services/api/endpoints';
import { secureStorage } from '../../../services/storage/secureStorage';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { getMyListings } from '../../listings/services/myListingsService';
import {
  dashboardCountSchema,
  dashboardResponseSchema,
  DashboardSummary,
  VisitorReviewData,
} from '../types/dashboard.types';
export function dashboardIsDemo() {
  return (
    isUiPreviewActive() && useAuthStore.getState().status !== 'authenticated'
  );
}
export function dashboardErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.kind === 'unauthorized') return 'Please sign in again.';
    if (error.kind === 'forbidden') return 'Unable to access your dashboard.';
    if (error.kind === 'rate-limit')
      return 'Too many attempts. Please wait before trying again.';
    if (error.kind === 'network')
      return 'Unable to connect or request timed out. Please try again.';
  }
  return 'Dashboard data is temporarily unavailable. Please try again.';
}
function authorize() {
  if (!dashboardIsDemo() && useAuthStore.getState().status !== 'authenticated')
    throw new ApiError('Sign in to view your dashboard.', 'unauthorized', 401);
}
export const dashboardService = {
  async summary(signal?: AbortSignal): Promise<DashboardSummary> {
    const session = useAuthStore.getState();
    if (
      session.status !== 'authenticated' ||
      !session.user ||
      dashboardIsDemo()
    )
      throw new ApiError(
        'Sign in to view your dashboard.',
        'unauthorized',
        401,
      );
    const current = () =>
      useAuthStore.getState().status === 'authenticated' &&
      useAuthStore.getState().user === session.user;
    const check = () => {
      if (signal?.aborted || !current())
        throw new ApiError('Dashboard request cancelled.', 'cancelled');
    };
    check();
    const token = await secureStorage.getToken();
    check();
    if (!token || !/^\S+$/.test(token)) {
      // Same conditional missing-credential policy as the existing Get Profile service.
      const removed = await secureStorage.removeTokenIfCurrent(token, current);
      check();
      if (!removed)
        throw new ApiError('Dashboard session changed.', 'cancelled');
      if (removed && current()) useAuthStore.getState().clear();
      throw new ApiError('Please sign in again.', 'unauthorized', 401);
    }
    const response = await apiClient.get<unknown>(endpoints.dashboard, {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    check();
    if ((await secureStorage.getToken()) !== token)
      throw new ApiError('Dashboard session changed.', 'cancelled');
    check();
    const parsed = dashboardResponseSchema.safeParse(response.data);
    if (response.status !== 200 || !parsed.success)
      throw new ApiError(
        'Unable to read dashboard data. Please try again.',
        'unknown',
      );
    return parsed.data.data;
  },
  async activeListings(signal?: AbortSignal): Promise<number | null> {
    authorize();
    const page = await getMyListings('active', 1, signal);
    const count = page.meta.counts?.active,
      total = page.meta.total;
    if (count !== undefined && total !== undefined && count !== total)
      throw new ApiError(
        'Unable to confirm the active listing count.',
        'unknown',
      );
    return dashboardCountSchema.parse(count ?? total ?? null);
  },
  async totalReviews(): Promise<number | null> {
    authorize();
    return (await reviewsService.summary(currentReviewOwner())).total;
  },
  async newMessages(): Promise<number | null> {
    authorize();
    throw new ApiError(
      'New Messages is currently unavailable. Please try again later.',
      'unknown',
    );
  },
  async visitorReview(): Promise<VisitorReviewData> {
    authorize();
    const page = await reviewsService.received(currentReviewOwner(), 1);
    return {
      records: page.items.slice(0, 3).map(item => ({
        id: String(item.id),
        text: item.comment?.trim() || 'No written feedback.',
      })),
    };
  },
};
