import { useQuery, QueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { useAuthStore } from '../../../store/authStore';
import { useDevelopmentStore } from '../../../store/developmentStore';
import { isListingDemoMode } from '../../listings/development/demoListings';
import { useProfile } from '../../profile/hooks/useProfile';
import { homeService } from '../services/homeService';
export function useHomeData() {
  const focused = useIsFocused(),
    owner = useAuthStore(s => s.user?.id);
  useDevelopmentStore(s => s.previewActive);
  const demo = isListingDemoMode(),
    scope = demo ? 'demo' : owner ?? 'guest';
  const options = { enabled: focused, staleTime: 60000, retry: false as const };
  const categories = useQuery({
    ...options,
    queryKey: ['home', 'categories', scope],
    queryFn: homeService.categories,
  });
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
    queryKey: ['home', 'unread', scope],
    queryFn: homeService.unread,
  });
  const summary = useProfile();
  const refresh = () =>
    Promise.allSettled([
      categories.refetch(),
      destinations.refetch(),
      latest.refetch(),
      unread.refetch(),
      summary.query.refetch(),
    ]);
  return {
    categories,
    destinations,
    latest,
    unread,
    summary: summary.query,
    demo,
    refresh,
  };
}
// Call from a verified publication/update mutation when such a workflow is integrated.
export function invalidateHomeListings(client: QueryClient) {
  return client.invalidateQueries({ queryKey: ['home', 'latest'] });
}
