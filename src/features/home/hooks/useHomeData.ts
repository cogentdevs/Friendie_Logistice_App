import { useEffect, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { ApiError } from '../../../types/api';
import {
  categoriesDataSource,
  categoriesErrorMessage,
} from '../services/categoriesService';
import { useQuery, QueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { useAuthStore } from '../../../store/authStore';
import {
  useDevelopmentStore,
  isUiPreviewActive,
} from '../../../store/developmentStore';
import { isStaticMarketplaceEnabled } from '../../listings/development/staticMarketplace';
import { useProfile } from '../../profile/hooks/useProfile';
import { homeService } from '../services/homeService';
import {
  getHome,
  HomeLocationsUnavailableError,
} from '../services/homeApiService';
import { publicHomeKey } from '../../../services/api/publicHomeCache';
const missingLocations = new HomeLocationsUnavailableError();
export function useHomeData() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const focused = useIsFocused(),
    owner = useAuthStore(s => s.user?.id);
  useDevelopmentStore(s => s.previewActive);
  const demo = isStaticMarketplaceEnabled();
  const mode = useRef({ demo, focused, generation: 0 });
  if (mode.current.demo !== demo) mode.current.generation++;
  mode.current.demo = demo;
  mode.current.focused = focused;
  const preview = isUiPreviewActive();
  const scope = demo ? 'static' : 'unavailable';
  const options = { enabled: focused, staleTime: 60000, retry: false as const };
  const home = useQuery({
    ...options,
    enabled: focused && !demo,
    queryKey: publicHomeKey,
    queryFn: ({ signal }) => getHome(signal),
  });
  const categories = useQuery({
    ...options,
    enabled: focused && demo,
    queryKey: ['home', 'categories', categoriesDataSource()],
    queryFn: ({ signal }) => homeService.categories(signal),
  });
  const categoryRetry = useRef<ReturnType<typeof categories.refetch> | null>(
    null,
  );
  const retryCategories = () => {
    if (categoryRetry.current) return categoryRetry.current;
    const generation = mode.current.generation;
    const request = categories
      .refetch({ cancelRefetch: false })
      .then(result => {
        if (
          mounted.current &&
          mode.current.demo &&
          mode.current.focused &&
          mode.current.generation === generation &&
          result.isError &&
          !(
            result.error instanceof ApiError &&
            result.error.kind === 'cancelled'
          )
        )
          Toast.show({
            type: 'error',
            text1: 'Categories unavailable',
            text2: categoriesErrorMessage(result.error),
          });
        return result;
      })
      .finally(() => {
        categoryRetry.current = null;
      });
    categoryRetry.current = request;
    return request;
  };
  const destinations = useQuery({
    ...options,
    enabled: focused && demo,
    queryKey: ['home', 'destinations', scope],
    queryFn: homeService.destinations,
  });
  const latest = useQuery({
    ...options,
    enabled: focused && demo,
    queryKey: ['home', 'latest', scope],
    queryFn: homeService.latest,
  });
  const unread = useQuery({
    ...options,
    queryKey: ['home', 'unread', owner ?? 'guest'],
    queryFn: homeService.unread,
  });
  const summary = useProfile();
  const homeRetry = useRef<ReturnType<typeof home.refetch> | null>(null);
  const retryHome = () => {
    if (homeRetry.current) return homeRetry.current;
    const generation = mode.current.generation;
    const request = home
      .refetch({ cancelRefetch: false })
      .then(result => {
        if (
          mounted.current &&
          !mode.current.demo &&
          mode.current.focused &&
          mode.current.generation === generation &&
          result.isError &&
          !(
            result.error instanceof ApiError &&
            result.error.kind === 'cancelled'
          )
        )
          Toast.show({
            type: 'error',
            text1: 'Home unavailable',
            text2: 'Unable to refresh Home. Please try again.',
          });
        return result;
      })
      .finally(() => {
        homeRetry.current = null;
      });
    homeRetry.current = request;
    return request;
  };
  const refresh = () => {
    const requests: Promise<unknown>[] = [
      ...(demo
        ? [retryCategories(), destinations.refetch(), latest.refetch()]
        : [retryHome()]),
      unread.refetch(),
      ...(demo || useAuthStore.getState().status === 'authenticated'
        ? [summary.query.refetch()]
        : []),
    ];
    return Promise.allSettled(requests);
  };
  return {
    categories: demo
      ? { ...categories, refetch: retryCategories }
      : { ...home, data: home.data?.categories, refetch: retryHome },
    destinations: demo
      ? destinations
      : {
          data: undefined,
          isPending: false,
          isError: true,
          error: missingLocations,
          refetch: async () => {},
        },
    latest: demo
      ? latest
      : { ...home, data: home.data?.latest, refetch: retryHome },
    unread,
    summary: summary.query,
    demo,
    preview,
    refresh,
  };
}
// Call from a verified publication/update mutation when such a workflow is integrated.
export function invalidateHomeListings(client: QueryClient) {
  return client.invalidateQueries({ queryKey: ['home', 'latest'] });
}
