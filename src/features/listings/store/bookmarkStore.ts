import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { useAuthStore } from '../../../store/authStore';
let queue = Promise.resolve();
let loading: { owner: number; promise: Promise<void> } | undefined;
export const useListingBookmarks = create<{
  clearLocal: (owner?: number) => Promise<void>;
  ids: number[];
  owner?: number;
  load: () => Promise<void>;
  toggle: (id: number) => Promise<void>;
}>((set, get) => ({
  clearLocal: async owner => {
    await queue.catch(() => {});
    if (loading) await loading.promise.catch(() => {});
    try {
      if (owner) await AsyncStorage.removeItem('friendie.bookmarks.' + owner);
    } finally {
      set({ ids: [], owner: undefined });
    }
  },
  ids: [],
  load: async () => {
    const owner = useAuthStore.getState().user?.id;
    if (!owner) {
      set({ ids: [], owner: undefined });
      return;
    }
    if (get().owner === owner) return;
    if (loading?.owner === owner) return loading.promise;
    set({ ids: [], owner: undefined });
    const promise = (async () => {
      const raw = await AsyncStorage.getItem('friendie.bookmarks.' + owner);
      let parsed: unknown;
      try {
        parsed = raw ? JSON.parse(raw) : [];
      } catch {
        parsed = [];
      }
      const ids = Array.isArray(parsed)
        ? parsed.filter(id => Number.isInteger(id) && id > 0)
        : [];
      if (useAuthStore.getState().user?.id === owner)
        set({ ids: [...new Set<number>(ids)], owner });
    })();
    loading = { owner, promise };
    try {
      await promise;
    } finally {
      if (loading?.promise === promise) loading = undefined;
    }
  },
  toggle: id => {
    const requestedOwner = useAuthStore.getState().user?.id;
    const operation = queue
      .catch(() => {})
      .then(async () => {
        if (
          !requestedOwner ||
          useAuthStore.getState().status !== 'authenticated' ||
          useAuthStore.getState().user?.id !== requestedOwner
        )
          throw Error('Sign in to save listings.');
        await get().load();
        const owner = get().owner;
        if (owner !== requestedOwner)
          throw Error('Account changed. Please try again.');
        const ids = get().ids.includes(id)
          ? get().ids.filter(value => value !== id)
          : [...get().ids, id];
        await AsyncStorage.setItem(
          'friendie.bookmarks.' + owner,
          JSON.stringify(ids),
        );
        if (useAuthStore.getState().user?.id === owner) set({ ids });
      });
    queue = operation;
    return operation;
  },
}));
