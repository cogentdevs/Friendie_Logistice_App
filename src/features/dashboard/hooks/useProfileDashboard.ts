import {
  useVisitorReviews,
  useReviewsSummary,
} from '../../reviews/hooks/useReviews';
import { dashboardCountSchema } from '../types/dashboard.types';
import { useCallback, useEffect } from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { useDevelopmentStore } from '../../../store/developmentStore';
import {
  dashboardIsDemo,
  dashboardService,
} from '../services/dashboardService';
export function invalidateProfileDashboard(client: QueryClient, scope: string) {
  return client.invalidateQueries(
    { queryKey: ['profileDashboard', scope] },
    { cancelRefetch: false },
  );
}
export function useProfileDashboard() {
  const focused = useIsFocused(),
    client = useQueryClient(),
    owner = useAuthStore(s => s.user?.id);
  useDevelopmentStore(s => s.previewActive);
  const demo = dashboardIsDemo(),
    scope = demo ? 'demo' : owner ? 'user:' + owner : 'guest';
  const options = { enabled: focused, staleTime: 30000, retry: false as const };
  const active = useQuery({
    ...options,
    queryKey: ['profileDashboard', scope, 'active'],
    queryFn: async ({ signal }) =>
      dashboardCountSchema.parse(await dashboardService.activeListings(signal)),
  });
  const reviewSummary = useReviewsSummary();
  const reviews = { ...reviewSummary, data: reviewSummary.data?.total };
  const messages = useQuery({
    ...options,
    queryKey: ['profileDashboard', scope, 'messages'],
    queryFn: async () =>
      dashboardCountSchema.parse(await dashboardService.newMessages()),
  });
  const received = useVisitorReviews();
  const visitor = {
    ...received,
    data: received.data
      ? {
          records: received.data.pages[0].items
            .slice(0, 3)
            .map(item => ({
              id: String(item.id),
              text: item.comment?.trim() || 'No written feedback.',
            })),
        }
      : undefined,
  };
  useFocusEffect(
    useCallback(() => {
      invalidateProfileDashboard(client, scope).catch(() => {});
    }, [client, scope]),
  );
  useEffect(
    () =>
      client.getQueryCache().subscribe(event => {
        if (
          event.type !== 'updated' ||
          !['success', 'invalidate'].includes(event.action.type)
        )
          return;
        const key = event.query.queryKey;
        let metric: string | undefined;
        if (key[0] === 'myListings' && key[1] === scope) metric = 'active';
        if (
          (key[0] === 'messages' || key[0] === 'conversation') &&
          key[1] === (demo ? 'demo' : owner)
        )
          metric = 'messages';
        if (
          (key[0] === 'myReviews' || key[0] === 'reviews') &&
          key[1] === owner
        )
          metric = 'reviews';
        if (key[0] === 'visitorReviews' && key[1] === owner) metric = 'visitor';
        if (metric)
          client
            .invalidateQueries(
              {
                queryKey: ['profileDashboard', scope, metric],
                refetchType: focused ? 'active' : 'none',
              },
              { cancelRefetch: false },
            )
            .catch(() => {});
      }),
    [client, scope, owner, demo, focused],
  );
  const refresh = () =>
    Promise.allSettled([
      active.refetch(),
      reviews.refetch(),
      messages.refetch(),
      visitor.refetch(),
    ]);
  return { active, reviews, messages, visitor, demo, scope, refresh };
}
