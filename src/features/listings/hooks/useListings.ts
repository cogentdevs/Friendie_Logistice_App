import { isListingDemoMode } from '../development/demoListings';
import { ApiError } from '../../../types/api';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getListings } from '../services/listingsService';
import { useSearchStore } from '../../search/store/searchStore';
import { useLocationStore } from '../../location/store/locationStore';
import { useBrowseFiltersStore } from '../store/browseFiltersStore';
import { useEffect } from 'react';
export function useListings(enabled = true, browse = false) {
  const demo = isListingDemoMode();
  const searchFilters = useSearchStore(state => state.filters);
  const searchLocation = useLocationStore(state => state.selection);
  const browseFilters = useBrowseFiltersStore(state => state.filters);
  const browseLocation = useBrowseFiltersStore(state => state.location);
  const filters = browse ? browseFilters : searchFilters;
  const location = browse ? browseLocation : searchLocation;
  const query = useInfiniteQuery({
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
  // The tiny local catalogue can fit its first page without producing a useful
  // scroll event. Load its remaining pages proactively; real API search keeps
  // the existing demand-driven pagination.
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;
  useEffect(() => {
    if (
      enabled &&
      browse &&
      demo &&
      hasNextPage &&
      !isFetching &&
      !isError
    )
      fetchNextPage({ cancelRefetch: false }).catch(() => {});
  }, [
    enabled,
    browse,
    demo,
    hasNextPage,
    isFetching,
    isError,
    fetchNextPage,
  ]);
  return query;
}
