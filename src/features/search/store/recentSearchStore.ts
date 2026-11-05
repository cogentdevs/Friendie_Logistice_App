import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { RouteSearch, routeSearchSchema } from '../types/search';
const key = 'friendie.recent-searches';
export const recentSearchLimit = 10;
const envelope = z.object({
  version: z.literal(1),
  items: z.array(z.unknown()),
});
interface HistoryState {
  items: RouteSearch[];
  ready: boolean;
  hydrate: () => Promise<void>;
  add: (value: RouteSearch) => Promise<void>;
  clear: () => Promise<void>;
}
let pending: Promise<void> = Promise.resolve();
function enqueue(operation: () => Promise<void>) {
  const next = pending.catch(() => {}).then(operation);
  pending = next;
  return next;
}
export const useRecentSearchStore = create<HistoryState>((set, get) => ({
  items: [],
  ready: false,
  hydrate: () =>
    enqueue(async () => {
      const raw = await AsyncStorage.getItem(key);
      let items: RouteSearch[] = [];
      if (raw !== null) {
        try {
          const parsed = envelope.safeParse(JSON.parse(raw));
          if (parsed.success)
            items = parsed.data.items
              .flatMap(item => {
                const result = routeSearchSchema.safeParse(item);
                return result.success ? [result.data] : [];
              })
              .filter(
                (item, index, all) =>
                  all.findIndex(
                    other => JSON.stringify(other) === JSON.stringify(item),
                  ) === index,
              )
              .slice(0, recentSearchLimit);
        } catch {
          /* Malformed preferences are an empty history, not fabricated searches. */
        }
      }
      set({ items, ready: true });
    }),
  add: value =>
    enqueue(async () => {
      if (!get().ready)
        throw Error(
          'Recent searches have not loaded. Retry loading them first.',
        );
      const valid = routeSearchSchema.parse(value);
      const items = [
        valid,
        ...get().items.filter(
          item => JSON.stringify(item) !== JSON.stringify(valid),
        ),
      ].slice(0, recentSearchLimit);
      await AsyncStorage.setItem(key, JSON.stringify({ version: 1, items }));
      set({ items });
    }),
  clear: () =>
    enqueue(async () => {
      await AsyncStorage.removeItem(key);
      set({ items: [], ready: true });
    }),
}));
