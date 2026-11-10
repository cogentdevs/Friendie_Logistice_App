import React from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
export function RequestConfirmationDialog({
  visible,
  onCancel,
}: {
  visible: boolean;
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
        <View pointerEvents="none" style={styles.backdrop} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View accessibilityViewIsModal style={styles.card}>
            <AppText
              accessibilityRole="header"
              variant="headingMD"
              color={colors.navy}
            >
              Send Request?
            </AppText>
            <AppText>
              Would you like to send a request for this listing?
            </AppText>
            <AppText accessibilityRole="alert">
              Request submission is not connected yet. No request has been sent.
            </AppText>
            <AppButton title="Send Request" disabled />
            <AppButton
              title="Cancel request"
              variant="secondary"
              onPress={onCancel}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.secondary,
    opacity: 0.5,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 20,
    padding: 22,
    backgroundColor: colors.white,
    gap: 16,
  },
});
