import type { QueryClient } from '@tanstack/react-query';
import { authService } from './authService';
import { useAuthStore } from '../../../store/authStore';
import { useDevelopmentStore } from '../../../store/developmentStore';
import { useListingBookmarks } from '../../listings/store/bookmarkStore';
import { useMyListingsTabs } from '../../listings/store/myListingsStore';
import { useChatDrafts } from '../../messages/store/chatDraftStore';
import { useListingDraft } from '../../post-listing/store/listingDraftStore';
import { useSearchStore } from '../../search/store/searchStore';
import { useFilterDraftStore } from '../../search/store/filterDraftStore';
import { useRecentSearchStore } from '../../search/store/recentSearchStore';
import { useLocationStore } from '../../location/store/locationStore';
import { clearPendingNotification } from '../../../navigation/navigationRef';
let flight: Promise<{ cacheCleared: boolean }> | undefined;
export function logoutSession(client: QueryClient) {
  if (flight) return flight;
  const operation = (async () => {
    const owner =
      useAuthStore.getState().user?.id ?? useListingBookmarks.getState().owner;
    // A query cancellation failure must not strand secure credentials.
    await client.cancelQueries().catch(() => {});
    // If Keychain removal fails this rejects and leaves authentication/navigation intact.
    await authService.logout();
    useSearchStore.getState().reset();
    useFilterDraftStore.getState().reset();
    useLocationStore.getState().useWorldwide();
    useListingDraft.getState().discard();
    useMyListingsTabs.getState().clear();
    useChatDrafts.getState().clear();
    clearPendingNotification();
    const results = await Promise.allSettled([
      useListingBookmarks.getState().clearLocal(owner),
      useRecentSearchStore.getState().clear(),
      Promise.resolve(useLocationStore.persist.clearStorage()),
    ]);
    useRecentSearchStore.setState({ items: [], ready: true });
    client.clear();
    useDevelopmentStore.getState().requestLogin();
    return {
      cacheCleared: results.every(result => result.status === 'fulfilled'),
    };
  })();
  flight = operation;
  operation
    .finally(() => {
      flight = undefined;
    })
    .catch(() => {});
  return operation;
}
