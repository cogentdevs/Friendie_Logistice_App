import { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useInfiniteQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../store/authStore';
import {
  useDevelopmentStore,
  isUiPreviewActive,
} from '../../../store/developmentStore';
import { ApiError } from '../../../types/api';
import { reviewsService } from '../services/reviewsService';
import {
  getReceivedVisitorReviews,
  visitorReviewErrorMessage,
} from '../services/visitorReviewsService';
import { ReceivedReviewsPage } from '../types/visitorReview.types';

export function useDashboardVisitorReviews() {
  const focused = useIsFocused(),
    user = useAuthStore(s => s.user),
    status = useAuthStore(s => s.status);
  useDevelopmentStore(s => s.previewActive);
  const real = status === 'authenticated' && !!user;
  const demo = !real && isUiPreviewActive();
  const scope = real ? 'user:' + user.id : demo ? 'demo' : 'guest';
  const query = useInfiniteQuery({
    queryKey: ['reviews.received', scope, 'dashboard'],
    enabled: focused && (real || demo),
    initialPageParam: 1,
    staleTime: 30000,
    retry: false,
    queryFn: async ({ pageParam, signal }): Promise<ReceivedReviewsPage> => {
      if (!demo) return getReceivedVisitorReviews(pageParam, signal);
      // Preserve the existing local empty demo feed; no private HTTP or fake token.
      await reviewsService.received('demo', pageParam, signal);
      return {
        items: [],
        nextPage: null,
        pagination: {
          current_page: pageParam,
          per_page: 20,
          total: 0,
          last_page: 1,
        },
      };
    },
    getNextPageParam: (last, pages) =>
      last.nextPage !== null &&
      !pages.some(page => page.pagination.current_page === last.nextPage)
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
  const retryFlight = useRef<ReturnType<typeof query.refetch> | null>(null);
  const refetch = () => {
    if (retryFlight.current) return retryFlight.current;
    const request = query
      .refetch({ cancelRefetch: false })
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
            text1: 'Visitor Review unavailable',
            text2: visitorReviewErrorMessage(result.error),
          });
        return result;
      })
      .finally(() => {
        retryFlight.current = null;
      });
    retryFlight.current = request;
    return request;
  };
  return { ...query, refetch };
}
