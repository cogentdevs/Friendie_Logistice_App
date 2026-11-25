import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../store/authStore';
import { isUiPreviewActive } from '../../../store/developmentStore';
import { navigationRef } from '../../../navigation/navigationRef';
import { requireAuth } from '../../auth/services/authFlowCoordinator';
import { isVerifiedPublicListing } from '../../listings/services/publicListingsService';
import { ApiError } from '../../../types/api';
import { useChatDrafts, threadKey } from '../store/chatDraftStore';
import {
  createOrReuseConversation,
  conversationSubmissionState,
} from '../services/createConversationService';

export function useInitialConversation(
  listing: { id: number } | undefined,
  focused: boolean,
  _stack: 'HomeStack' | 'ListingsStack',
  dealId?: number,
  onChooseDeal?: () => void,
) {
  const user = useAuthStore(state => state.user);
  const status = useAuthStore(state => state.status);
  const client = useQueryClient();
  const [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false);
  const key =
    user && listing ? threadKey(user.id, 'initial:deal:' + dealId) : '';
  const draft = useChatDrafts(state => state.threads[key]?.draft ?? '');
  const flight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const completed = useRef<Awaited<
    ReturnType<typeof createOrReuseConversation>
  > | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const epoch = ++generation.current;
    setVisible(false);
    setBusy(false);
    completed.current = null;
    controller.current?.abort();
    return () => {
      generation.current = epoch + 1;
      controller.current?.abort();
    };
  }, [user, status, listing?.id, focused, dealId]);
  const open = useCallback(() => {
    if (
      !listing ||
      (!dealId && !isVerifiedPublicListing(listing)) ||
      isUiPreviewActive()
    ) {
      Toast.show({
        type: 'info',
        text1: 'Messaging unavailable',
        text2: 'Select a real public listing and sign in with a real account.',
      });
      return;
    }
    if (useAuthStore.getState().status !== 'authenticated') {
      requireAuth({
        type: 'START_CONVERSATION',
        params: { listingId: String(listing.id) },
      });
      return;
    }
    if (!dealId) {
      if (onChooseDeal) {
        onChooseDeal();
        return;
      }
      Toast.show({
        type: 'info',
        text1: 'Choose a deal',
        text2: 'Open an accepted or confirmed deal to contact its participant.',
      });
      return;
    }
    setVisible(true);
  }, [listing, dealId, onChooseDeal]);
  const setDraft = (text: string) => {
    if (
      !busy &&
      !conversationSubmissionState(dealId ?? 0) &&
      !completed.current &&
      user &&
      useAuthStore.getState().user === user
    )
      useChatDrafts.getState().draft(key, text);
  };
  const send = async () => {
    if (
      flight.current ||
      !listing ||
      !dealId ||
      !user ||
      status !== 'authenticated' ||
      !focused
    )
      return;
    flight.current = true;
    setBusy(true);
    const epoch = generation.current;
    const current = () =>
      generation.current === epoch &&
      useAuthStore.getState().user === user &&
      useAuthStore.getState().status === 'authenticated';
    const abort = new AbortController();
    controller.current = abort;
    try {
      const body = useChatDrafts.getState().threads[key]?.draft ?? '';
      const result =
        completed.current ??
        (await createOrReuseConversation(
          { id: listing.id, dealId },
          body,
          abort.signal,
        ));
      if (!current()) return;
      completed.current = result;
      const inboxKey = ['messages.inbox', user.id];
      await client.cancelQueries({ queryKey: inboxKey });
      if (!current()) return;
      await client.invalidateQueries({
        queryKey: inboxKey,
        refetchType: 'active',
      });
      if (!current()) return;
      const room = String(result.conversation.id);
      // An already cached reused thread may still be fresh for 30 seconds.
      // Make the existing Chat readers load authoritative metadata/history on
      // entry instead of publishing or fabricating an initial message here.
      for (const prefix of ['chat.conversation.read', 'chat.history.read']) {
        const queryKey = [prefix, user.id, room];
        await client.cancelQueries({ queryKey, exact: true });
        if (!current()) return;
        await client.invalidateQueries({
          queryKey,
          exact: true,
          refetchType: 'none',
        });
        if (!current()) return;
      }
      const targetKey = threadKey(user.id, room);
      const existing = useChatDrafts.getState().threads[targetKey];
      if (!result.created) {
        if (
          existing?.uncertain ||
          (existing?.draft && existing.draft !== body)
        ) {
          Toast.show({
            type: 'warning',
            text1: 'Existing Chat draft preserved',
            text2:
              'Your initial message is saved here. Review the existing Chat draft before continuing.',
          });
          return;
        }
        useChatDrafts.getState().draft(targetKey, body);
      }
      if (!navigationRef.isReady())
        throw new ApiError(
          'Navigation is unavailable. Your result is saved; try opening Chat again.',
          'validation',
        );
      useChatDrafts.getState().draft(key, '');
      setVisible(false);
      navigationRef.navigate('AppDrawer', {
        screen: 'MainTabs',
        params: {
          screen: 'MessagesStack',
          params: {
            screen: 'Chat',
            params: {
              conversationId: room,
              returnToDeal: dealId,
            },
          },
        },
      });
    } catch (error) {
      if (!current()) return;
      const unknown = conversationSubmissionState(dealId) === 'unknown';
      Toast.show({
        type: unknown ? 'warning' : 'error',
        text1: unknown ? 'Delivery not confirmed' : 'Unable to continue',
        text2: unknown
          ? 'Your draft is saved. Check your Inbox before sending again.'
          : error instanceof ApiError &&
            ['validation', 'unauthorized'].includes(error.kind)
          ? error.message
          : 'Unable to open this conversation. Please check your connection or access.',
      });
    } finally {
      flight.current = false;
      if (current()) setBusy(false);
    }
  };
  return {
    visible: visible && focused && status === 'authenticated',
    draft,
    busy,
    blocked: conversationSubmissionState(dealId ?? 0) === 'unknown',
    open,
    setDraft,
    send,
    close: () => {
      generation.current++;
      controller.current?.abort();
      setVisible(false);
      setBusy(false);
    },
  };
}
