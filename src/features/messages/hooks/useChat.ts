import {
  isUiPreviewActive,
  useDevelopmentStore,
} from '../../../store/developmentStore';
import { chatOwnerId } from '../development/demoChat';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { ApiError } from '../../../types/api';
import {
  chatSendConfigured,
  getConversation,
  getMessages,
  sendMessage,
  ChatMessage,
} from '../services/chatService';
import {
  emptyThread,
  LocalMessage,
  threadKey,
  useChatDrafts,
} from '../store/chatDraftStore';
const inFlight = new Map<string, Promise<void>>();
let sequence = 0;
type Page = Awaited<ReturnType<typeof getMessages>>;
export function orderedMessages(pages: Page[]) {
  const seen = new Set<string>();
  return pages
    .flatMap(page => page.data)
    .filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort(
      (a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}
export function useChat(id: string) {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', value =>
      setActive(value === 'active'),
    );
    return () => sub.remove();
  }, []);
  const user = useAuthStore(state => state.user),
    status = useAuthStore(state => state.status);
  const previewActive = useDevelopmentStore(state => state.previewActive);
  const demo = previewActive && isUiPreviewActive();
  const owner = demo
    ? chatOwnerId()
    : status === 'authenticated'
    ? user?.id
    : undefined;
  const cacheOwner = demo ? 'demo' : owner;
  const key = demo ? 'demo:' + id : owner ? threadKey(owner, id) : 'guest';
  const thread = useChatDrafts(state => state.threads[key] ?? emptyThread);
  const client = useQueryClient();
  const [error, setError] = useState(''),
    [blocked, setBlocked] = useState(false);
  const enabled = focused && active;
  const conversation = useQuery({
    queryKey: ['conversation', cacheOwner, id],
    queryFn: ({ signal }) => getConversation(id, signal),
    enabled,
    retry: false,
    refetchInterval: query =>
      enabled && !demo && owner && query.state.status !== 'error'
        ? 15000
        : false,
  });
  const messages = useInfiniteQuery({
    queryKey: ['messages', cacheOwner, id],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => getMessages(id, pageParam, signal),
    enabled: enabled && conversation.isSuccess,
    retry: false,
    refetchInterval: query =>
      enabled && !demo && owner && query.state.status !== 'error'
        ? 15000
        : false,
    getNextPageParam: (last, _pages, _lastParam, params) =>
      last.nextCursor && !params.includes(last.nextCursor)
        ? last.nextCursor
        : undefined,
  });
  const server = useMemo(
    () => orderedMessages(messages.data?.pages ?? []),
    [messages.data],
  );
  useEffect(() => {
    if (!owner) return;
    const confirmed = new Set(
      (messages.data?.pages ?? [])
        .flatMap(page => page.data)
        .filter(item => item.senderId === owner)
        .map(item => item.clientId),
    );
    for (const local of useChatDrafts.getState().threads[key]?.outbox ?? [])
      if (confirmed.has(local.clientId))
        useChatDrafts.getState().remove(key, local.clientId);
  }, [messages.data, owner, key]);
  const canSend = Boolean(
    owner &&
      chatSendConfigured() &&
      conversation.data?.canSend &&
      !conversation.data.participant.deleted &&
      conversation.isSuccess &&
      !conversation.isError &&
      messages.isSuccess &&
      !messages.isError &&
      !blocked,
  );
  const transmit = useCallback(
    (item: LocalMessage) => {
      const flightKey = key + ':' + item.clientId;
      if (inFlight.has(flightKey)) return inFlight.get(flightKey)!;
      const operation = (async () => {
        if (!canSend || chatOwnerId() !== owner) {
          setError('Sending is currently unavailable.');
          return;
        }
        useChatDrafts.getState().status(key, item.clientId, 'pending');
        setError('');
        try {
          const confirmed = await sendMessage(id, item.body, item.clientId);
          if (chatOwnerId() !== owner) return;
          await client.cancelQueries({
            queryKey: ['messages', cacheOwner, id],
          });
          if (chatOwnerId() !== owner) return;
          client.setQueryData<InfiniteData<Page>>(
            ['messages', cacheOwner, id],
            existing =>
              existing
                ? {
                    ...existing,
                    pages: existing.pages.map((page, index) =>
                      index === 0
                        ? {
                            ...page,
                            data: [
                              confirmed,
                              ...page.data.filter(
                                message => message.id !== confirmed.id,
                              ),
                            ],
                          }
                        : page,
                    ),
                  }
                : existing,
          );
          useChatDrafts.getState().remove(key, item.clientId);
        } catch (failure) {
          if (chatOwnerId() !== owner) return;
          useChatDrafts.getState().status(key, item.clientId, 'failed');
          setError('Message not confirmed. Tap the failed message to retry.');
          if (
            failure instanceof ApiError &&
            [401, 403, 404, 410].includes(failure.status ?? 0)
          ) {
            setBlocked(true);
            client
              .invalidateQueries({ queryKey: ['conversation', cacheOwner, id] })
              .catch(() => {});
          }
        }
      })();
      inFlight.set(flightKey, operation);
      operation.finally(() => inFlight.delete(flightKey));
      return operation;
    },
    [canSend, owner, key, id, client, cacheOwner],
  );
  const send = useCallback(() => {
    const draft = useChatDrafts.getState().threads[key]?.draft.trim();
    if (!canSend || chatOwnerId() !== owner || !draft || draft.length > 4000)
      return Promise.resolve();
    const item: LocalMessage = {
      clientId:
        'm_' +
        Date.now().toString(36) +
        '_' +
        (++sequence).toString(36) +
        '_' +
        Math.random().toString(36).slice(2, 12),
      body: draft,
      createdAt: new Date().toISOString(),
      state: 'pending',
    };
    useChatDrafts.getState().enqueue(key, item);
    return transmit(item);
  }, [canSend, key, transmit, owner]);
  const retry = useCallback(
    (clientId: string) => {
      const item = useChatDrafts
        .getState()
        .threads[key]?.outbox.find(message => message.clientId === clientId);
      return item?.state === 'failed' ? transmit(item) : Promise.resolve();
    },
    [key, transmit],
  );
  const refetchConversation = conversation.refetch,
    refetchMessages = messages.refetch;
  const refresh = useCallback(() => {
    setBlocked(false);
    setError('');
    refetchConversation().catch(() => {});
    refetchMessages().catch(() => {});
  }, [refetchConversation, refetchMessages]);
  const setDraft = useCallback(
    (text: string) => {
      if (owner && chatOwnerId() === owner)
        useChatDrafts.getState().draft(key, text);
    },
    [owner, key],
  );
  return {
    owner,
    thread,
    server,
    conversation,
    messages,
    canSend,
    error,
    send,
    retry,
    setDraft,
    refresh,
  };
}
export type TimelineMessage = ChatMessage | LocalMessage;
