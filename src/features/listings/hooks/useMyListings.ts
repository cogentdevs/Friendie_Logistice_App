import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import {
  isUiPreviewActive,
  useDevelopmentStore,
} from '../../../store/developmentStore';
import { ApiError } from '../../../types/api';
import {
  getMyListings,
  myListingsErrorMessage,
} from '../services/myListingsService';
import { useMyListingsTabs } from '../store/myListingsStore';
export function useMyListings() {
  const focused = useIsFocused(),
    preview = useDevelopmentStore(state => state.previewActive),
    owner = useAuthStore(state => state.user?.id),
    user = useAuthStore(state => state.user),
    auth = useAuthStore(state => state.status);
  const demo = preview && isUiPreviewActive() && auth !== 'authenticated',
    scope = demo
      ? 'demo'
      : auth === 'authenticated' && owner
      ? 'user:' + owner
      : 'guest';
  const status = useMyListingsTabs(
    state => state.tabs[scope] ?? (demo ? 'active' : 'all'),
  );
  const query = useInfiniteQuery({
    // Real reads must not trigger legacy Dashboard metric invalidation on fetch.
    queryKey: [demo ? 'myListings' : 'myListings.read', scope, status],
    enabled: focused && scope !== 'guest',
    staleTime: 30000,
    refetchInterval: focused && !demo && auth === 'authenticated' ? 30000 : false,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      getMyListings(status, pageParam, signal),
    retry: (failures, error) =>
      failures < 1 &&
      error instanceof ApiError &&
      ['network', 'server'].includes(error.kind),
    getNextPageParam: (last, pages) =>
      last.meta.current_page < last.meta.last_page &&
      !pages
        .slice(0, -1)
        .some(page => page.meta.current_page === last.meta.current_page)
        ? last.meta.current_page + 1
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
            text1: 'My Listings unavailable',
            text2: myListingsErrorMessage(result.error),
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
    query: {
      ...query,
      refetch: () => run(false),
      fetchNextPage: () => run(true),
    },
    status,
    demo,
    select: (value: typeof status) =>
      useMyListingsTabs.getState().select(scope, value),
  };
}
