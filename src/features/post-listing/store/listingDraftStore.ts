import { create } from 'zustand';
import { ListingDraft, emptyListingDraft } from '../types/listingDraft';
import { useAuthStore } from '../../../store/authStore';
import type { OwnListingRecord } from '../../listings/types/myListingsApi.types';
import type { ListingImage } from '../services/listingImageSelection';
export type ListingImageRecovery = {
  listing: OwnListingRecord;
  image: ListingImage;
  draft: ListingDraft;
  phase: 'ready' | 'uploading' | 'failed' | 'unknown' | 'uploaded';
  imageUrl?: string;
  observedImageUrl?: string | null;
};
export const useListingDraft = create<{
  imageRecovery?: ListingImageRecovery;
  recoverImage: (value?: ListingImageRecovery) => void;
  values: ListingDraft;
  dirty: boolean;
  update: (value: ListingDraft) => void;
  keep: () => void;
  discard: () => void;
}>(set => ({
  recoverImage: imageRecovery => set({ imageRecovery }),
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
  if (state.user !== previous.user || state.status !== previous.status) {
    useListingDraft.getState().recoverImage(undefined);
    useListingDraft.getState().discard();
  }
});
