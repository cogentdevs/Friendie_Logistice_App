import { useIsFocused } from '@react-navigation/native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import {
  isUiPreviewActive,
  useDevelopmentStore,
} from '../../../store/developmentStore';
import { ApiError } from '../../../types/api';
import { getMyListings } from '../services/myListingsService';
import { useMyListingsTabs } from '../store/myListingsStore';
export function useMyListings() {
  const focused = useIsFocused(),
    preview = useDevelopmentStore(state => state.previewActive),
    owner = useAuthStore(state => state.user?.id),
    auth = useAuthStore(state => state.status);
  const demo = preview && isUiPreviewActive(),
    scope = demo
      ? 'demo'
      : auth === 'authenticated' && owner
      ? 'user:' + owner
      : 'guest';
  const status = useMyListingsTabs(state => state.tabs[scope] ?? 'active');
  const query = useInfiniteQuery({
    queryKey: ['myListings', scope, status],
    enabled: focused,
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
  return {
    query,
    status,
    demo,
    select: (value: typeof status) =>
      useMyListingsTabs.getState().select(scope, value),
  };
}
