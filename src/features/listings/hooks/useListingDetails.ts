import { isListingDemoMode } from '../development/demoListings';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import {
  getListingDetails,
  ListingDetail,
} from '../services/listingDetailsService';
import { ApiError } from '../../../types/api';
import { useAuthStore } from '../../../store/authStore';
import {
  isUiPreviewActive,
  useDevelopmentStore,
} from '../../../store/developmentStore';
import {
  getOwnListingDetails,
  OwnListingDetail,
} from '../services/ownListingDetailsService';
export function useListingDetails(id: string, ownListing = false) {
  const demo = isListingDemoMode();
  const focused = useIsFocused();
  const userId = useAuthStore(state => state.user?.id);
  const status = useAuthStore(state => state.status);
  const preview = useDevelopmentStore(state => state.previewActive);
  const demoOwner = preview && isUiPreviewActive();
  const privateRead = ownListing && status === 'authenticated';
  return useQuery<ListingDetail | OwnListingDetail>({
    queryKey: ownListing
      ? [
          'ownListingDetails',
          privateRead ? userId : demoOwner ? 'demo' : 'guest',
          id,
        ]
      : demo
      ? ['listingDetails', id, 'demo']
      : ['listingDetails', id, userId ?? 'guest'],
    enabled: focused && (!ownListing || privateRead || demoOwner),
    queryFn: ({ signal }) =>
      ownListing && !demoOwner
        ? getOwnListingDetails(id, signal)
        : getListingDetails(id, signal),
    structuralSharing: false,
    staleTime: 0,
    retry: (failures, error) =>
      failures < 1 &&
      error instanceof ApiError &&
      ['network', 'server'].includes(error.kind),
  });
}
