import { create } from 'zustand';
import { MyListingStatus } from '../services/myListingsService';
import { useAuthStore } from '../../../store/authStore';
export const useMyListingsTabs = create<{
  tabs: Record<string, MyListingStatus>;
  select: (owner: string, status: MyListingStatus) => void;
  clear: () => void;
}>(set => ({
  tabs: {},
  select: (owner, status) =>
    set(state => ({ tabs: { ...state.tabs, [owner]: status } })),
  clear: () => set({ tabs: {} }),
}));
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id)
    useMyListingsTabs.getState().clear();
});
