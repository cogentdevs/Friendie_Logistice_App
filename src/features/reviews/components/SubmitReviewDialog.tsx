import { KeyboardScrollView as ScrollView } from '../../../components/layout/KeyboardScrollView';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { AppInput } from '../../../components/ui/AppInput';
import { AppButton } from '../../../components/ui/AppButton';
import { colors, radius, spacing } from '../../../theme';
import type { ReviewDraft } from '../services/submitReviewService';

export function SubmitReviewDialog({
  visible,
  draft,
  busy,
  blocked,
  notice,
  onChange,
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  draft: ReviewDraft;
  busy: boolean;
  blocked: boolean;
  notice?: string;
  onChange: (value: ReviewDraft) => void;
  onSubmit: () => void;
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
                Write a review
              </AppText>
              <AppText>Rating (0–5)</AppText>
              <View
                style={styles.ratings}
                accessibilityRole="radiogroup"
                accessibilityLabel="Review rating"
              >
                {[0, 1, 2, 3, 4, 5].map(rating => (
                  <Pressable
                    key={rating}
                    accessibilityRole="radio"
                    accessibilityLabel={'Rating ' + rating + ' out of 5'}
                    accessibilityState={{
                      checked: draft.rating === rating,
                      disabled: busy || blocked,
                    }}
                    disabled={busy || blocked}
                    onPress={() => onChange({ ...draft, rating })}
                    style={[
                      styles.rating,
                      draft.rating === rating && styles.selected,
                    ]}
                  >
                    <AppText
                      color={
                        draft.rating === rating ? colors.white : colors.navy
                      }
                    >
                      {rating}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              <AppInput
                label="Review"
                multiline
                value={draft.review}
                onChangeText={review => onChange({ ...draft, review })}
                editable={!busy && !blocked}
                style={styles.input}
                textAlignVertical="top"
              />
              {notice && (
                <AppText accessibilityLiveRegion="polite">{notice}</AppText>
              )}
              <AppButton
                title="Submit"
                loading={busy}
                disabled={busy || blocked}
                onPress={onSubmit}
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
  ratings: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rating: {
    minWidth: 44,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: { minHeight: 100 },
});
