import { isListingDemoMode } from '../development/demoListings';
import { ApiError } from '../../../types/api';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getListings } from '../services/listingsService';
import { useSearchStore } from '../../search/store/searchStore';
import { useLocationStore } from '../../location/store/locationStore';
export function useListings(enabled = true) {
  const demo = isListingDemoMode();
  const filters = useSearchStore(state => state.filters);
  const location = useLocationStore(state => state.selection);
  return useInfiniteQuery({
    enabled,
    retry: (failures, error) =>
      failures < 1 &&
      error instanceof ApiError &&
      ['network', 'server'].includes(error.kind),
    staleTime: 30000,
    queryKey: demo
      ? ['listings', filters, location, 'demo']
      : ['listings', filters, location],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      getListings(pageParam, filters, location, signal),
    getNextPageParam: (last, pages) =>
      last.meta.current_page < last.meta.last_page &&
      !pages
        .slice(0, -1)
        .some(page => page.meta.current_page === last.meta.current_page)
        ? last.meta.current_page + 1
        : undefined,
  });
}
