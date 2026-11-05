import { useDevelopmentStore } from '../../../store/developmentStore';
import { isListingDemoMode } from '../development/demoListings';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { getListingDetails } from '../services/listingDetailsService';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
export function useListingDetails(id: string) {
  const preview = useDevelopmentStore(state => state.previewActive);
  const demo = preview && isListingDemoMode();
  const focused = useIsFocused();
  const userId = useAuthStore(state => state.user?.id);
  return useQuery({
    queryKey: demo
      ? ['listingDetails', id, 'demo']
      : ['listingDetails', id, userId ?? 'guest'],
    enabled: focused,
    queryFn: ({ signal }) => getListingDetails(id, signal),
    staleTime: 0,
    retry: (failures, error) =>
      failures < 1 &&
      error instanceof ApiError &&
      ['network', 'server'].includes(error.kind),
  });
}
