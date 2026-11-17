import { useIsFocused } from '@react-navigation/native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import { getInboxPage, inboxErrorMessage } from '../services/inboxService';

export function useInbox() {
  const focused = useIsFocused();
  const user = useAuthStore(state => state.user);
  const status = useAuthStore(state => state.status);
  const query = useInfiniteQuery({
    queryKey: [
      'messages.inbox',
      status === 'authenticated' ? user?.id : 'guest',
    ],
    enabled: focused && status === 'authenticated' && !!user,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => getInboxPage(pageParam, signal),
    staleTime: 30000,
    retry: false,
    getNextPageParam: (last, pages) =>
      last.items.length > 0 &&
      last.pagination.current_page < last.pagination.last_page &&
      !pages
        .slice(0, -1)
        .some(
          page => page.pagination.current_page === last.pagination.current_page,
        )
        ? last.pagination.current_page + 1
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
  const run = (more: boolean, explicit = false) => {
    if (flight.current) return flight.current;
    if (
      status !== 'authenticated' ||
      !user ||
      (more &&
        (!query.hasNextPage ||
          query.isFetching ||
          (query.isFetchNextPageError && !explicit)))
    )
      return Promise.resolve();
    const operation = (
      more
        ? query.fetchNextPage({ cancelRefetch: false })
        : query.refetch({ cancelRefetch: false })
    )
      .then(result => {
        if (
          mounted.current &&
          useAuthStore.getState().status === 'authenticated' &&
          useAuthStore.getState().user === user &&
          result.isError &&
          !(
            result.error instanceof ApiError &&
            result.error.kind === 'cancelled'
          )
        )
          Toast.show({
            type: 'error',
            text1: 'Messages unavailable',
            text2: inboxErrorMessage(result.error),
          });
        return result;
      })
      .finally(() => {
        flight.current = null;
      });
    flight.current = operation;
    return operation;
  };
  const seen = new Set<number>();
  const items =
    query.data?.pages
      .flatMap(page => page.items)
      .filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      }) ?? [];
  return {
    query,
    items,
    retry: () => run(query.isFetchNextPageError, true),
    refresh: () => run(false, true),
    loadMore: () => run(true),
  };
}
