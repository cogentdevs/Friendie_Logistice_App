import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { colors } from '../../../theme';
export function ListingFormField({
  label,
  value,
  placeholder,
  icon: Icon,
  onPress,
  error,
}: {
  label: string;
  value?: string;
  placeholder: string;
  icon: LucideIcon;
  onPress: () => void;
  error?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Pressable
        cssInterop={false}
        accessibilityRole="button"
        accessibilityLabel={'Select ' + label}
        accessibilityHint={value ?? placeholder}
        onPress={onPress}
        style={[styles.field, !!error && styles.invalid]}
      >
        <Icon size={21} color={colors.primary} />
        <View style={styles.text}>
          <AppText color={colors.navy} style={styles.label}>
            {label}
          </AppText>
          <AppText
            color={value ? colors.navy : colors.text}
            style={styles.value}
          >
            {value ?? placeholder}
          </AppText>
        </View>
        <ChevronRight size={19} color={colors.secondary} />
      </Pressable>
      {!!error && (
        <AppText
          accessibilityRole="alert"
          style={styles.error}
          color={colors.danger}
        >
          {error}
        </AppText>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { gap: 4 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  text: { flex: 1 },
  label: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  value: { fontSize: 13, lineHeight: 19 },
  invalid: { borderColor: colors.danger },
  error: { fontSize: 12, lineHeight: 17 },
});
