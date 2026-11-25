import { useAvailabilitySessionKey } from '../services/listingAvailability';
import { isListingDemoMode } from '../development/demoListings';
import { getDemoMyListing } from '../development/demoMyListings';
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
  const sessionKey = useAvailabilitySessionKey();
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
      : ['listingDetails', id, sessionKey],
    enabled: focused && (!ownListing || privateRead || demoOwner),
    queryFn: ({ signal }) => {
      // Private preview records must never become public API IDs when the
      // public catalogue switches to real data in every build.
      if (ownListing && demoOwner) {
        const record = getDemoMyListing(id);
        if (!record)
          throw new ApiError('Demo listing not found.', 'not-found', 404);
        return record;
      }
      return ownListing
        ? getOwnListingDetails(id, signal)
        : getListingDetails(id, signal);
    },
    structuralSharing: false,
    staleTime: 0,
    refetchInterval: focused && !demo ? 30000 : false,
    retry: (failures, error) =>
      failures < 1 &&
      error instanceof ApiError &&
      ['network', 'server'].includes(error.kind),
  });
}
