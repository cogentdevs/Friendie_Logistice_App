import {
  currentReviewOwner,
  reviewsService,
} from '../../reviews/services/reviewsService';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { getMyListings } from '../../listings/services/myListingsService';
import {
  dashboardCountSchema,
  VisitorReviewData,
} from '../types/dashboard.types';
export function dashboardIsDemo() {
  return (
    isUiPreviewActive() && useAuthStore.getState().status !== 'authenticated'
  );
}
function authorize() {
  if (!dashboardIsDemo() && useAuthStore.getState().status !== 'authenticated')
    throw new ApiError('Sign in to view your dashboard.', 'unauthorized', 401);
}
export const dashboardService = {
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
      records: page.items
        .slice(0, 3)
        .map(item => ({
          id: String(item.id),
          text: item.comment?.trim() || 'No written feedback.',
        })),
    };
  },
};
