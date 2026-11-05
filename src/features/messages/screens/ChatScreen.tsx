import { isUiPreviewActive } from '../../../store/developmentStore';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { BackHandler } from 'react-native';
import {
  MoreVertical,
  Paperclip,
  Phone,
  Send,
  UserRound,
} from 'lucide-react-native';
import { MessagesStackParamList } from '../../../navigation/navigationTypes';
import { navigationRef } from '../../../navigation/navigationRef';
import { BackButton } from '../../../navigation/components/BackButton';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { KeyboardScreen } from '../../../components/layout/KeyboardScreen';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
import { ApiError } from '../../../types/api';
import { chatPhone } from '../services/chatService';
import { TimelineMessage, useChat } from '../hooks/useChat';
import { MessageBubble } from '../components/MessageBubble';
import { useAuthStore } from '../../../store/authStore';
type Props = NativeStackScreenProps<MessagesStackParamList, 'Chat'>;
export function ChatScreen(props: Props) {
  return <ChatContent key={props.route.params.conversationId} {...props} />;
}
function ChatContent({ navigation, route }: Props) {
  const id = route.params.conversationId,
    chat = useChat(id),
    focused = useIsFocused(),
    headerHeight = useHeaderHeight();
  const conversation = chat.conversation.isError
      ? undefined
      : chat.conversation.data,
    participant = conversation?.participant;
  const [avatarFailed, setAvatarFailed] = useState(false),
    [actionError, setActionError] = useState(''),
    [nearBottom, setNearBottom] = useState(true);
  const list = useRef<FlatList<TimelineRow>>(null);
  const back = useCallback(() => {
    const target = route.params.returnTo;
    if (target && navigationRef.isReady()) {
      navigation.replace('Conversations');
      if (target.stack === 'HomeStack')
        navigationRef.navigate('AppDrawer', {
          screen: 'MainTabs',
          params: {
            screen: 'HomeStack',
            params: {
              screen: 'ListingDetails',
              params: { listingId: target.listingId },
            },
          },
        });
      else
        navigationRef.navigate('AppDrawer', {
          screen: 'MainTabs',
          params: {
            screen: 'ListingsStack',
            params: {
              screen: 'ListingDetails',
              params: { listingId: target.listingId },
            },
          },
        });
    } else if (navigation.getState().index > 0) navigation.goBack();
    else navigation.replace('Conversations');
  }, [navigation, route.params.returnTo]);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        back();
        return true;
      });
      return () => sub.remove();
    }, [back]),
  );
  const phone = conversation ? chatPhone(conversation) : undefined;
  const call = useCallback(() => {
    if (!phone || useAuthStore.getState().status !== 'authenticated') return;
    Alert.alert('Call participant', 'Open your phone dialer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open dialer',
        onPress: async () => {
          if (useAuthStore.getState().status !== 'authenticated') return;
          try {
            await Linking.openURL('tel:' + phone);
          } catch {
            setActionError('Could not open the phone dialer.');
          }
        },
      },
    ]);
  }, [phone]);
  const presence = participant?.presence;
  const freshPresence =
    presence &&
    Date.now() - Date.parse(presence.observedAt) >= 0 &&
    Date.now() - Date.parse(presence.observedAt) < 45000;
  const presenceText =
    !participant?.deleted && freshPresence
      ? presence.online
        ? 'Online'
        : presence.lastSeenAt
        ? 'Last seen ' + new Date(presence.lastSeenAt).toLocaleString()
        : undefined
      : undefined;
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Chat',
      headerLeft: () => <BackButton onPress={back} />,
      headerTitle: () => (
        <View style={styles.person}>
          <View style={styles.avatar}>
            {participant?.avatarUrl && !avatarFailed && !participant.deleted ? (
              <Image
                source={{ uri: participant.avatarUrl }}
                style={styles.avatarImage}
                onError={() => setAvatarFailed(true)}
                accessibilityLabel="Participant avatar"
              />
            ) : (
              <UserRound size={23} color={colors.secondary} />
            )}
          </View>
          <View style={styles.identity}>
            <AppText color={colors.navy} numberOfLines={1} style={styles.name}>
              {participant?.deleted
                ? 'Deleted user'
                : participant?.name ?? 'Conversation'}
            </AppText>
            {!!presenceText && (
              <AppText variant="caption">{presenceText}</AppText>
            )}
          </View>
        </View>
      ),
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Call participant"
            accessibilityState={{ disabled: !phone }}
            disabled={!phone}
            onPress={call}
            style={styles.icon}
          >
            <Phone
              size={21}
              color={phone ? colors.primary : colors.textMuted}
            />
          </Pressable>
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Conversation options"
            onPress={() =>
              Alert.alert(
                'Conversation options',
                'Messages refresh while this conversation is open. Attachments, reporting and blocking are not connected.',
                [
                  { text: 'Close', style: 'cancel' },
                  { text: 'Refresh messages', onPress: chat.refresh },
                ],
              )
            }
            style={styles.icon}
          >
            <MoreVertical size={22} color={colors.navy} />
          </Pressable>
        </View>
      ),
    });
  }, [
    navigation,
    back,
    participant,
    avatarFailed,
    presenceText,
    phone,
    call,
    chat.refresh,
  ]);
  const rows = useMemo(() => {
    const confirmed = new Set(
      chat.server
        .filter(item => item.senderId === chat.owner)
        .map(item => item.clientId),
    );
    const items: TimelineMessage[] = [
      ...chat.server,
      ...chat.thread.outbox.filter(item => !confirmed.has(item.clientId)),
    ];
    items.sort(
      (a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        rowId(a).localeCompare(rowId(b)),
    );
    return items
      .map((message, index) => ({
        message,
        key: rowId(message),
        day:
          index === 0 ||
          dayKey(message.createdAt) !== dayKey(items[index - 1].createdAt)
            ? new Date(message.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : undefined,
      }))
      .reverse();
  }, [chat.server, chat.thread.outbox, chat.owner]);
  const latest = rows[0]?.key;
  useEffect(() => {
    if (nearBottom) list.current?.scrollToOffset({ offset: 0, animated: true });
  }, [latest, nearBottom]);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (nearBottom)
        list.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return () => sub.remove();
  }, [nearBottom]);
  const { owner: rowOwner, retry: retryMessage, canSend: canRetry } = chat;
  const renderRow = useCallback(
    ({ item }: { item: TimelineRow }) => (
      <MessageBubble
        message={item.message}
        outgoing={'state' in item.message || item.message.senderId === rowOwner}
        day={item.day}
        retry={clientId => {
          retryMessage(clientId).catch(() => {});
        }}
        canRetry={canRetry}
      />
    ),
    [rowOwner, retryMessage, canRetry],
  );
  const messageDenied =
    chat.messages.error instanceof ApiError &&
    [401, 403, 404, 410].includes(chat.messages.error.status ?? 0);
  const inaccessible =
    messageDenied ||
    (chat.conversation.error instanceof ApiError &&
      [401, 403, 404, 410].includes(chat.conversation.error.status ?? 0));
  const loadError = chat.conversation.isError || chat.messages.isError;
  const loading =
    chat.conversation.isPending ||
    (chat.conversation.isSuccess && chat.messages.isPending);
  return (
    <SafeScreen backgroundColor={colors.white}>
      {focused && <StatusBar barStyle="dark-content" />}
      <KeyboardScreen offset={headerHeight}>
        {isUiPreviewActive() && (
          <AppText variant="caption" style={styles.notice}>
            UI demo - sample chat. Messages stay on this device.
          </AppText>
        )}
        {chat.conversation.isError || messageDenied ? (
          <View style={styles.state}>
            <AppText
              accessibilityRole="header"
              variant="headingMD"
              color={colors.navy}
            >
              {inaccessible
                ? 'Conversation unavailable'
                : 'Unable to load conversation'}
            </AppText>
            <AppText accessibilityRole="alert">
              {inaccessible
                ? 'Sign in to an authorized account or choose an available conversation.'
                : 'Messaging is unavailable. Check your connection or try again later.'}
            </AppText>
            <AppButton title="Retry conversation" onPress={chat.refresh} />
          </View>
        ) : (
          <>
            {participant?.deleted && (
              <AppText style={styles.notice} accessibilityRole="alert">
                This participant is no longer available.
              </AppText>
            )}
            <FlatList
              ref={list}
              inverted
              data={rows}
              renderItem={renderRow}
              keyExtractor={item => item.key}
              contentContainerStyle={styles.messages}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              initialNumToRender={20}
              windowSize={9}
              onScroll={event =>
                setNearBottom(event.nativeEvent.contentOffset.y < 80)
              }
              scrollEventThrottle={100}
              onEndReachedThreshold={0.25}
              onEndReached={() => {
                if (
                  chat.messages.hasNextPage &&
                  !chat.messages.isFetching &&
                  !chat.messages.isFetchNextPageError
                )
                  chat.messages.fetchNextPage().catch(() => {});
              }}
              ListEmptyComponent={
                <View style={styles.state}>
                  {loading ? (
                    <ActivityIndicator
                      accessibilityLabel="Loading messages"
                      color={colors.primary}
                    />
                  ) : (
                    <AppText>
                      {loadError
                        ? 'Messages could not be loaded.'
                        : 'No messages yet.'}
                    </AppText>
                  )}
                </View>
              }
              ListFooterComponent={
                chat.messages.isFetchingNextPage ? (
                  <ActivityIndicator
                    accessibilityLabel="Loading earlier messages"
                    color={colors.primary}
                  />
                ) : chat.messages.isFetchNextPageError ? (
                  <AppButton
                    title="Retry earlier messages"
                    onPress={() => {
                      chat.messages.fetchNextPage().catch(() => {});
                    }}
                  />
                ) : chat.messages.isError ? (
                  <AppButton title="Retry messages" onPress={chat.refresh} />
                ) : undefined
              }
            />
            {!nearBottom && (
              <AppButton
                title="Latest messages"
                variant="ghost"
                onPress={() => {
                  list.current?.scrollToOffset({ offset: 0, animated: true });
                  setNearBottom(true);
                }}
              />
            )}
          </>
        )}
        {!!chat.error && (
          <AppText
            accessibilityRole="alert"
            color={colors.danger}
            style={styles.notice}
          >
            {chat.error}
          </AppText>
        )}
        {!!actionError && (
          <AppText
            accessibilityRole="alert"
            color={colors.danger}
            style={styles.notice}
          >
            {actionError}
          </AppText>
        )}
        {!chat.canSend && (
          <AppText variant="caption" style={styles.notice}>
            {participant?.deleted
              ? 'Sending is disabled for a deleted participant.'
              : loadError
              ? 'Sending is disabled until the conversation can be loaded.'
              : 'Sending is currently unavailable.'}
          </AppText>
        )}
        <View style={styles.composer}>
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Attachments unavailable"
            accessibilityState={{ disabled: true }}
            disabled
            style={styles.icon}
          >
            <Paperclip size={23} color={colors.textMuted} />
          </Pressable>
          <TextInput
            accessibilityLabel="Message draft"
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={chat.thread.draft}
            onChangeText={chat.setDraft}
            editable={Boolean(chat.owner) && !participant?.deleted}
            multiline
            maxLength={4000}
            style={styles.input}
            textAlignVertical="center"
          />
          <Pressable
            cssInterop={false}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{
              disabled: !chat.canSend || !chat.thread.draft.trim(),
            }}
            disabled={!chat.canSend || !chat.thread.draft.trim()}
            onPress={() => {
              setNearBottom(true);
              chat.send().catch(() => {});
            }}
            style={[
              styles.send,
              (!chat.canSend || !chat.thread.draft.trim()) && styles.disabled,
            ]}
          >
            <Send size={21} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardScreen>
    </SafeScreen>
  );
}
type TimelineRow = { message: TimelineMessage; key: string; day?: string };
function rowId(message: TimelineMessage) {
  return 'state' in message
    ? 'local:' + message.clientId
    : 'server:' + message.id;
}
function dayKey(value: string) {
  return new Date(value).toLocaleDateString();
}
const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row' },
  icon: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 220 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.lightGrey,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  identity: { flexShrink: 1 },
  name: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  messages: { paddingHorizontal: 18, paddingVertical: 12, flexGrow: 1 },
  state: { padding: 24, gap: 16, flex: 1, justifyContent: 'center' },
  notice: { paddingHorizontal: 18, paddingVertical: 6 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.offWhite,
    minHeight: 44,
    maxHeight: 124,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.navy,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
});
