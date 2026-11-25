import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
  getNotifications,
  getNotificationCounts,
} from './notificationsService';
export function useNotificationCounts(enabled = true) {
  const client = useQueryClient();
  useEffect(
    () =>
      useAuthStore.subscribe((state, previous) => {
        if (
          previous.user &&
          (state.user !== previous.user || state.status !== previous.status)
        ) {
          const queryKey = ['notifications', previous.user.id];
          client.cancelQueries({ queryKey }).catch(() => {});
          client.removeQueries({ queryKey });
        }
      }),
    [client],
  );
  const owner = useAuthStore(state =>
    state.status === 'authenticated' ? state.user : null,
  );
  useEffect(() => {
    if (!owner || !enabled) return;
    client
      .prefetchInfiniteQuery({
        queryKey: ['notifications', owner.id, 'feed'],
        initialPageParam: 1,
        queryFn: ({ pageParam, signal }) => getNotifications(pageParam, signal),
        retry: false,
        staleTime: 30000,
        getNextPageParam: (
          page: Awaited<ReturnType<typeof getNotifications>>,
        ) =>
          page.pagination.current_page < page.pagination.last_page
            ? page.pagination.current_page + 1
            : undefined,
      })
      .catch(() => {});
  }, [client, owner, enabled]);
  return useQuery({
    queryKey: ['notifications', owner?.id, 'counts'],
    queryFn: ({ signal }) => getNotificationCounts(signal),
    enabled: enabled && !!owner,
    retry: false,
    refetchOnMount: 'always',
    refetchInterval: enabled && owner ? 30000 : false,
  });
}
