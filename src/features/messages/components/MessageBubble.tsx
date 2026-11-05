import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { TimelineMessage } from '../hooks/useChat';
export const MessageBubble = memo(function MessageBubbleView({
  message,
  outgoing,
  day,
  retry,
  canRetry,
}: {
  message: TimelineMessage;
  outgoing: boolean;
  day?: string;
  retry: (id: string) => void;
  canRetry: boolean;
}) {
  const local = 'state' in message;
  const foreground = outgoing ? colors.white : colors.navy;
  const stamp = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <View style={styles.group}>
      {!!day && (
        <AppText style={styles.day} variant="caption">
          {day}
        </AppText>
      )}
      <View
        style={[styles.bubble, outgoing ? styles.outgoing : styles.incoming]}
      >
        <AppText color={foreground} style={styles.body}>
          {message.body}
        </AppText>
        <View style={styles.meta}>
          <AppText color={foreground} style={styles.time}>
            {stamp}
          </AppText>
          {local ? (
            <AppText color={foreground} style={styles.time}>
              {message.state === 'pending' ? 'Sending...' : 'Not sent'}
            </AppText>
          ) : outgoing && message.status ? (
            <View accessibilityLabel={message.status}>
              {message.status === 'sent' ? (
                <Check size={13} color={foreground} />
              ) : (
                <CheckCheck size={13} color={foreground} />
              )}
            </View>
          ) : null}
        </View>
      </View>
      {local && message.state === 'failed' && (
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel={'Retry message ' + message.clientId}
          disabled={!canRetry}
          onPress={() => retry(message.clientId)}
          style={styles.retry}
        >
          <AppText color={colors.primary} variant="caption">
            {canRetry ? 'Not confirmed. Tap to retry' : 'Retry unavailable'}
          </AppText>
        </Pressable>
      )}
    </View>
  );
});
const styles = StyleSheet.create({
  group: { paddingVertical: 7 },
  day: { textAlign: 'center', paddingVertical: 12 },
  bubble: {
    maxWidth: '87%',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderRadius: 18,
    gap: 6,
  },
  incoming: {
    alignSelf: 'flex-start',
    backgroundColor: colors.lightGrey,
    borderBottomLeftRadius: 5,
  },
  outgoing: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 5,
  },
  body: { fontSize: 15, lineHeight: 21 },
  meta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  time: { fontSize: 10, lineHeight: 14 },
  retry: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
