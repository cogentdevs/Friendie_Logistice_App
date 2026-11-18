import { create } from 'zustand';
import { useListingDraft } from './listingDraftStore';
import { useAuthStore } from '../../../store/authStore';
import { emptyListingDraft } from '../types/listingDraft';
// Separate edit memory; never replace a creation draft or image recovery.
export const useEditListingDraft = create<
  ReturnType<typeof useListingDraft.getState> & { listingId?: string }
>(set => ({
  values: emptyListingDraft(),
  dirty: false,
  recoverImage: () => {},
  update: values => set({ values, dirty: true }),
  keep: () => set({ dirty: false }),
  discard: () =>
    set({ values: emptyListingDraft(), dirty: false, listingId: undefined }),
}));
useAuthStore.subscribe((state, previous) => {
  if (state.user !== previous.user || state.status !== previous.status)
    useEditListingDraft.getState().discard();
});
