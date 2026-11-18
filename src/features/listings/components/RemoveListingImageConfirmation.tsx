import React from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors, radius, spacing } from '../../../theme';
export function RemoveListingImageConfirmation({
  visible,
  busy,
  onCancel,
  onRemove,
}: {
  visible: boolean;
  busy: boolean;
  onCancel: () => void;
  onRemove: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card} accessibilityViewIsModal>
            <AppText
              variant="headingMD"
              accessibilityRole="header"
              color={colors.navy}
            >
              Remove uploaded image?
            </AppText>
            <AppText>
              This listing will use its default image. The listing itself will
              remain unchanged.
            </AppText>
            <AppButton
              title="Cancel"
              variant="secondary"
              disabled={busy}
              onPress={onCancel}
            />
            <AppButton
              title="Remove"
              loading={busy}
              disabled={busy}
              onPress={onRemove}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000066', padding: spacing.lg },
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
});
