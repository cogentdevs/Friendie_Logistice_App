import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { ApiError } from '../../../types/api';
import { QueryClient, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { useDevelopmentStore } from '../../../store/developmentStore';
import {
  currentReviewOwner,
  assertReviewAccess,
  reviewScope,
  reviewsService,
  validateReviewPage,
  reviewErrorMessage,
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
  const user = useAuthStore(s => s.user);
  const query = useInfiniteQuery({
    queryKey:
      tab === 'visitors'
        ? reviewKeys.received(scope)
        : reviewKeys.authored(scope),
    enabled: focused && active && owner !== 'guest',
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
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const flight = useRef<Promise<unknown> | null>(null);
  const run = (more: boolean) => {
    if (flight.current) return flight.current;
    const request = (
      more
        ? query.fetchNextPage({ cancelRefetch: false })
        : query.refetch({ cancelRefetch: false })
    )
      .then(result => {
        if (
          mounted.current &&
          useAuthStore.getState().user === user &&
          result.isError &&
          !(
            result.error instanceof ApiError &&
            result.error.kind === 'cancelled'
          )
        )
          Toast.show({
            type: 'error',
            text1: 'Reviews unavailable',
            text2: reviewErrorMessage(result.error),
          });
        return result;
      })
      .finally(() => {
        flight.current = null;
      });
    flight.current = request;
    return request;
  };
  return {
    ...query,
    refetch: (_options?: unknown) => run(false),
    fetchNextPage: (_options?: unknown) => run(true),
  };
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
