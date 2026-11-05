import { useDevelopmentStore } from '../../../store/developmentStore';
import { create } from 'zustand';
import { useAuthStore } from '../../../store/authStore';
export type LocalMessage = {
  clientId: string;
  body: string;
  createdAt: string;
  state: 'pending' | 'failed';
};
type Thread = { draft: string; outbox: LocalMessage[] };
const empty: Thread = { draft: '', outbox: [] };
export const threadKey = (owner: number, id: string) => owner + ':' + id;
export const useChatDrafts = create<{
  threads: Record<string, Thread>;
  draft: (key: string, text: string) => void;
  enqueue: (key: string, item: LocalMessage) => void;
  status: (key: string, id: string, state: LocalMessage['state']) => void;
  remove: (key: string, id: string) => void;
  clear: () => void;
}>(set => ({
  threads: {},
  draft: (key, text) =>
    set(state => ({
      threads: {
        ...state.threads,
        [key]: { ...(state.threads[key] ?? empty), draft: text },
      },
    })),
  enqueue: (key, item) =>
    set(state => ({
      threads: {
        ...state.threads,
        [key]: {
          ...(state.threads[key] ?? empty),
          draft: '',
          outbox: [...(state.threads[key]?.outbox ?? []), item],
        },
      },
    })),
  status: (key, id, status) =>
    set(state => ({
      threads: {
        ...state.threads,
        [key]: {
          ...(state.threads[key] ?? empty),
          outbox: (state.threads[key]?.outbox ?? []).map(item =>
            item.clientId === id ? { ...item, state: status } : item,
          ),
        },
      },
    })),
  remove: (key, id) =>
    set(state => ({
      threads: {
        ...state.threads,
        [key]: {
          ...(state.threads[key] ?? empty),
          outbox: (state.threads[key]?.outbox ?? []).filter(
            item => item.clientId !== id,
          ),
        },
      },
    })),
  clear: () => set({ threads: {} }),
}));
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id || state.status !== 'authenticated')
    useChatDrafts.getState().clear();
});
export const emptyThread = empty;

useDevelopmentStore.subscribe((state, previous) => {
  if (previous.previewActive && !state.previewActive)
    useChatDrafts.getState().clear();
});
