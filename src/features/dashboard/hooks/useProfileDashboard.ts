import { useReviewsSummary } from '../../reviews/hooks/useReviews';
import { useDashboardVisitorReviews } from '../../reviews/hooks/useDashboardVisitorReviews';
import { dashboardCountSchema } from '../types/dashboard.types';
import { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../store/authStore';
import { useDevelopmentStore } from '../../../store/developmentStore';
import {
  dashboardIsDemo,
  dashboardService,
  dashboardErrorMessage,
} from '../services/dashboardService';
import { ApiError } from '../../../types/api';
export function invalidateProfileDashboard(client: QueryClient, scope: string) {
  return client.invalidateQueries(
    { queryKey: ['profileDashboard', scope] },
    { cancelRefetch: false },
  );
}
export function useProfileDashboard() {
  const focused = useIsFocused(),
    client = useQueryClient(),
    user = useAuthStore(s => s.user),
    status = useAuthStore(s => s.status),
    owner = user?.id;
  useDevelopmentStore(s => s.previewActive);
  const demo = dashboardIsDemo(),
    real = status === 'authenticated' && !!user,
    scope = demo ? 'demo' : owner ? 'user:' + owner : 'guest';
  const options = { staleTime: 30000, retry: false as const };
  const summary = useQuery({
    ...options,
    enabled: focused && real,
    queryKey: ['profileDashboard', scope, 'summary'],
    queryFn: ({ signal }) => dashboardService.summary(signal),
  });
  // Preserve the existing local demo experience; never send demo sessions to Laravel.
  const demoActive = useQuery({
    ...options,
    enabled: focused && demo,
    queryKey: ['profileDashboard', scope, 'active'],
    queryFn: async ({ signal }) =>
      dashboardCountSchema.parse(await dashboardService.activeListings(signal)),
  });
  const demoReviews = useReviewsSummary(demo);
  const demoMessages = useQuery({
    ...options,
    enabled: focused && demo,
    queryKey: ['profileDashboard', scope, 'messages'],
    queryFn: async () =>
      dashboardCountSchema.parse(await dashboardService.newMessages()),
  });
  const active = demo
    ? demoActive
    : { ...summary, data: summary.data?.listings.published };
  const reviews = demo
    ? { ...demoReviews, data: demoReviews.data?.total }
    : { ...summary, data: summary.data?.reviews_received };
  const messages = demo
    ? demoMessages
    : { ...summary, data: summary.data?.unread_messages };
  const received = useDashboardVisitorReviews();
  const visitor = {
    ...received,
    data: received.data
      ? {
          records: received.data.pages[0].items.slice(0, 3).map(item => ({
            id: String(item.id),
            text: item.review?.trim() || 'No written feedback.',
          })),
        }
      : undefined,
  };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const retryFlight = useRef<Promise<unknown> | null>(null);
  const refreshCounts = () => {
    if (retryFlight.current) return retryFlight.current;
    const request = demo
      ? Promise.allSettled([
          demoActive.refetch(),
          demoReviews.refetch(),
          demoMessages.refetch(),
        ])
      : summary.refetch({ cancelRefetch: false }).then(result => {
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
              text1: 'Dashboard unavailable',
              text2: dashboardErrorMessage(result.error),
            });
          return result;
        });
    retryFlight.current = request.finally(() => {
      retryFlight.current = null;
    });
    return retryFlight.current;
  };
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
                queryKey: [
                  'profileDashboard',
                  scope,
                  demo ? metric : 'summary',
                ],
                refetchType: focused ? 'active' : 'none',
              },
              { cancelRefetch: false },
            )
            .catch(() => {});
      }),
    [client, scope, owner, demo, focused],
  );
  const refresh = () =>
    Promise.allSettled([refreshCounts(), visitor.refetch()]);
  return {
    active,
    reviews,
    messages,
    visitor,
    demo,
    scope,
    refresh,
    refreshCounts,
  };
}
