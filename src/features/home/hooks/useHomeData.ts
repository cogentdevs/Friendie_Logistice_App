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
  const preview = isUiPreviewActive();
  const scope = demo ? 'static' : 'unavailable';
  const options = { enabled: focused, staleTime: 60000, retry: false as const };
  const categories = useQuery({
    ...options,
    queryKey: ['home', 'categories', categoriesDataSource()],
    queryFn: ({ signal }) => homeService.categories(signal),
  });
  const categoryRetry = useRef<ReturnType<typeof categories.refetch> | null>(
    null,
  );
  const retryCategories = () => {
    if (categoryRetry.current) return categoryRetry.current;
    const request = categories
      .refetch({ cancelRefetch: false })
      .then(result => {
        if (
          mounted.current &&
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
    queryKey: ['home', 'destinations', scope],
    queryFn: homeService.destinations,
  });
  const latest = useQuery({
    ...options,
    queryKey: ['home', 'latest', scope],
    queryFn: homeService.latest,
  });
  const unread = useQuery({
    ...options,
    queryKey: ['home', 'unread', owner ?? 'guest'],
    queryFn: homeService.unread,
  });
  const summary = useProfile();
  const refresh = () =>
    Promise.allSettled([
      retryCategories(),
      destinations.refetch(),
      latest.refetch(),
      unread.refetch(),
      summary.query.refetch(),
    ]);
  return {
    categories: { ...categories, refetch: retryCategories },
    destinations,
    latest,
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
