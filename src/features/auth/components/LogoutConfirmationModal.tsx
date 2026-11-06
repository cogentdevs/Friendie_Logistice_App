import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
export function LogoutConfirmationModal({
  visible,
  onCancel,
  onConfirm,
  busy = false,
}: {
  visible: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancel = () => {
    if (!busy) onCancel();
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={cancel}
    >
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        style={styles.overlay}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.viewport}
        >
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={cancel}
            style={styles.card}
          >
            <View style={styles.icon}>
              <LogOut size={32} color={colors.primary} accessible={false} />
            </View>
            <AppText
              accessibilityRole="header"
              color={colors.navy}
              style={styles.title}
            >
              Log Out?
            </AppText>
            <AppText style={styles.description}>
              Are you sure you want to log out of your account?
            </AppText>
            <View style={styles.actions}>
              <Pressable
                cssInterop={false}
                accessibilityRole="button"
                accessibilityLabel="Cancel logout"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={cancel}
                style={({ pressed }) => [
                  styles.cancel,
                  styles.button,
                  (pressed || busy) && styles.inactive,
                ]}
              >
                <AppText color={colors.navy} style={styles.buttonText}>
                  Cancel
                </AppText>
              </Pressable>
              <AppButton
                title="Log Out"
                accessibilityLabel="Confirm logout"
                loading={busy}
                disabled={busy}
                onPress={() => {
                  if (!busy) onConfirm();
                }}
                style={styles.button}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.modalOverlay },
  viewport: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    alignItems: 'center',
    shadowColor: colors.navy,
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.softPink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: { fontSize: 15, lineHeight: 24, textAlign: 'center' },
  actions: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  button: { flex: 1, minWidth: 110, minHeight: 52, borderRadius: 14 },
  cancel: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  buttonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  inactive: { opacity: 0.55 },
});
