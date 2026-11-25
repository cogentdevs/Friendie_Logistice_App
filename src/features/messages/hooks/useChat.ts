import {
  isUiPreviewActive,
  useDevelopmentStore,
} from '../../../store/developmentStore';
import { chatOwnerId } from '../development/demoChat';
import { useMarkConversationRead } from './useMarkConversationRead';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import {
  revokeDealAccess,
  subscribeDealRevocation,
} from '../../deals/dealAccessEvents';
import { ApiError } from '../../../types/api';
import {
  chatSendConfigured,
  getConversation,
  getMessages,
  sendMessage,
  ChatMessage,
  compareChatOrder,
  validateMessageText,
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
    .sort(compareChatOrder);
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
  const [sending, setSending] = useState(false);
  const mounted = useRef(true);
  const lifecycle = useRef(0);
  useEffect(() => {
    const generation = ++lifecycle.current;
    mounted.current = true;
    setSending(false);
    setError('');
    setBlocked(false);
    return () => {
      mounted.current = false;
      lifecycle.current = generation + 1;
    };
  }, [id, user]);
  const enabled = focused && active && !!owner;
  const conversationKey = [
    demo ? 'conversation' : 'chat.conversation.read',
    cacheOwner,
    id,
  ];
  const messagesKey = [demo ? 'messages' : 'chat.history.read', cacheOwner, id];
  const conversation = useQuery({
    queryKey: conversationKey,
    queryFn: ({ signal }) => getConversation(id, signal),
    enabled,
    retry: false,
    staleTime: demo ? 30000 : 0,
    refetchOnMount: demo ? true : 'always',
    refetchInterval: !demo && enabled ? 10000 : false,
  });
  const messages = useInfiniteQuery({
    queryKey: messagesKey,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const result = await getMessages(id, pageParam, signal);
      if (
        signal.aborted ||
        (!demo &&
          (useAuthStore.getState().user !== user ||
            useAuthStore.getState().status !== 'authenticated'))
      )
        throw new ApiError('Chat request cancelled.', 'cancelled');
      if (
        !demo &&
        result.data.some(
          item =>
            item.senderId !== owner &&
            item.senderId !== conversation.data?.participant.id,
        )
      )
        throw new ApiError('Conversation unavailable.', 'forbidden', 403);
      return result;
    },
    enabled: enabled && conversation.isSuccess,
    retry: false,
    staleTime: 30000,
    refetchOnMount: thread.uncertain ? 'always' : true,
    getNextPageParam: (last, _pages, _lastParam, params) =>
      last.nextCursor && !params.includes(last.nextCursor)
        ? last.nextCursor
        : undefined,
  });
  const server = useMemo(
    () => orderedMessages(messages.data?.pages ?? []),
    [messages.data],
  );
  const [visibleLatest, setVisibleLatest] = useState<string>();
  useEffect(() => {
    setVisibleLatest(undefined);
  }, [id, user]);
  useMarkConversationRead(
    id,
    !demo &&
      enabled &&
      conversation.isSuccess &&
      messages.isSuccess &&
      !messages.isFetching &&
      !messages.isError,
    visibleLatest,
    server,
    messages.dataUpdatedAt,
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
  const [leaseExpired, setLeaseExpired] = useState(false);
  useEffect(() => {
    setLeaseExpired(false);
    if (demo || !conversation.data?.writeUntil) return;
    const timer = setTimeout(
      () => setLeaseExpired(true),
      Math.max(0, conversation.data.writeUntil - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [demo, conversation.data]);
  useEffect(
    () =>
      subscribeDealRevocation(deal => {
        if (deal === undefined || deal === conversation.data?.dealId) {
          setLeaseExpired(true);
          setBlocked(true);
        }
      }),
    [conversation.data?.dealId],
  );
  const canSend = Boolean(
    enabled &&
      owner &&
      chatSendConfigured() &&
      conversation.data?.canSend &&
      !conversation.data.participant.deleted &&
      conversation.isSuccess &&
      !conversation.isError &&
      messages.isSuccess &&
      !messages.isError &&
      !blocked &&
      (demo ||
        (!leaseExpired &&
          !conversation.isFetching &&
          (conversation.data?.writeUntil ?? 0) > Date.now())) &&
      !sending &&
      (demo || !thread.uncertain),
  );
  useEffect(() => {
    if (demo || sending || !thread.uncertain) return;
    const pending = thread.uncertain;
    if (
      server.some(
        message =>
          message.senderId === owner &&
          Number(message.id) > pending.afterId &&
          (message.body === pending.body ||
            message.body === pending.body.trim()),
      )
    ) {
      // A matching later server record is evidence of delivery, not a reason to resend.
      useChatDrafts.getState().uncertain(key);
      if (useChatDrafts.getState().threads[key]?.draft === pending.body)
        useChatDrafts.getState().draft(key, '');
      setError('');
    }
  }, [demo, sending, thread.uncertain, server, owner, key]);
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
    if (!demo) {
      const flightKey = 'real:' + key;
      if (inFlight.has(flightKey)) return inFlight.get(flightKey)!;
      if (
        !canSend ||
        !user ||
        useAuthStore.getState().user !== user ||
        useChatDrafts.getState().threads[key]?.uncertain
      )
        return Promise.resolve();
      const body = useChatDrafts.getState().threads[key]?.draft ?? '';
      try {
        validateMessageText(body);
      } catch (failure) {
        const text =
          failure instanceof ApiError
            ? failure.message
            : 'Enter a valid message.';
        setError(text);
        Toast.show({
          type: 'warning',
          text1: 'Check your message',
          text2: text,
        });
        return Promise.resolve();
      }
      const generation = lifecycle.current;
      const current = () =>
        mounted.current &&
        lifecycle.current === generation &&
        useAuthStore.getState().status === 'authenticated' &&
        useAuthStore.getState().user === user;
      const historyKey = ['chat.history.read', owner, id];
      const afterId = server.reduce(
        (max, message) => Math.max(max, Number(message.id) || 0),
        0,
      );
      setSending(true);
      setError('');
      const operation = (async () => {
        try {
          await client.cancelQueries({ queryKey: historyKey, exact: true });
          if (!current()) return;
          useChatDrafts.getState().uncertain(key, { body, afterId });
          const confirmed = await sendMessage(id, body, '');
          if (!current()) return;
          await client.cancelQueries({ queryKey: historyKey, exact: true });
          if (!current()) return;
          client.setQueryData<InfiniteData<Page>>(historyKey, existing =>
            existing
              ? {
                  ...existing,
                  pages: existing.pages.map((page, index) => ({
                    ...page,
                    data:
                      index === 0
                        ? [
                            ...page.data.filter(
                              message => message.id !== confirmed.id,
                            ),
                            confirmed,
                          ]
                        : page.data.filter(
                            message => message.id !== confirmed.id,
                          ),
                  })),
                }
              : existing,
          );
          useChatDrafts.getState().uncertain(key);
          if (useChatDrafts.getState().threads[key]?.draft === body)
            useChatDrafts.getState().draft(key, '');
          client
            .invalidateQueries({
              queryKey: ['messages.inbox', owner],
              refetchType: 'none',
            })
            .catch(() => {});
        } catch (failure) {
          if (!current()) return;
          const rejected =
            failure instanceof ApiError &&
            [400, 401, 403, 404, 422, 429].includes(failure.status ?? 0);
          if (rejected) useChatDrafts.getState().uncertain(key);
          if (
            failure instanceof ApiError &&
            [403, 404].includes(failure.status ?? 0)
          ) {
            setBlocked(true);
            if (conversation.data?.dealId)
              revokeDealAccess(conversation.data.dealId);
          }
          const fieldMessages =
            failure instanceof ApiError ? failure.fields?.message : undefined;
          const validationMessage =
            Array.isArray(fieldMessages) && typeof fieldMessages[0] === 'string'
              ? fieldMessages[0]
              : undefined;
          const text = rejected
            ? failure instanceof ApiError && failure.status === 422
              ? validationMessage || 'Check your message and try again.'
              : failure instanceof ApiError && failure.status === 429
              ? 'Too many messages. Please wait before trying again.'
              : 'Message was rejected. Check your access and try again.'
            : 'Delivery is not confirmed. Your draft is saved. Refresh history before sending again.';
          setError(text);
          Toast.show({
            type:
              failure instanceof ApiError && failure.status === 403
                ? 'rejected'
                : rejected
                ? 'error'
                : 'warning',
            text1: rejected
              ? 'Unable to send message'
              : 'Delivery not confirmed',
            text2: text,
          });
          if (!rejected)
            client
              .invalidateQueries({ queryKey: historyKey, exact: true })
              .catch(() => {});
        } finally {
          if (current()) setSending(false);
        }
      })();
      inFlight.set(flightKey, operation);
      operation.finally(() => inFlight.delete(flightKey));
      return operation;
    }
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
  }, [
    demo,
    canSend,
    key,
    transmit,
    owner,
    user,
    id,
    client,
    server,
    conversation.data?.dealId,
  ]);
  const retry = useCallback(
    (clientId: string) => {
      const item = useChatDrafts
        .getState()
        .threads[key]?.outbox.find(message => message.clientId === clientId);
      return item?.state === 'failed' ? transmit(item) : Promise.resolve();
    },
    [key, transmit],
  );
  const readFlight = useRef<Promise<unknown> | null>(null);
  const notify = useCallback(
    (failure: unknown) => {
      if (
        mounted.current &&
        useAuthStore.getState().user === user &&
        !(failure instanceof ApiError && failure.kind === 'cancelled')
      )
        Toast.show({
          type: 'error',
          text1: 'Unable to load chat',
          text2:
            failure instanceof ApiError && failure.kind === 'network'
              ? 'Unable to connect or request timed out. Please try again.'
              : 'Conversation could not be loaded. Please try again.',
        });
    },
    [user],
  );
  const refetchConversation = conversation.refetch;
  const refetchMessages = messages.refetch;
  const refresh = useCallback(() => {
    if (readFlight.current || !owner) return readFlight.current;
    setBlocked(false);
    setError('');
    const operation = (async () => {
      const metadata = await refetchConversation({ cancelRefetch: false });
      if (metadata.error) {
        notify(metadata.error);
        return;
      }
      if (!mounted.current || useAuthStore.getState().user !== user) return;
      const result = await refetchMessages({ cancelRefetch: false });
      if (result.error) notify(result.error);
    })().finally(() => {
      readFlight.current = null;
    });
    readFlight.current = operation;
    return operation;
  }, [owner, user, refetchConversation, refetchMessages, notify]);
  const loadEarlier = () => {
    if (
      readFlight.current ||
      !owner ||
      !messages.hasNextPage ||
      messages.isFetching
    )
      return readFlight.current ?? Promise.resolve();
    const operation = messages
      .fetchNextPage({ cancelRefetch: false })
      .then(result => {
        if (result.error) notify(result.error);
        return result;
      })
      .finally(() => {
        readFlight.current = null;
      });
    readFlight.current = operation;
    return operation;
  };
  const setDraft = useCallback(
    (text: string) => {
      if (owner && chatOwnerId() === owner)
        useChatDrafts.getState().draft(key, text);
    },
    [owner, key],
  );
  return {
    owner,
    thread: demo ? thread : { draft: thread.draft, outbox: emptyThread.outbox },
    server,
    conversation,
    messages: { ...messages, fetchNextPage: loadEarlier },
    canSend,
    sending,
    error,
    send,
    retry,
    setDraft,
    refresh,
    setVisibleLatest,
  };
}
export type TimelineMessage = ChatMessage | LocalMessage;
