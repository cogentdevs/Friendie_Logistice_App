import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { ChatMessage, markConversationRead } from '../services/chatService';
import { InboxItem } from '../types/inbox.types';

type Attempt = {
  confirmedThrough: number;
  version: number;
  pending: boolean;
  waiters: Set<() => void>;
};
// Session identity, not merely account ID: replacement sessions cannot share evidence.
const sessions = new WeakMap<object, Map<string, Attempt>>();
useAuthStore.subscribe((state, previous) => {
  if (
    previous.user &&
    (state.user !== previous.user || state.status !== 'authenticated')
  )
    sessions.delete(previous.user);
});
export function useMarkConversationRead(
  id: string,
  enabled: boolean,
  visibleLatest: string | undefined,
  messages: ChatMessage[],
  version: number,
) {
  const client = useQueryClient();
  const user = useAuthStore(state => state.user);
  // Subscribe without creating an observer that could replace the Inbox queryFn.
  const subscribe = useCallback(
    (notify: () => void) =>
      client.getQueryCache().subscribe(event => {
        if (
          event.query.queryKey[0] === 'messages.inbox' &&
          event.query.queryKey[1] === user?.id
        )
          notify();
      }),
    [client, user?.id],
  );
  const snapshot = useCallback(() => {
    const inbox = client.getQueryData<InfiniteData<{ items: InboxItem[] }>>([
      'messages.inbox',
      user?.id ?? 'guest',
    ]);
    const pages = Array.isArray(inbox?.pages) ? inbox.pages : [];
    return (
      pages
        .flatMap(page => (Array.isArray(page?.items) ? page.items : []))
        .find(item => item && String(item.id) === id)?.unread_count ?? 0
    );
  }, [client, id, user?.id]);
  const inboxUnread = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [completed, setCompleted] = useState(0);
  useEffect(() => {
    if (
      !enabled ||
      !user ||
      !visibleLatest ||
      messages[messages.length - 1]?.id !== visibleLatest
    )
      return;
    const unread = messages.filter(
      message => message.senderId !== user.id && message.status !== 'read',
    );
    if (!unread.length && !inboxUnread) return;
    const controller = new AbortController();
    let waiting: Attempt | undefined;
    const wake = () => {
      if (!controller.signal.aborted) setCompleted(value => value + 1);
    };
    // Defer until presentation has committed; Strict Mode's discarded setup
    // cannot issue a mutation before its cleanup runs.
    const timer = setTimeout(() => {
      let rooms = sessions.get(user);
      if (!rooms) sessions.set(user, (rooms = new Map()));
      let attempt = rooms.get(id);
      if (!attempt)
        rooms.set(
          id,
          (attempt = {
            confirmedThrough: 0,
            version: -1,
            pending: false,
            waiters: new Set(),
          }),
        );
      if (attempt.pending) {
        waiting = attempt;
        attempt.waiters.add(wake);
        return;
      }
      if (
        messages.every(
          message => Number(message.id) <= attempt.confirmedThrough,
        ) ||
        attempt.version === version
      )
        return;
      attempt.version = version;
      attempt.pending = true;
      const current = () =>
        !controller.signal.aborted &&
        sessions.get(user) === rooms &&
        useAuthStore.getState().status === 'authenticated' &&
        useAuthStore.getState().user === user;
      const synchronize = async () => {
        const keys = [
          ['messages.inbox', user.id],
          ['profileDashboard', 'user:' + user.id, 'summary'],
        ];
        // Cancel older GET snapshots before making these queries stale. Inactive screens
        // refetch on their existing focus lifecycle; no guessed counter arithmetic.
        await Promise.all(
          keys.map(queryKey => client.cancelQueries({ queryKey })),
        );
        if (!current()) return;
        await Promise.all(
          keys.map(queryKey =>
            client.invalidateQueries({ queryKey, refetchType: 'active' }),
          ),
        );
      };
      markConversationRead(id, controller.signal)
        .then(async () => {
          if (!current()) return;
          // Backend marks ALL incoming unread records, including earlier pages.
          // Record only the highest actual observed ID, never an invented read time.
          attempt.confirmedThrough = Math.max(
            attempt.confirmedThrough,
            ...messages.map(message => Number(message.id)),
          );
          await synchronize();
        })
        .catch(async () => {
          // A lost acknowledgement may still have committed. Reconcile with safe GETs,
          // never retry the POST automatically or alter drafts/history/counters.
          if (current()) await synchronize();
        })
        .catch(() => {})
        .finally(() => {
          attempt.pending = false;
          attempt.waiters.forEach(notify => notify());
          attempt.waiters.clear();
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
      waiting?.waiters.delete(wake);
    };
  }, [
    client,
    enabled,
    id,
    messages,
    user,
    version,
    visibleLatest,
    completed,
    inboxUnread,
  ]);
}
