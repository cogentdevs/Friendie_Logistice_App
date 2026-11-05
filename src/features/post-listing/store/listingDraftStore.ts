import { create } from 'zustand';
import { ListingDraft, emptyListingDraft } from '../types/listingDraft';
import { useAuthStore } from '../../../store/authStore';
export const useListingDraft = create<{
  values: ListingDraft;
  dirty: boolean;
  update: (value: ListingDraft) => void;
  keep: () => void;
  discard: () => void;
}>(set => ({
  values: emptyListingDraft(),
  dirty: false,
  update: values =>
    set(state =>
      JSON.stringify(values) === JSON.stringify(state.values)
        ? state
        : { values, dirty: true },
    ),
  keep: () => set({ dirty: false }),
  discard: () => set({ values: emptyListingDraft(), dirty: false }),
}));
// Memory-only draft; never merge another account's in-progress listing.
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id)
    useListingDraft.getState().discard();
});
