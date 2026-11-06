import { useIsFocused } from '@react-navigation/native';
import { QueryClient, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { useDevelopmentStore } from '../../../store/developmentStore';
import {
  currentReviewOwner,
  assertReviewAccess,
  reviewScope,
  reviewsService,
  validateReviewPage,
} from '../services/reviewsService';
import { ReviewsTab, reviewsSummarySchema } from '../types/reviews.types';
export function useReviewScope() {
  useAuthStore(s => s.user?.id);
  useAuthStore(s => s.status);
  useDevelopmentStore(s => s.previewActive);
  const owner = currentReviewOwner();
  return { owner, scope: reviewScope(owner), demo: owner === 'demo' };
}
export const reviewKeys = {
  received: (scope: string) => ['reviews.received', scope] as const,
  authored: (scope: string) => ['reviews.authored', scope] as const,
  summary: (scope: string) => ['reviews.summary', scope] as const,
};
function useReviewFeed(tab: ReviewsTab, active: boolean) {
  const focused = useIsFocused(),
    { owner, scope } = useReviewScope();
  return useInfiniteQuery({
    queryKey:
      tab === 'visitors'
        ? reviewKeys.received(scope)
        : reviewKeys.authored(scope),
    enabled: focused && active,
    initialPageParam: 1,
    staleTime: 30000,
    retry: false,
    queryFn: async ({ pageParam, signal }) =>
      validateReviewPage(
        await (tab === 'visitors'
          ? reviewsService.received
          : reviewsService.authored)(owner, pageParam, signal),
        tab,
        owner,
        pageParam,
      ),
    getNextPageParam: (last, pages) =>
      last.nextPage !== null &&
      !pages.slice(0, -1).some(page => page.nextPage === last.nextPage)
        ? last.nextPage
        : undefined,
  });
}
export function useVisitorReviews(active = true) {
  return useReviewFeed('visitors', active);
}
export function useYourReviews(active = true) {
  return useReviewFeed('your', active);
}
export function useReviewsSummary(active = true) {
  const focused = useIsFocused(),
    { owner, scope } = useReviewScope();
  return useQuery({
    queryKey: reviewKeys.summary(scope),
    enabled: focused && active,
    staleTime: 30000,
    retry: false,
    queryFn: async ({ signal }) => {
      const result = reviewsSummarySchema.parse(
        await reviewsService.summary(owner, signal),
      );
      assertReviewAccess(owner);
      return result;
    },
  });
}
export function invalidateReviews(client: QueryClient, scope: string) {
  return Promise.all([
    client.invalidateQueries({ queryKey: reviewKeys.received(scope) }),
    client.invalidateQueries({ queryKey: reviewKeys.authored(scope) }),
    client.invalidateQueries({ queryKey: reviewKeys.summary(scope) }),
  ]);
}
