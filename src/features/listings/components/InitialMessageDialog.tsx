import { KeyboardScrollView as ScrollView } from '../../../components/layout/KeyboardScrollView';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { AppInput } from '../../../components/ui/AppInput';
import { AppButton } from '../../../components/ui/AppButton';
import { colors, radius, spacing } from '../../../theme';

export function InitialMessageDialog({
  visible,
  draft,
  busy,
  blocked,
  onChange,
  onSend,
  onCancel,
}: {
  visible: boolean;
  draft: string;
  busy: boolean;
  blocked: boolean;
  onChange: (text: string) => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
          >
            <View style={styles.card} accessibilityViewIsModal>
              <AppText
                variant="headingMD"
                accessibilityRole="header"
                color={colors.navy}
              >
                Send a message
              </AppText>
              <AppInput
                label="Initial message"
                multiline
                value={draft}
                onChangeText={onChange}
                editable={!busy && !blocked}
                style={styles.input}
                textAlignVertical="top"
              />
              {blocked && (
                <AppText accessibilityLiveRegion="polite">
                  Delivery is not confirmed. Your draft is saved. Check your
                  Inbox before sending again.
                </AppText>
              )}
              <AppButton
                title={busy ? 'Sending…' : 'Send'}
                disabled={busy || blocked}
                onPress={onSend}
              />
              <AppButton
                title="Cancel"
                variant="secondary"
                onPress={onCancel}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000066', padding: spacing.lg },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  input: { minHeight: 100 },
});
